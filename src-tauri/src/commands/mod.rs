use serde::{Deserialize, Serialize};

use crate::memory;
use crate::models::*;
use crate::parser;
use windows::Win32::Foundation::HANDLE;
use std::sync::Mutex;
use std::collections::HashSet;
use tauri::{AppHandle, Emitter, State};

pub struct AppState {
    pub process: Mutex<Option<memory::ProcessHandle>>,
    pub players: Mutex<Vec<Player>>,
    pub squad_ids: Mutex<HashSet<u32>>,
    pub youth_teams: Mutex<Vec<YouthTeam>>,
    pub staff: Mutex<Vec<StaffMember>>,
    pub club_facilities: Mutex<Option<ClubFacilities>>,
    pub manager_profile: Mutex<Option<ManagerProfile>>,
    pub game_info: Mutex<Option<GameInfo>>,
    pub game_year: Mutex<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YouthTeam {
    pub name: String,
    pub player_ids: Vec<u32>,
    pub player_count: usize,
    pub avg_ca: f32,
    pub avg_age: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StaffMember {
    pub name: String,
    pub age: u8,
    pub nationality: String,
    pub team_name: String,
    pub coaching: CoachingAttrs,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CoachingAttrs {
    pub attacking: u8,
    pub defending: u8,
    pub fitness: u8,
    pub goalkeeping: u8,
    pub mental: u8,
    pub tactical: u8,
    pub technical: u8,
    pub working_with_youngsters: u8,
    pub determination: u8,
    pub discipline: u8,
    pub man_management: u8,
    pub motivating: u8,
    pub judging_ability: u8,
    pub judging_potential: u8,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ClubFacilities {
    pub training: u8,
    pub youth_facilities: u8,
    pub junior_coaching: u8,
    pub youth_recruitment: u8,
    pub corporate: u8,
    pub youth_importance: u8,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            process: Mutex::new(None),
            players: Mutex::new(Vec::new()),
            squad_ids: Mutex::new(HashSet::new()),
            youth_teams: Mutex::new(Vec::new()),
            staff: Mutex::new(Vec::new()),
            club_facilities: Mutex::new(None),
            manager_profile: Mutex::new(None),
            game_info: Mutex::new(None),
            game_year: Mutex::new(2025),
        }
    }
}

#[tauri::command]
pub fn connect_to_fm(state: State<'_, AppState>) -> Result<GameInfo, String> {
    log::info!("Attempting to connect to Football Manager...");
    let proc = memory::attach_to_fm()?;

    let info = GameInfo {
        connected: true,
        process_id: proc.pid,
        window_title: proc.window_title.clone(),
        game_version: "FM26".into(),
        build_number: 0,
        player_count: 0,
    };

    log::info!(
        "Connected — PID: {}, fm.exe base: 0x{:X}, game_plugin.dll: 0x{:X} ({} MB)",
        proc.pid, proc.base_address,
        proc.game_plugin_base, proc.game_plugin_size / (1024 * 1024)
    );

    *state.game_info.lock().unwrap() = Some(info.clone());
    *state.process.lock().unwrap() = Some(proc);
    Ok(info)
}

#[tauri::command]
pub fn get_connection_status(state: State<'_, AppState>) -> Result<GameInfo, String> {
    state.game_info.lock().unwrap().clone().ok_or_else(|| "Not connected".into())
}

#[tauri::command]
pub fn disconnect_fm(state: State<'_, AppState>) -> Result<(), String> {
    *state.process.lock().unwrap() = None;
    *state.game_info.lock().unwrap() = None;
    *state.players.lock().unwrap() = Vec::new();
    Ok(())
}

// --- FM26 Signature-Based Scanner ---

/// Scan game_plugin.dll for the human_manager_registry signature.
/// Returns the absolute address of the registry global.
fn find_manager_registry(handle: HANDLE, gp_base: usize, gp_size: usize) -> Result<usize, String> {
    let sig = parser::parse_signature(parser::SIGNATURE);
    log::info!("Scanning game_plugin.dll (0x{:X}, {} MB) for manager registry signature...",
        gp_base, gp_size / (1024 * 1024));

    // Read module in 4 MB chunks with overlap (module may span non-contiguous pages)
    let chunk_size: usize = 4 * 1024 * 1024;
    let overlap = sig.len().saturating_sub(1);
    let mut sig_addr: Option<usize> = None;
    let mut offset: usize = 0;

    while offset < gp_size {
        let read_start = if offset == 0 { 0 } else { offset.saturating_sub(overlap) };
        let read_size = chunk_size.saturating_add(if offset == 0 { 0 } else { overlap }).min(gp_size - read_start);
        let chunk_base = gp_base + read_start;

        let chunk = match memory::read_memory(handle, chunk_base, read_size) {
            Ok(d) => d,
            Err(_) => { offset += chunk_size; continue; }
        };

        let hits = memory::scan_data_for_pattern(&chunk, &sig);
        for &hit_off in &hits {
            let abs = read_start + hit_off;
            if offset != 0 && abs < offset { continue; } // skip overlap duplicates
            sig_addr = Some(gp_base + abs);
            break;
        }
        if sig_addr.is_some() { break; }
        offset += chunk_size;
    }

    let sig_addr = sig_addr.ok_or("Manager registry signature not found in game_plugin.dll. Build mismatch?")?;
    log::info!("Signature found at 0x{:X}", sig_addr);

    let registry_ptr_addr = parser::resolve_rip_relative(handle, sig_addr)
        .ok_or("Failed to resolve RIP-relative displacement")?;

    let registry = memory::read_ptr(handle, registry_ptr_addr)
        .map_err(|e| format!("Cannot read registry pointer at 0x{:X}: {}", registry_ptr_addr, e))?;

    if registry < 0x10000 {
        return Err(format!("Registry pointer is null/invalid: 0x{:X}", registry));
    }

    log::info!("Manager registry at 0x{:X}", registry);
    Ok(registry)
}

/// Info about a managed team found in the manager registry.
struct ManagedTeamInfo {
    team_ptr: usize,
    mgr_name: String,
    nationality: String,
    club_name: String,
    league_name: String,
    club_rep: u16,
    player_ptrs: Vec<usize>,
}

/// Walk the manager registry vector to find ALL human manager teams (club + national team).
fn find_all_managed_teams(
    handle: HANDLE,
    registry: usize,
) -> Result<Vec<ManagedTeamInfo>, String> {
    let vec_begin = memory::read_ptr(handle, registry + parser::MANAGER_REGISTRY_VECTOR_OFFSET)
        .map_err(|e| format!("Cannot read vector begin: {}", e))?;
    let vec_end = memory::read_ptr(handle, registry + parser::MANAGER_REGISTRY_VECTOR_OFFSET + 8)
        .map_err(|e| format!("Cannot read vector end: {}", e))?;

    if vec_begin < 0x10000 || vec_end <= vec_begin {
        return Err(format!("Invalid manager vector: begin=0x{:X} end=0x{:X}", vec_begin, vec_end));
    }

    let manager_count = (vec_end - vec_begin) / 8;
    log::info!("Manager registry has {} entries", manager_count);

    let mut teams: Vec<ManagedTeamInfo> = Vec::new();
    let mut first_person_base: usize = 0;

    for i in 0..manager_count.min(32) {
        let manager_ptr = match memory::read_ptr(handle, vec_begin + i * 8) {
            Ok(p) if p > 0x10000 => p,
            _ => continue,
        };

        let person_ptr_val = memory::read_ptr(handle, manager_ptr + parser::HUMAN_PERSON_OFFSET).unwrap_or(0);
        let person_base = if person_ptr_val > 0x100_0000_0000 && person_ptr_val < 0x800_0000_0000 {
            let test = memory::read_fm_string(handle, person_ptr_val + parser::PERSON_FIRST_NAME_OFFSET);
            if !test.is_empty() && test.len() >= 2 { person_ptr_val }
            else { manager_ptr + parser::HUMAN_PERSON_OFFSET }
        } else {
            manager_ptr + parser::HUMAN_PERSON_OFFSET
        };

        let first = memory::read_fm_string(handle, person_base + parser::PERSON_FIRST_NAME_OFFSET);
        let last = memory::read_fm_string(handle, person_base + parser::PERSON_SECOND_NAME_OFFSET);
        if first.is_empty() && last.is_empty() { continue; }

        // Only collect teams for the SAME human manager (first one found)
        if first_person_base == 0 {
            first_person_base = person_base;
        } else if person_base != first_person_base {
            // Different person — check if name matches (in case embedded offsets differ)
            let first_first = memory::read_fm_string(handle, first_person_base + parser::PERSON_FIRST_NAME_OFFSET);
            let first_last = memory::read_fm_string(handle, first_person_base + parser::PERSON_SECOND_NAME_OFFSET);
            if first != first_first || last != first_last {
                continue; // Different manager, skip
            }
        }

        let mgr_name = if !first.is_empty() && !last.is_empty() {
            format!("{} {}", first, last)
        } else if !last.is_empty() { last.clone() } else { first.clone() };

        let nationality = if let Ok(nation_ptr) = memory::read_ptr(handle, person_base + parser::PERSON_NATIONALITY_OFFSET) {
            if nation_ptr > 0x10000 {
                memory::read_fm_string(handle, nation_ptr + parser::NATION_NAME_OFFSET)
            } else { String::new() }
        } else { String::new() };

        let contract_ptr = match memory::read_ptr(handle, person_base + parser::PERSON_CONTRACT_OFFSET) {
            Ok(p) if p > 0x10000 => p,
            _ => continue,
        };

        let team_ptr = match memory::read_ptr(handle, contract_ptr + parser::CONTRACT_TEAM_OFFSET) {
            Ok(p) if p > 0x10000 => p,
            _ => continue,
        };

        // Skip if we already found this team
        if teams.iter().any(|t| t.team_ptr == team_ptr) { continue; }

        let players_start = match memory::read_ptr(handle, team_ptr + parser::TEAM_PLAYERS_START_OFFSET) {
            Ok(p) if p > 0x10000 => p,
            _ => continue,
        };
        let players_end = match memory::read_ptr(handle, team_ptr + parser::TEAM_PLAYERS_END_OFFSET) {
            Ok(p) if p > players_start => p,
            _ => continue,
        };

        let player_count = (players_end - players_start) / 8;
        if player_count == 0 || player_count > 200 { continue; }

        let club_ptr = memory::read_ptr(handle, team_ptr + parser::TEAM_CLUB_OFFSET).unwrap_or(0);
        let club_name = if club_ptr > 0x10000 {
            memory::read_fm_string(handle, club_ptr + parser::CLUB_NAME_OFFSET)
        } else { String::new() };

        let club_rep = memory::read_u16(handle, club_ptr + parser::PLAYER_WORLD_REP_OFFSET).unwrap_or(0);

        let mut league_name = String::new();
        for comp_off in [parser::TEAM_COMP_OFFSET, parser::TEAM_COMP_ALT_OFFSET] {
            if let Ok(comp_ptr) = memory::read_ptr(handle, team_ptr + comp_off) {
                if comp_ptr > 0x10000 {
                    let name = memory::read_fm_string(handle, comp_ptr + parser::COMP_NAME_OFFSET);
                    if !name.is_empty() && name.len() >= 3 { league_name = name; break; }
                    let short = memory::read_fm_string(handle, comp_ptr + parser::COMP_SHORT_NAME_OFFSET);
                    if !short.is_empty() && short.len() >= 3 { league_name = short; break; }
                }
            }
        }

        log::info!("Manager {}: {} — {} ({}) — {} — {} players",
            i, mgr_name, club_name, nationality, league_name, player_count);

        let mut player_ptrs = Vec::new();
        for j in 0..player_count {
            if let Ok(pp) = memory::read_ptr(handle, players_start + j * 8) {
                if pp > 0x10000 { player_ptrs.push(pp); }
            }
        }

        teams.push(ManagedTeamInfo {
            team_ptr, mgr_name, nationality, club_name,
            league_name, club_rep, player_ptrs,
        });

        // Found at least one team; keep going to find national team too
        if teams.len() >= 3 { break; } // Unlikely to manage more than 2-3
    }

    if teams.is_empty() {
        Err("No valid human manager found in registry".into())
    } else {
        Ok(teams)
    }
}

/// Probe the club struct for youth/reserve team pointers.
/// Returns a list of (team_name, player_ptrs) for each non-first-team found.
fn probe_youth_teams(
    handle: HANDLE,
    club_ptr: usize,
    first_team_ptr: usize,
    game_year: u16,
) -> Vec<(String, Vec<usize>)> {
    let mut result: Vec<(String, Vec<usize>)> = Vec::new();
    if club_ptr < 0x10000 { return result; }

    // Probe club struct for team-like pointers (objects with valid player vectors)
    // FM club structs typically have team ptrs within the first 512 bytes
    let mut found_ptrs: Vec<usize> = Vec::new();

    for offset in (0x00..0x200usize).step_by(8) {
        let ptr = match memory::read_ptr(handle, club_ptr + offset) {
            Ok(p) if p > 0x10000 && p < 0x800_0000_0000 => p,
            _ => continue,
        };
        if ptr == first_team_ptr { continue; }
        if found_ptrs.contains(&ptr) { continue; }

        // Check if this looks like a team object (has player vector at standard offsets)
        let ps = memory::read_ptr(handle, ptr + parser::TEAM_PLAYERS_START_OFFSET).unwrap_or(0);
        let pe = memory::read_ptr(handle, ptr + parser::TEAM_PLAYERS_END_OFFSET).unwrap_or(0);
        if ps < 0x10000 || pe <= ps { continue; }
        let count = (pe - ps) / 8;
        if count == 0 || count > 150 { continue; }

        // Verify: the team's club pointer should point back to our club
        let team_club = memory::read_ptr(handle, ptr + parser::TEAM_CLUB_OFFSET).unwrap_or(0);
        if team_club != club_ptr { continue; }

        // This is a sub-team of our club! Read its competition name for classification.
        let mut team_name = String::new();
        for comp_off in [parser::TEAM_COMP_OFFSET, parser::TEAM_COMP_ALT_OFFSET] {
            if let Ok(comp_ptr) = memory::read_ptr(handle, ptr + comp_off) {
                if comp_ptr > 0x10000 {
                    let name = memory::read_fm_string(handle, comp_ptr + parser::COMP_NAME_OFFSET);
                    if !name.is_empty() && name.len() >= 3 { team_name = name; break; }
                    let short = memory::read_fm_string(handle, comp_ptr + parser::COMP_SHORT_NAME_OFFSET);
                    if !short.is_empty() && short.len() >= 3 { team_name = short; break; }
                }
            }
        }

        // Read player pointers
        let mut player_ptrs = Vec::new();
        for j in 0..count {
            if let Ok(pp) = memory::read_ptr(handle, ps + j * 8) {
                if pp > 0x10000 { player_ptrs.push(pp); }
            }
        }

        if player_ptrs.is_empty() { continue; }

        // Classify the team
        let name_lower = team_name.to_lowercase();
        let label = if name_lower.contains("u18") || name_lower.contains("u-18") || name_lower.contains("youth") || name_lower.contains("academy") || name_lower.contains("juvenil") {
            if team_name.is_empty() { "U18 / Youth".to_string() } else { team_name.clone() }
        } else if name_lower.contains("u21") || name_lower.contains("u-21") || name_lower.contains("u23") || name_lower.contains("u-23")
            || name_lower.contains("reserve") || name_lower.contains("development") || name_lower.contains("primavera") || name_lower.contains("jong") || name_lower.contains("b team") {
            if team_name.is_empty() { "U21 / Reserve".to_string() } else { team_name.clone() }
        } else if name_lower.contains("u19") || name_lower.contains("u-19") {
            if team_name.is_empty() { "U19".to_string() } else { team_name.clone() }
        } else if team_name.is_empty() {
            // Classify by average age of first few players
            let mut total_age = 0u32;
            let mut age_count = 0u32;
            for &pp in player_ptrs.iter().take(10) {
                if let Some(p) = parser::parse_player_at(handle, pp, game_year) {
                    total_age += p.age as u32;
                    age_count += 1;
                }
            }
            let avg = if age_count > 0 { total_age / age_count } else { 20 };
            if avg <= 18 { "U18 / Youth".to_string() }
            else { "U21 / Reserve".to_string() }
        } else {
            team_name.clone()
        };

        log::info!("Youth team found: {} — {} players (club+0x{:X})", label, player_ptrs.len(), offset);
        found_ptrs.push(ptr);
        result.push((label, player_ptrs));

        if result.len() >= 4 { break; }
    }

    result
}

/// Scan private memory for all player objects that share the same vtable as known players.
fn scan_wider_database(
    handle: HANDLE,
    known_player_ptrs: &[usize],
    app: &AppHandle,
) -> Vec<usize> {
    if known_player_ptrs.is_empty() {
        return Vec::new();
    }

    let vtable = match memory::read_ptr(handle, known_player_ptrs[0]) {
        Ok(vt) if vt > 0x10000 => vt,
        _ => return Vec::new(),
    };

    let confirmed = known_player_ptrs.iter().all(|&pp| {
        memory::read_ptr(handle, pp).unwrap_or(0) == vtable
    });
    if !confirmed {
        log::warn!("Squad players have inconsistent vtables — cannot scan wider database");
        return Vec::new();
    }

    log::info!("Player vtable: 0x{:X} — scanning private memory for all player objects...", vtable);

    let regions = memory::scan_private_regions(handle, 8 * 1024 * 1024 * 1024);
    let total_mb: usize = regions.iter().map(|(_, s)| s).sum::<usize>() / (1024 * 1024);
    log::info!("Scanning {} private regions ({} MB)", regions.len(), total_mb);

    let known_set: HashSet<usize> = known_player_ptrs.iter().copied().collect();
    let vtable_bytes = vtable.to_le_bytes();
    let mut all_ptrs = Vec::new();
    let mut scanned = 0usize;

    for &(region_base, region_size) in &regions {
        scanned += 1;
        if scanned % 200 == 0 {
            app.emit("load_progress", LoadProgress {
                stage: "scanning".into(),
                current: scanned, total: regions.len(),
                message: format!("Scanning region {}/{} — {} players found", scanned, regions.len(), all_ptrs.len()),
            }).ok();
        }

        if region_size < 8 { continue; }

        let data = match memory::read_memory(handle, region_base, region_size) {
            Ok(d) => d,
            Err(_) => continue,
        };

        let aligned_start = (8 - (region_base & 7)) & 7;
        let mut pos = aligned_start;
        while pos + 8 <= data.len() {
            if data[pos..pos + 8] == vtable_bytes {
                let candidate = region_base + pos;
                if !known_set.contains(&candidate) {
                    all_ptrs.push(candidate);
                }
            }
            pos += 8;
        }
    }

    log::info!("Vtable scan found {} additional player candidates", all_ptrs.len());
    all_ptrs
}

#[tauri::command]
pub fn scan_for_players(app: AppHandle, state: State<'_, AppState>) -> Result<usize, String> {
    let proc_guard = state.process.lock().unwrap();
    let proc = proc_guard.as_ref().ok_or("Not connected to FM")?;
    let handle = proc.handle;

    let mut all_players: Vec<Player> = Vec::new();

    // Phase 1: Signature-based squad reading
    if proc.game_plugin_base > 0 {
        app.emit("load_progress", LoadProgress {
            stage: "scanning".into(), current: 0, total: 3,
            message: "Scanning game_plugin.dll for manager registry...".into(),
        }).ok();

        match find_manager_registry(handle, proc.game_plugin_base, proc.game_plugin_size) {
            Ok(registry) => {
                app.emit("load_progress", LoadProgress {
                    stage: "scanning".into(), current: 1, total: 3,
                    message: "Following pointer chain to managed squad...".into(),
                }).ok();

                match find_all_managed_teams(handle, registry) {
                    Ok(teams) => {
                        // First team = club, subsequent teams may be national team
                        let club_team = &teams[0];
                        let mgr_name = club_team.mgr_name.clone();
                        let nationality = club_team.nationality.clone();
                        let club_name = club_team.club_name.clone();
                        let league_name = club_team.league_name.clone();
                        let club_rep = club_team.club_rep;
                        let player_ptrs = &club_team.player_ptrs;

                        // Detect national team: look for a second team where club_name
                        // matches the manager's nationality or has no domestic league
                        let mut national_team_name = String::new();
                        if teams.len() > 1 {
                            for nt in &teams[1..] {
                                log::info!("Possible national team: {} — league: {}", nt.club_name, nt.league_name);
                                national_team_name = nt.club_name.clone();
                            }
                        }

                        log::info!("Managed team: {} ({}) — {} player pointers", club_name, league_name, player_ptrs.len());

                        let game_year = if let Some(&first) = player_ptrs.first() {
                            parser::read_game_date(handle, first).unwrap_or(2025)
                        } else { 2025 };
                        *state.game_year.lock().unwrap() = game_year;
                        log::info!("Game year: {}", game_year);

                        app.emit("load_progress", LoadProgress {
                            stage: "loading".into(), current: 0, total: player_ptrs.len(),
                            message: format!("Parsing {} squad players...", player_ptrs.len()),
                        }).ok();

                        let mut squad_player_ids: HashSet<u32> = HashSet::new();

                        for (i, &pp) in player_ptrs.iter().enumerate() {
                            if let Some(player) = parser::parse_player_at(handle, pp, game_year) {
                                log::info!("  [{}] {} — {} ({}) — CA {} / PA {} — £{} — £{}/w",
                                    i, player.display_name(), player.natural_position, player.club_name,
                                    player.current_ability, player.potential_ability, player.value, player.wage);
                                squad_player_ids.insert(player.id);
                                all_players.push(player);
                            }
                        }

                        log::info!("Parsed {} squad players successfully", all_players.len());

                        // Build manager profile from squad
                        let squad_players: Vec<&Player> = all_players.iter().filter(|p| squad_player_ids.contains(&p.id)).collect();
                        let avg_ca = if !squad_players.is_empty() {
                            squad_players.iter().map(|p| p.current_ability as f32).sum::<f32>() / squad_players.len() as f32
                        } else { 0.0 };
                        let avg_age = if !squad_players.is_empty() {
                            squad_players.iter().map(|p| p.age as f32).sum::<f32>() / squad_players.len() as f32
                        } else { 0.0 };
                        let avg_world_rep = if !squad_players.is_empty() {
                            squad_players.iter().map(|p| p.world_reputation as f32).sum::<f32>() / squad_players.len() as f32
                        } else { 0.0 };
                        let total_value: u64 = squad_players.iter().map(|p| p.value).sum();
                        let total_wage: u64 = squad_players.iter().map(|p| p.wage as u64).sum();
                        let highest_wage: u32 = squad_players.iter().map(|p| p.wage).max().unwrap_or(0);

                        *state.manager_profile.lock().unwrap() = Some(ManagerProfile {
                            name: mgr_name.clone(),
                            club_name: club_name.clone(),
                            nationality: nationality.clone(),
                            club_reputation: club_rep,
                            league_name: league_name.clone(),
                            squad_size: squad_players.len(),
                            squad_avg_ca: avg_ca,
                            squad_avg_age: avg_age,
                            squad_avg_world_rep: avg_world_rep,
                            squad_total_value: total_value,
                            squad_total_wage: total_wage,
                            squad_highest_wage: highest_wage,
                            game_year,
                            national_team_name: national_team_name.clone(),
                        });
                        *state.squad_ids.lock().unwrap() = squad_player_ids;

                        // Phase 2: Wider database via vtable scanning
                        app.emit("load_progress", LoadProgress {
                            stage: "scanning".into(), current: 2, total: 3,
                            message: format!("Scanning wider database (squad: {} players)...", all_players.len()),
                        }).ok();

                        let wider_ptrs = scan_wider_database(handle, &player_ptrs, &app);
                        let wider_total = wider_ptrs.len();

                        if !wider_ptrs.is_empty() {
                            let mut seen_ids: HashSet<u32> = all_players.iter().map(|p| p.id).collect();
                            let mut parsed = 0usize;

                            for (i, &pp) in wider_ptrs.iter().enumerate() {
                                if i % 1000 == 0 {
                                    app.emit("load_progress", LoadProgress {
                                        stage: "loading".into(),
                                        current: all_players.len(),
                                        total: wider_total + player_ptrs.len(),
                                        message: format!("Parsing player {}/{}...", i, wider_total),
                                    }).ok();
                                }

                                if let Some(player) = parser::parse_player_at(handle, pp, game_year) {
                                    if !seen_ids.contains(&player.id) {
                                        seen_ids.insert(player.id);
                                        all_players.push(player);
                                        parsed += 1;
                                    }
                                }
                            }
                            log::info!("Wider scan: parsed {} additional players from {} candidates", parsed, wider_total);
                        }

                        // Phase 3: Probe club struct for youth/reserve teams
                        let club_ptr = memory::read_ptr(handle, club_team.team_ptr + parser::TEAM_CLUB_OFFSET).unwrap_or(0);
                        if club_ptr > 0x10000 {
                            let youth_raw = probe_youth_teams(handle, club_ptr, club_team.team_ptr, game_year);
                            let all_loaded: std::collections::HashMap<u32, &Player> = all_players.iter().map(|p| (p.id, p)).collect();
                            let mut youth_teams_out: Vec<YouthTeam> = Vec::new();

                            for (team_name, ptrs) in &youth_raw {
                                let mut ids = Vec::new();
                                let mut total_ca = 0f32;
                                let mut total_age = 0f32;
                                for &pp in ptrs {
                                    if let Some(p) = parser::parse_player_at(handle, pp, game_year) {
                                        ids.push(p.id);
                                        total_ca += p.current_ability as f32;
                                        total_age += p.age as f32;
                                    }
                                }
                                let n = ids.len();
                                if n == 0 { continue; }
                                youth_teams_out.push(YouthTeam {
                                    name: team_name.clone(),
                                    player_count: n,
                                    player_ids: ids,
                                    avg_ca: total_ca / n as f32,
                                    avg_age: total_age / n as f32,
                                });
                                log::info!("Youth team '{}': {} players, avg CA {:.0}, avg age {:.1}",
                                    team_name, n, total_ca / n as f32, total_age / n as f32);
                            }

                            // If probe found nothing, fallback: any same-club player not in first-team
                            if youth_teams_out.is_empty() {
                                let squad_ids_ref = state.squad_ids.lock().unwrap();
                                let club_lower = club_name.to_lowercase();
                                let mut u21_ids = Vec::new();
                                let mut u18_ids = Vec::new();
                                for p in all_players.iter() {
                                    if p.club_name.to_lowercase() == club_lower && !squad_ids_ref.contains(&p.id) {
                                        if p.age <= 17 { u18_ids.push(p.id); }
                                        else { u21_ids.push(p.id); }
                                    }
                                }
                                if !u21_ids.is_empty() {
                                    let avg_ca = u21_ids.iter().filter_map(|id| all_loaded.get(id)).map(|p| p.current_ability as f32).sum::<f32>() / u21_ids.len() as f32;
                                    let avg_age = u21_ids.iter().filter_map(|id| all_loaded.get(id)).map(|p| p.age as f32).sum::<f32>() / u21_ids.len() as f32;
                                    youth_teams_out.push(YouthTeam { name: "U21 / Reserve".into(), player_count: u21_ids.len(), player_ids: u21_ids, avg_ca, avg_age });
                                }
                                if !u18_ids.is_empty() {
                                    let avg_ca = u18_ids.iter().filter_map(|id| all_loaded.get(id)).map(|p| p.current_ability as f32).sum::<f32>() / u18_ids.len() as f32;
                                    let avg_age = u18_ids.iter().filter_map(|id| all_loaded.get(id)).map(|p| p.age as f32).sum::<f32>() / u18_ids.len() as f32;
                                    youth_teams_out.push(YouthTeam { name: "U18 / Youth".into(), player_count: u18_ids.len(), player_ids: u18_ids, avg_ca, avg_age });
                                }
                            }

                            *state.youth_teams.lock().unwrap() = youth_teams_out;
                        }

                        // Phase 4: Probe for coaching staff
                        app.emit("load_progress", LoadProgress {
                            stage: "scanning".into(), current: 2, total: 3,
                            message: "Discovering staff vtable...".into(),
                        }).ok();

                        let player_vtable = memory::read_ptr(handle, player_ptrs[0]).unwrap_or(0);
                        let staff_vtable = parser::discover_staff_vtable(
                            handle, club_team.team_ptr, player_vtable
                        );

                        let mut all_staff: Vec<StaffMember> = Vec::new();

                        if let Some(svt) = staff_vtable {
                            log::info!("Staff vtable: 0x{:X} — scanning for all staff...", svt);

                            app.emit("load_progress", LoadProgress {
                                stage: "scanning".into(), current: 2, total: 3,
                                message: format!("Scanning for all staff (vtable 0x{:X})...", svt),
                            }).ok();

                            // Reuse the same regions we scanned for players
                            let regions = memory::scan_private_regions(handle, 8 * 1024 * 1024 * 1024);
                            let vtable_bytes = svt.to_le_bytes();
                            let mut staff_ptrs: Vec<usize> = Vec::new();
                            let mut scanned = 0usize;

                            for &(region_base, region_size) in &regions {
                                scanned += 1;
                                if scanned % 200 == 0 {
                                    app.emit("load_progress", LoadProgress {
                                        stage: "scanning".into(),
                                        current: scanned, total: regions.len(),
                                        message: format!("Staff scan: region {}/{} — {} found",
                                            scanned, regions.len(), staff_ptrs.len()),
                                    }).ok();
                                }
                                if region_size < 8 { continue; }
                                let data = match memory::read_memory(handle, region_base, region_size) {
                                    Ok(d) => d,
                                    Err(_) => continue,
                                };
                                let aligned_start = (8 - (region_base & 7)) & 7;
                                let mut pos = aligned_start;
                                while pos + 8 <= data.len() {
                                    if data[pos..pos + 8] == vtable_bytes {
                                        staff_ptrs.push(region_base + pos);
                                    }
                                    pos += 8;
                                }
                            }

                            log::info!("Staff vtable scan found {} candidates", staff_ptrs.len());

                            // Parse each staff candidate
                            let mut seen_ids: HashSet<u32> = HashSet::new();
                            for (i, &sp) in staff_ptrs.iter().enumerate() {
                                if i % 2000 == 0 && i > 0 {
                                    app.emit("load_progress", LoadProgress {
                                        stage: "loading".into(),
                                        current: all_staff.len(),
                                        total: staff_ptrs.len(),
                                        message: format!("Parsing staff {}/{}...", i, staff_ptrs.len()),
                                    }).ok();
                                }

                                let person_base = match parser::find_staff_person_base(handle, sp) {
                                    Some(pb) => pb,
                                    None => continue,
                                };

                                let first = memory::read_fm_string(handle, person_base + parser::PERSON_FIRST_NAME_OFFSET);
                                let last = memory::read_fm_string(handle, person_base + parser::PERSON_SECOND_NAME_OFFSET);
                                if first.is_empty() && last.is_empty() { continue; }

                                let uid = memory::read_u32(handle, sp + parser::ENTITY_UID_OFFSET).unwrap_or(0);
                                if uid > 0 && seen_ids.contains(&uid) { continue; }
                                if uid > 0 { seen_ids.insert(uid); }

                                let full_name = if !first.is_empty() && !last.is_empty() {
                                    format!("{} {}", first, last)
                                } else if !last.is_empty() { last } else { first };

                                let nationality = if let Ok(nat_ptr) = memory::read_ptr(handle, person_base + parser::PERSON_NATIONALITY_OFFSET) {
                                    if nat_ptr > 0x10000 { memory::read_fm_string(handle, nat_ptr + parser::NATION_NAME_OFFSET) }
                                    else { String::new() }
                                } else { String::new() };

                                let dob_raw = memory::read_u32(handle, person_base + parser::PERSON_BIRTH_DATE_OFFSET).unwrap_or(0);
                                let (birth_year, _) = parser::decode_fm_date(dob_raw);
                                let age = if birth_year >= 1940 && birth_year <= 2010 && game_year >= birth_year {
                                    (game_year - birth_year) as u8
                                } else { 0 };

                                // Skip likely-invalid entries
                                if age == 0 { continue; }

                                // Read club/team from contract chain
                                let team_name = {
                                    let contract_ptr = memory::read_ptr(handle, person_base + parser::PERSON_CONTRACT_OFFSET).unwrap_or(0);
                                    if contract_ptr > 0x10000 {
                                        let team_ptr = memory::read_ptr(handle, contract_ptr + parser::CONTRACT_TEAM_OFFSET).unwrap_or(0);
                                        if team_ptr > 0x10000 {
                                            let club_p = memory::read_ptr(handle, team_ptr + parser::TEAM_CLUB_OFFSET).unwrap_or(0);
                                            if club_p > 0x10000 {
                                                memory::read_fm_string(handle, club_p + parser::CLUB_NAME_OFFSET)
                                            } else { String::new() }
                                        } else { String::new() }
                                    } else { String::new() }
                                };

                                // Probe for coaching attributes — search the staff object for
                                // blocks of 8+ consecutive bytes in 1-20 range with good quality
                                let coaching = probe_coaching_attrs(handle, sp, person_base);

                                all_staff.push(StaffMember {
                                    name: full_name,
                                    age,
                                    nationality,
                                    team_name,
                                    coaching,
                                });
                            }

                            log::info!("Parsed {} valid staff members from {} candidates",
                                all_staff.len(), staff_ptrs.len());

                        } else {
                            log::warn!("Could not discover staff vtable — falling back to team probing");
                            let player_ptr_set: HashSet<usize> = {
                                let mut s: HashSet<usize> = player_ptrs.iter().cloned().collect();
                                s.extend(wider_ptrs.iter());
                                s
                            };
                            let first_team_staff = probe_team_staff(
                                handle, club_team.team_ptr, &player_ptr_set, game_year, &club_name
                            );
                            all_staff.extend(first_team_staff);
                        }

                        // Probe club facilities
                        if club_ptr > 0x10000 {
                            let fac = probe_club_facilities(handle, club_ptr);
                            if let Some(ref f) = fac {
                                log::info!("Club facilities: training={} youth={} jr_coaching={} youth_rec={} corp={} importance={}",
                                    f.training, f.youth_facilities, f.junior_coaching,
                                    f.youth_recruitment, f.corporate, f.youth_importance);
                            }
                            *state.club_facilities.lock().unwrap() = fac;
                        }

                        log::info!("Total staff loaded: {}", all_staff.len());
                        *state.staff.lock().unwrap() = all_staff;
                    }
                    Err(e) => {
                        log::warn!("Could not find managed team: {} — falling back to region scan", e);
                        fallback_region_scan(handle, &app, &mut all_players);
                    }
                }
            }
            Err(e) => {
                log::warn!("Signature scan failed: {} — falling back to region scan", e);
                fallback_region_scan(handle, &app, &mut all_players);
            }
        }
    } else {
        log::warn!("game_plugin.dll not loaded — using fallback region scan");
        fallback_region_scan(handle, &app, &mut all_players);
    }

    drop(proc_guard);

    // Sort by estimated CA descending
    all_players.sort_by(|a, b| b.current_ability.cmp(&a.current_ability));

    let count = all_players.len();
    log::info!("Total: {} players loaded", count);

    app.emit("load_progress", LoadProgress {
        stage: "done".into(), current: count, total: count,
        message: format!("Loaded {} players", count),
    }).ok();

    *state.players.lock().unwrap() = all_players;
    if let Some(info) = state.game_info.lock().unwrap().as_mut() {
        info.player_count = count;
    }

    Ok(count)
}

/// Fallback: scan all memory regions for player attribute clusters (when signature fails)
fn fallback_region_scan(handle: HANDLE, app: &AppHandle, players: &mut Vec<Player>) {
    app.emit("load_progress", LoadProgress {
        stage: "scanning".into(), current: 0, total: 0,
        message: "Fallback: scanning memory regions for attribute patterns...".into(),
    }).ok();

    let regions = memory::scan_memory_regions(handle);
    log::info!("Fallback scan: {} regions", regions.len());

    let mut id_counter = 1u32;
    let mut scanned = 0;

    for &(region_base, region_size) in &regions {
        scanned += 1;
        if scanned % 100 == 0 {
            app.emit("load_progress", LoadProgress {
                stage: "scanning".into(), current: scanned, total: regions.len(),
                message: format!("Region {}/{} — {} players", scanned, regions.len(), players.len()),
            }).ok();
        }

        if region_size < 1024 || region_size > 50_000_000 { continue; }

        let data = match memory::read_memory(handle, region_base, region_size.min(20_000_000)) {
            Ok(d) => d,
            Err(_) => continue,
        };

        // Look for 54-byte blocks where most values are 1-99 (FM internal attribute scale)
        let mut offset = 0;
        while offset + 700 <= data.len() {
            let attr_start = offset + parser::PLAYER_ATTRIBUTES_OFFSET;
            if attr_start + 54 > data.len() { break; }

            let attr_block = &data[attr_start..attr_start + 54];
            let valid = attr_block.iter().filter(|&&b| b >= 1 && b <= 99).count();

            if valid >= 30 {
                let player_addr = region_base + offset;
                if let Some(mut p) = parser::parse_player_at(handle, player_addr, 2025) {
                    if p.id == 0 { p.id = id_counter; }
                    id_counter += 1;
                    players.push(p);
                    offset += 700; // skip past this player struct
                    continue;
                }
            }
            offset += 8;
        }
    }
}

fn attr_average(p: &Player) -> f32 {
    let vals = [
        p.technical.finishing, p.technical.passing, p.technical.dribbling,
        p.technical.tackling, p.technical.heading, p.technical.crossing,
        p.technical.first_touch, p.technical.technique,
        p.mental.composure, p.mental.decisions, p.mental.vision,
        p.mental.anticipation, p.mental.teamwork, p.mental.work_rate,
        p.physical.pace, p.physical.acceleration, p.physical.strength,
        p.physical.stamina,
    ];
    let sum: f32 = vals.iter().map(|&v| v as f32).sum();
    let count = vals.iter().filter(|&&v| v > 0).count().max(1);
    sum / count as f32
}

#[tauri::command]
pub fn get_players(state: State<'_, AppState>) -> Result<Vec<Player>, String> {
    Ok(state.players.lock().unwrap().clone())
}

#[tauri::command]
pub fn get_player_count(state: State<'_, AppState>) -> usize {
    state.players.lock().unwrap().len()
}

#[tauri::command]
pub fn export_csv(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let players = state.players.lock().unwrap();
    let mut wtr = csv::Writer::from_path(&path).map_err(|e| e.to_string())?;
    wtr.write_record(&[
        "Name", "Age", "Position", "Club", "Nationality", "Foot", "CA", "PA",
        "Value", "Wage", "Height", "Rep", "Contract",
        "Cor", "Cro", "Dri", "Fin", "Fir", "FK", "Hea", "LS", "Mar", "Pas", "Pen", "Tac", "Tec",
        "Agg", "Ant", "Bra", "Cmp", "Cnt", "Dec", "Det", "Fla", "Lea", "OtB", "Pos", "Tea", "Vis", "Wor",
        "Acc", "Agi", "Bal", "Jum", "NF", "Pac", "Sta", "Str",
        "Han", "Aer", "Cmd", "Com", "Kic", "Thr", "1v1", "Ref", "Ecc", "Rus", "Pun",
        "Con", "Dir", "Imp", "Inj", "Ver",
        "Adp", "Amb", "Loy", "Pre", "Pro", "Spo", "Tem", "Ctr",
    ]).map_err(|e| e.to_string())?;
    for p in players.iter() {
        wtr.write_record(&[
            p.display_name(), p.age.to_string(), p.natural_position.clone(),
            p.club_name.clone(), p.nationality.clone(), p.preferred_foot.clone(),
            p.current_ability.to_string(), p.potential_ability.to_string(),
            p.value.to_string(), p.wage.to_string(), p.height.to_string(),
            p.world_reputation.to_string(), p.contract_expiry.clone(),
            p.technical.corners.to_string(), p.technical.crossing.to_string(),
            p.technical.dribbling.to_string(), p.technical.finishing.to_string(),
            p.technical.first_touch.to_string(), p.technical.free_kick.to_string(),
            p.technical.heading.to_string(), p.technical.long_shots.to_string(),
            p.technical.marking.to_string(), p.technical.passing.to_string(),
            p.technical.penalty.to_string(), p.technical.tackling.to_string(),
            p.technical.technique.to_string(),
            p.mental.aggression.to_string(), p.mental.anticipation.to_string(),
            p.mental.bravery.to_string(), p.mental.composure.to_string(),
            p.mental.concentration.to_string(), p.mental.decisions.to_string(),
            p.mental.determination.to_string(), p.mental.flair.to_string(),
            p.mental.leadership.to_string(), p.mental.off_the_ball.to_string(),
            p.mental.positioning.to_string(), p.mental.teamwork.to_string(),
            p.mental.vision.to_string(), p.mental.work_rate.to_string(),
            p.physical.acceleration.to_string(), p.physical.agility.to_string(),
            p.physical.balance.to_string(), p.physical.jumping.to_string(),
            p.physical.natural_fitness.to_string(), p.physical.pace.to_string(),
            p.physical.stamina.to_string(), p.physical.strength.to_string(),
            p.goalkeeping.handling.to_string(), p.goalkeeping.aerial_reach.to_string(),
            p.goalkeeping.command_of_area.to_string(), p.goalkeeping.communication.to_string(),
            p.goalkeeping.kicking.to_string(), p.goalkeeping.throwing.to_string(),
            p.goalkeeping.one_on_ones.to_string(), p.goalkeeping.reflexes.to_string(),
            p.goalkeeping.eccentricity.to_string(), p.goalkeeping.rushing_out.to_string(),
            p.goalkeeping.punching.to_string(),
            p.hidden.consistency.to_string(), p.hidden.dirtiness.to_string(),
            p.hidden.important_matches.to_string(), p.hidden.injury_proneness.to_string(),
            p.hidden.versatility.to_string(),
            p.hidden.adaptability.to_string(), p.hidden.ambition.to_string(),
            p.hidden.loyalty.to_string(), p.hidden.pressure.to_string(),
            p.hidden.professionalism.to_string(), p.hidden.sportsmanship.to_string(),
            p.hidden.temperament.to_string(), p.hidden.controversy.to_string(),
        ]).map_err(|e| e.to_string())?;
    }
    wtr.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn export_json(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let players = state.players.lock().unwrap();
    let json = serde_json::to_string_pretty(&*players).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn search_players(
    state: State<'_, AppState>, query: String,
    min_ca: Option<i16>, max_age: Option<u8>, position: Option<String>,
) -> Result<Vec<Player>, String> {
    let players = state.players.lock().unwrap();
    let q = query.to_lowercase();
    Ok(players.iter().filter(|p| {
        (query.is_empty() || p.display_name().to_lowercase().contains(&q)
            || p.club_name.to_lowercase().contains(&q)
            || p.nationality.to_lowercase().contains(&q))
        && min_ca.map_or(true, |m| p.current_ability >= m)
        && max_age.map_or(true, |m| p.age <= m)
        && position.as_ref().map_or(true, |pos| {
            p.natural_position.to_lowercase().contains(&pos.to_lowercase())
        })
    }).cloned().collect())
}

/// CLI test mode — comprehensive diagnostic
pub fn cli_test() {
    println!("=== FM Scout Pro CLI Test ===\n");

    print!("1. Finding FM process... ");
    let (_pid, _title) = match memory::find_fm_process() {
        Ok(v) => { println!("FOUND — PID: {}, \"{}\"", v.0, v.1); v }
        Err(e) => { println!("FAILED — {}", e); return; }
    };

    print!("2. Attaching... ");
    let proc = match memory::attach_to_fm() {
        Ok(p) => {
            println!("OK — fm.exe base: 0x{:X}, game_plugin.dll: 0x{:X} ({} MB)",
                p.base_address, p.game_plugin_base, p.game_plugin_size / (1024*1024));
            p
        }
        Err(e) => { println!("FAILED — {}", e); return; }
    };

    if proc.game_plugin_base == 0 {
        println!("\n   WARNING: game_plugin.dll not found.");
        return;
    }

    // Scan for signature with full diagnostics
    let sig = parser::parse_signature(parser::SIGNATURE);
    println!("\n3. Signature scan (chunked, 4 MB per read)...");

    let chunk_size: usize = 4 * 1024 * 1024;
    let overlap = sig.len().saturating_sub(1);
    let mut sig_offset: Option<usize> = None;
    let mut chunks_read = 0;
    let mut chunks_failed = 0;
    let mut offset: usize = 0;

    while offset < proc.game_plugin_size {
        let read_start = if offset == 0 { 0 } else { offset.saturating_sub(overlap) };
        let read_size = chunk_size.saturating_add(if offset == 0 { 0 } else { overlap }).min(proc.game_plugin_size - read_start);
        let chunk_base = proc.game_plugin_base + read_start;

        match memory::read_memory(proc.handle, chunk_base, read_size) {
            Ok(chunk) => {
                chunks_read += 1;
                let hits = memory::scan_data_for_pattern(&chunk, &sig);
                if !hits.is_empty() {
                    let abs = read_start + hits[0];
                    sig_offset = Some(abs);
                    println!("   FOUND in chunk {} at module offset 0x{:X}", chunks_read, abs);
                    break;
                }
            }
            Err(_) => { chunks_failed += 1; }
        }
        offset += chunk_size;
    }
    println!("   Chunks: {} read, {} failed, module size: {} MB",
        chunks_read, chunks_failed, proc.game_plugin_size / (1024*1024));

    let sig_offset = match sig_offset {
        Some(o) => o,
        None => { println!("   Signature NOT FOUND. Build mismatch."); return; }
    };

    let sig_addr = proc.game_plugin_base + sig_offset;
    println!("\n4. Resolving RIP-relative pointer...");
    println!("   Instruction at: 0x{:X}", sig_addr);

    let disp_bytes = match memory::read_memory(proc.handle, sig_addr + 3, 4) {
        Ok(b) => b,
        Err(e) => { println!("   Cannot read displacement: {}", e); return; }
    };
    let displacement = i32::from_le_bytes([disp_bytes[0], disp_bytes[1], disp_bytes[2], disp_bytes[3]]);
    let target = (sig_addr as i64 + 7 + displacement as i64) as usize;
    println!("   Displacement: {} (0x{:X})", displacement, displacement as u32);
    println!("   Target (registry ptr location): 0x{:X}", target);

    let registry = match memory::read_ptr(proc.handle, target) {
        Ok(r) => { println!("   Registry object: 0x{:X}", r); r }
        Err(e) => { println!("   Cannot read registry: {}", e); return; }
    };

    println!("\n5. Walking manager registry vector...");
    let vec_begin = memory::read_ptr(proc.handle, registry + 24).unwrap_or(0);
    let vec_end = memory::read_ptr(proc.handle, registry + 32).unwrap_or(0);
    println!("   Vector begin: 0x{:X}", vec_begin);
    println!("   Vector end:   0x{:X}", vec_end);

    if vec_begin < 0x10000 || vec_end <= vec_begin {
        // Try alternate vector offsets
        println!("   Vector looks invalid. Trying nearby offsets...");
        for test_off in [0, 8, 16, 24, 32, 40, 48, 56, 64, 72, 80] {
            let b = memory::read_ptr(proc.handle, registry + test_off).unwrap_or(0);
            let e = memory::read_ptr(proc.handle, registry + test_off + 8).unwrap_or(0);
            if b > 0x10000 && e > b && (e - b) / 8 <= 32 {
                println!("   +{}: begin=0x{:X} end=0x{:X} ({} entries) ← possible vector",
                    test_off, b, e, (e - b) / 8);
            } else {
                println!("   +{}: 0x{:X}", test_off, b);
            }
        }
        return;
    }

    let count = (vec_end - vec_begin) / 8;
    println!("   {} manager entries", count);

    for i in 0..count.min(8) {
        let mgr = memory::read_ptr(proc.handle, vec_begin + i * 8).unwrap_or(0);
        println!("\n   Manager[{}] at 0x{:X}", i, mgr);
        if mgr < 0x10000 { continue; }

        let person_base = mgr + parser::HUMAN_PERSON_OFFSET;
        let first = memory::read_fm_string(proc.handle, person_base + parser::PERSON_FIRST_NAME_OFFSET);
        let last = memory::read_fm_string(proc.handle, person_base + parser::PERSON_SECOND_NAME_OFFSET);
        let nation_ptr = memory::read_ptr(proc.handle, person_base + parser::PERSON_NATIONALITY_OFFSET).unwrap_or(0);
        let nation = if nation_ptr > 0x10000 {
            memory::read_fm_string(proc.handle, nation_ptr + parser::NATION_NAME_OFFSET)
        } else { String::new() };
        println!("     Person (embedded at +{}): {} {} — {}", parser::HUMAN_PERSON_OFFSET, first, last, nation);

        let contract_ptr = memory::read_ptr(proc.handle, person_base + parser::PERSON_CONTRACT_OFFSET).unwrap_or(0);
        println!("     Contract (person+168): 0x{:X}", contract_ptr);

        if contract_ptr > 0x10000 && contract_ptr < 0x800_0000_0000 {
            let team_ptr = memory::read_ptr(proc.handle, contract_ptr + parser::CONTRACT_TEAM_OFFSET).unwrap_or(0);
            println!("     Team (contract+16): 0x{:X}", team_ptr);

            if team_ptr > 0x10000 && team_ptr < 0x800_0000_0000 {
                let ps = memory::read_ptr(proc.handle, team_ptr + parser::TEAM_PLAYERS_START_OFFSET).unwrap_or(0);
                let pe = memory::read_ptr(proc.handle, team_ptr + parser::TEAM_PLAYERS_END_OFFSET).unwrap_or(0);
                let pc = if pe > ps { (pe - ps) / 8 } else { 0 };
                let club = memory::read_ptr(proc.handle, team_ptr + parser::TEAM_CLUB_OFFSET).unwrap_or(0);
                let club_name = if club > 0x10000 {
                    memory::read_fm_string(proc.handle, club + parser::CLUB_NAME_OFFSET)
                } else { String::new() };
                println!("     Club: \"{}\" — {} players", club_name, pc);

                if pc > 0 && pc < 200 && ps > 0x10000 {
                    let game_year = parser::read_game_date(proc.handle,
                        memory::read_ptr(proc.handle, ps).unwrap_or(0)).unwrap_or(2025);
                    println!("     Game year: {}\n", game_year);

                    for j in 0..pc.min(10) {
                        let pp = memory::read_ptr(proc.handle, ps + j * 8).unwrap_or(0);
                        if pp < 0x10000 { continue; }
                        match parser::parse_player_at(proc.handle, pp, game_year) {
                            Some(p) => println!("     [{}] {} — {} — {} — age {} — CA {} / PA {} — £{}",
                                j, p.display_name(), p.natural_position, p.club_name, p.age,
                                p.current_ability, p.potential_ability, p.value),
                            None => println!("     [{}] ptr 0x{:X} — parse failed", j, pp),
                        }
                    }
                }
            }
        } else {
            // Probe person struct for contract at nearby offsets
            println!("     Contract ptr invalid. Probing person struct...");
            let heap_min: usize = 0x100_0000_0000;
            let heap_max: usize = 0x800_0000_0000;
            for off in (100..400).step_by(8) {
                let ptr = memory::read_ptr(proc.handle, person_base + off).unwrap_or(0);
                if ptr < heap_min || ptr > heap_max { continue; }
                let team = memory::read_ptr(proc.handle, ptr + 16).unwrap_or(0);
                if team < heap_min || team > heap_max { continue; }
                let ps = memory::read_ptr(proc.handle, team + 56).unwrap_or(0);
                let pe = memory::read_ptr(proc.handle, team + 64).unwrap_or(0);
                if ps > heap_min && pe > ps && (pe - ps) / 8 > 0 && (pe - ps) / 8 < 200 {
                    let pc = (pe - ps) / 8;
                    let club = memory::read_ptr(proc.handle, team + 48).unwrap_or(0);
                    let cn = if club > 0x10000 { memory::read_fm_string(proc.handle, club + 192) } else { String::new() };
                    println!("     ★ person+{}: contract→team 0x{:X} → \"{}\" ({} players)",
                        off, team, cn, pc);
                }
            }
        }
    }

    println!("\n=== Test Complete ===");
}

// --- New IPC Commands ---

#[tauri::command]
pub async fn get_manager_profile(state: State<'_, AppState>) -> Result<Option<ManagerProfile>, String> {
    Ok(state.manager_profile.lock().unwrap().clone())
}

#[tauri::command]
pub async fn get_squad_ids(state: State<'_, AppState>) -> Result<Vec<u32>, String> {
    Ok(state.squad_ids.lock().unwrap().iter().cloned().collect())
}

#[tauri::command]
pub async fn get_my_squad(state: State<'_, AppState>) -> Result<Vec<Player>, String> {
    let ids = state.squad_ids.lock().unwrap().clone();
    let players = state.players.lock().unwrap();
    Ok(players.iter().filter(|p| ids.contains(&p.id)).cloned().collect())
}

#[tauri::command]
pub async fn get_listed_players(state: State<'_, AppState>) -> Result<Vec<Player>, String> {
    let players = state.players.lock().unwrap();
    Ok(players.iter().filter(|p| p.is_listed || p.transfer_status.contains("Listed")).cloned().collect())
}

#[tauri::command]
pub async fn get_free_agents(state: State<'_, AppState>) -> Result<Vec<Player>, String> {
    let players = state.players.lock().unwrap();
    Ok(players.iter().filter(|p| p.club_name.is_empty() || p.club_name == "Free Agent").cloned().collect())
}

#[tauri::command]
pub async fn get_youth_teams(state: State<'_, AppState>) -> Result<Vec<YouthTeam>, String> {
    Ok(state.youth_teams.lock().unwrap().clone())
}

/// Probe team struct for coaching staff vectors.
/// Staff are person-like objects (have valid names) but are NOT in the player list.
/// Coaching attributes are probed at candidate offsets in the person/staff struct.
fn probe_team_staff(
    handle: HANDLE,
    team_ptr: usize,
    player_ptrs: &HashSet<usize>,
    game_year: u16,
    team_label: &str,
) -> Vec<StaffMember> {
    let mut staff: Vec<StaffMember> = Vec::new();
    if team_ptr < 0x10000 { return staff; }

    let mut seen_names: HashSet<String> = HashSet::new();

    // Probe team struct for vectors that contain person-like objects
    for vec_off in (0x40..0x200usize).step_by(8) {
        if vec_off == parser::TEAM_PLAYERS_START_OFFSET as usize { continue; }
        // Also skip the players_end pointer offset
        if vec_off == parser::TEAM_PLAYERS_END_OFFSET as usize { continue; }
        let vs = memory::read_ptr(handle, team_ptr + vec_off).unwrap_or(0);
        let ve = memory::read_ptr(handle, team_ptr + vec_off + 8).unwrap_or(0);
        if vs < 0x10000 || ve <= vs { continue; }
        let count = (ve - vs) / 8;
        if count == 0 || count > 50 { continue; }

        let mut vec_has_staff = false;
        for j in 0..count {
            let ptr = match memory::read_ptr(handle, vs + j * 8) {
                Ok(p) if p > 0x10000 && p < 0x800_0000_0000 => p,
                _ => continue,
            };
            if player_ptrs.contains(&ptr) { continue; }

            // ── Check if this is a PLAYER (not staff) by reading CA/PA at player offsets ──
            // Players have valid CA (1-200) and PA (1-200) at known offsets.
            // Staff objects won't have meaningful values there.
            let maybe_ca = memory::read_u16(handle, ptr + parser::PLAYER_CA_OFFSET).unwrap_or(0);
            let maybe_pa = memory::read_u16(handle, ptr + parser::PLAYER_PA_OFFSET).unwrap_or(0);
            if maybe_ca >= 1 && maybe_ca <= 200 && maybe_pa >= 1 && maybe_pa <= 200 {
                // Also verify positions block looks like player positions (most are 1-20)
                if let Ok(pos_data) = memory::read_memory(handle, ptr + parser::PLAYER_POSITIONS_OFFSET, 15) {
                    let valid_pos = pos_data.iter().filter(|&&b| b >= 1 && b <= 20).count();
                    if valid_pos >= 5 {
                        log::debug!("Skipping player object at 0x{:X} (CA={} PA={}, {} valid positions)",
                            ptr, maybe_ca, maybe_pa, valid_pos);
                        continue; // This is a player, not staff
                    }
                }
            }

            // ── Try to find person data at the raw pointer (staff person is likely embedded) ──
            // Staff objects have person data at a different layout than players.
            // Try multiple strategies:
            //   1. Person directly at ptr + small offsets (0, 0x10, 0x20, 0x30, 0x40, 0x50)
            //   2. Person via pointer at ptr + known offsets
            let candidate_person_bases: Vec<usize> = {
                let mut bases = Vec::new();
                // Strategy 1: Person embedded at small offsets
                for off in (0..=0x80usize).step_by(0x10) {
                    let candidate = ptr + off;
                    let first = memory::read_fm_string(handle, candidate + parser::PERSON_FIRST_NAME_OFFSET);
                    let last = memory::read_fm_string(handle, candidate + parser::PERSON_SECOND_NAME_OFFSET);
                    if (!first.is_empty() && first.chars().any(|c| c.is_alphabetic()))
                        || (!last.is_empty() && last.chars().any(|c| c.is_alphabetic())) {
                        bases.push(candidate);
                        break;
                    }
                }
                // Strategy 2: Person via pointer at known player/manager offsets
                for &poff in &[parser::PLAYER_PERSON_OFFSET, parser::HUMAN_PERSON_OFFSET] {
                    if let Ok(pv) = memory::read_ptr(handle, ptr + poff) {
                        if pv > 0x10000 && pv < 0x800_0000_0000 {
                            let first = memory::read_fm_string(handle, pv + parser::PERSON_FIRST_NAME_OFFSET);
                            let last = memory::read_fm_string(handle, pv + parser::PERSON_SECOND_NAME_OFFSET);
                            if (!first.is_empty() && first.chars().any(|c| c.is_alphabetic()))
                                || (!last.is_empty() && last.chars().any(|c| c.is_alphabetic())) {
                                bases.push(pv);
                            }
                        }
                    }
                }
                bases
            };

            for person_base in candidate_person_bases {
                let first = memory::read_fm_string(handle, person_base + parser::PERSON_FIRST_NAME_OFFSET);
                let last = memory::read_fm_string(handle, person_base + parser::PERSON_SECOND_NAME_OFFSET);
                if first.is_empty() && last.is_empty() { continue; }

                let full_name = if !first.is_empty() && !last.is_empty() {
                    format!("{} {}", first, last)
                } else if !last.is_empty() { last.clone() } else { first.clone() };

                if seen_names.contains(&full_name) { continue; }

                let nationality = if let Ok(nat_ptr) = memory::read_ptr(handle, person_base + parser::PERSON_NATIONALITY_OFFSET) {
                    if nat_ptr > 0x10000 { memory::read_fm_string(handle, nat_ptr + parser::NATION_NAME_OFFSET) }
                    else { String::new() }
                } else { String::new() };

                let dob_raw = memory::read_u32(handle, person_base + parser::PERSON_BIRTH_DATE_OFFSET).unwrap_or(0);
                let (birth_year, _) = parser::decode_fm_date(dob_raw);
                let age = if birth_year >= 1940 && birth_year <= 2010 && game_year >= birth_year {
                    (game_year - birth_year) as u8
                } else { 0 };

                // ── Skip if age < 25 — very unlikely to be coaching staff ──
                if age > 0 && age < 25 {
                    log::debug!("Skipping {} age {} — too young for staff", full_name, age);
                    continue;
                }

                // ── Probe for coaching attributes ──
                // Search the object for ALL candidate blocks of 8+ bytes in 1-20 range,
                // then pick the one that looks most like coaching attrs (good average, variance).
                let mut coaching = CoachingAttrs::default();
                let personality_base = person_base + 0x70;

                // Read a wide area around the object
                let search_areas: Vec<(usize, usize)> = vec![
                    (ptr, 768),
                    (person_base.wrapping_sub(128), 512),
                ];

                let mut best_score = 0.0f64;

                for (search_base, search_len) in search_areas {
                    if search_base < 0x10000 { continue; }
                    if let Ok(chunk) = memory::read_memory(handle, search_base, search_len) {
                        // Find all runs of 8+ consecutive bytes in 1-20 range
                        let mut runs: Vec<(usize, usize)> = Vec::new();
                        let mut run_start = 0usize;
                        let mut run_len = 0usize;

                        for (i, &b) in chunk.iter().enumerate() {
                            let abs_addr = search_base + i;
                            // Skip known personality block
                            if abs_addr >= personality_base && abs_addr < personality_base + 8 {
                                if run_len >= 8 { runs.push((run_start, run_len)); }
                                run_len = 0;
                                continue;
                            }
                            if b >= 1 && b <= 20 {
                                if run_len == 0 { run_start = i; }
                                run_len += 1;
                            } else {
                                if run_len >= 8 { runs.push((run_start, run_len)); }
                                run_len = 0;
                            }
                        }
                        if run_len >= 8 { runs.push((run_start, run_len)); }

                        // Score each candidate run — pick the most "coaching-like" one
                        for (rs, rl) in runs {
                            let vals: Vec<u8> = (0..rl.min(14))
                                .map(|k| chunk.get(rs + k).copied().unwrap_or(0))
                                .collect();

                            let avg = vals.iter().map(|&v| v as f64).sum::<f64>() / vals.len() as f64;
                            let variance = vals.iter().map(|&v| {
                                let d = v as f64 - avg;
                                d * d
                            }).sum::<f64>() / vals.len() as f64;

                            // Count consecutive identical values (penalty for long streaks of 1s)
                            let mut max_streak = 1usize;
                            let mut cur_streak = 1usize;
                            for k in 1..vals.len() {
                                if vals[k] == vals[k - 1] { cur_streak += 1; max_streak = max_streak.max(cur_streak); }
                                else { cur_streak = 1; }
                            }

                            // Count how many values are exactly 1
                            let ones = vals.iter().filter(|&&v| v == 1).count();

                            // Score: coaching attrs typically average 8-14, have moderate variance,
                            // don't have long streaks of identical values, and few 1s
                            let mut score = 0.0f64;
                            // Prefer average in 7-15 range (coaching typical)
                            if avg >= 7.0 && avg <= 15.0 { score += 30.0; }
                            else if avg >= 5.0 && avg <= 17.0 { score += 15.0; }
                            else if avg < 3.0 { score -= 20.0; }
                            // Prefer moderate variance (not all same, not wild swings)
                            if variance >= 2.0 && variance <= 30.0 { score += 20.0; }
                            else if variance < 1.0 { score -= 10.0; }
                            // Penalize long streaks of same value
                            if max_streak >= 5 { score -= 30.0; }
                            else if max_streak >= 3 { score -= 10.0; }
                            // Penalize many 1s (unlikely for coaching attrs)
                            score -= ones as f64 * 5.0;
                            // Prefer runs of exactly 8-14 length (coaching has ~8-14 attrs)
                            if rl >= 8 && rl <= 16 { score += 10.0; }
                            // Prefer longer runs (more attrs found)
                            score += rl.min(14) as f64 * 1.5;

                            if score > best_score {
                                best_score = score;
                                let s = rs;
                                coaching.attacking    = chunk.get(s).copied().unwrap_or(0);
                                coaching.defending    = chunk.get(s + 1).copied().unwrap_or(0);
                                coaching.fitness      = chunk.get(s + 2).copied().unwrap_or(0);
                                coaching.goalkeeping  = chunk.get(s + 3).copied().unwrap_or(0);
                                coaching.mental       = chunk.get(s + 4).copied().unwrap_or(0);
                                coaching.tactical     = chunk.get(s + 5).copied().unwrap_or(0);
                                coaching.technical    = chunk.get(s + 6).copied().unwrap_or(0);
                                coaching.working_with_youngsters = chunk.get(s + 7).copied().unwrap_or(0);
                                if rl >= 12 {
                                    coaching.determination    = chunk.get(s + 8).copied().unwrap_or(0);
                                    coaching.discipline       = chunk.get(s + 9).copied().unwrap_or(0);
                                    coaching.man_management   = chunk.get(s + 10).copied().unwrap_or(0);
                                    coaching.motivating       = chunk.get(s + 11).copied().unwrap_or(0);
                                }
                                if rl >= 14 {
                                    coaching.judging_ability   = chunk.get(s + 12).copied().unwrap_or(0);
                                    coaching.judging_potential = chunk.get(s + 13).copied().unwrap_or(0);
                                }
                                log::info!("Staff '{}' coaching candidate at 0x{:X}+{} (score={:.1}, avg={:.1}, var={:.1}, len={}, ones={}, streak={}): {:?}",
                                    full_name, search_base, rs, score, avg, variance, rl, ones, max_streak, coaching);
                            }
                        }
                    }
                }

                // Only keep coaching data if the best candidate scored well enough
                if best_score < 20.0 {
                    coaching = CoachingAttrs::default();
                    log::info!("Staff '{}' — no good coaching candidate (best score {:.1})", full_name, best_score);
                }

                seen_names.insert(full_name.clone());
                vec_has_staff = true;
                staff.push(StaffMember {
                    name: full_name,
                    age,
                    nationality,
                    team_name: team_label.to_string(),
                    coaching,
                });
                break; // found person at this base
            }
        }
        if vec_has_staff {
            log::info!("Staff vector found at team+0x{:X} ({} staff for {})", vec_off, staff.len(), team_label);
        }
    }

    staff
}

/// Probe a staff object for coaching attributes.
/// Searches for ALL candidate blocks of 8+ consecutive 1-20 bytes, picks the best one.
fn probe_coaching_attrs(handle: HANDLE, staff_ptr: usize, person_base: usize) -> CoachingAttrs {
    let mut coaching = CoachingAttrs::default();
    let personality_base = person_base + 0x70;
    let mut best_score = 0.0f64;

    for (search_base, search_len) in [(staff_ptr, 768usize), (person_base.wrapping_sub(128), 512)] {
        if search_base < 0x10000 { continue; }
        let chunk = match memory::read_memory(handle, search_base, search_len) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let mut runs: Vec<(usize, usize)> = Vec::new();
        let mut run_start = 0usize;
        let mut run_len = 0usize;
        for (i, &b) in chunk.iter().enumerate() {
            let abs_addr = search_base + i;
            if abs_addr >= personality_base && abs_addr < personality_base + 8 {
                if run_len >= 8 { runs.push((run_start, run_len)); }
                run_len = 0; continue;
            }
            if b >= 1 && b <= 20 {
                if run_len == 0 { run_start = i; }
                run_len += 1;
            } else {
                if run_len >= 8 { runs.push((run_start, run_len)); }
                run_len = 0;
            }
        }
        if run_len >= 8 { runs.push((run_start, run_len)); }

        for (rs, rl) in runs {
            let vals: Vec<u8> = (0..rl.min(14))
                .map(|k| chunk.get(rs + k).copied().unwrap_or(0)).collect();
            let avg = vals.iter().map(|&v| v as f64).sum::<f64>() / vals.len() as f64;
            let variance = vals.iter().map(|&v| { let d = v as f64 - avg; d * d }).sum::<f64>() / vals.len() as f64;
            let mut max_streak = 1usize;
            let mut cur_streak = 1usize;
            for k in 1..vals.len() {
                if vals[k] == vals[k - 1] { cur_streak += 1; max_streak = max_streak.max(cur_streak); }
                else { cur_streak = 1; }
            }
            let ones = vals.iter().filter(|&&v| v == 1).count();

            let mut score = 0.0f64;
            if avg >= 7.0 && avg <= 15.0 { score += 30.0; }
            else if avg >= 5.0 && avg <= 17.0 { score += 15.0; }
            else if avg < 3.0 { score -= 20.0; }
            if variance >= 2.0 && variance <= 30.0 { score += 20.0; }
            else if variance < 1.0 { score -= 10.0; }
            if max_streak >= 5 { score -= 30.0; }
            else if max_streak >= 3 { score -= 10.0; }
            score -= ones as f64 * 5.0;
            if rl >= 8 && rl <= 16 { score += 10.0; }
            score += rl.min(14) as f64 * 1.5;

            if score > best_score {
                best_score = score;
                let s = rs;
                coaching.attacking    = chunk.get(s).copied().unwrap_or(0);
                coaching.defending    = chunk.get(s + 1).copied().unwrap_or(0);
                coaching.fitness      = chunk.get(s + 2).copied().unwrap_or(0);
                coaching.goalkeeping  = chunk.get(s + 3).copied().unwrap_or(0);
                coaching.mental       = chunk.get(s + 4).copied().unwrap_or(0);
                coaching.tactical     = chunk.get(s + 5).copied().unwrap_or(0);
                coaching.technical    = chunk.get(s + 6).copied().unwrap_or(0);
                coaching.working_with_youngsters = chunk.get(s + 7).copied().unwrap_or(0);
                if rl >= 12 {
                    coaching.determination    = chunk.get(s + 8).copied().unwrap_or(0);
                    coaching.discipline       = chunk.get(s + 9).copied().unwrap_or(0);
                    coaching.man_management   = chunk.get(s + 10).copied().unwrap_or(0);
                    coaching.motivating       = chunk.get(s + 11).copied().unwrap_or(0);
                }
                if rl >= 14 {
                    coaching.judging_ability   = chunk.get(s + 12).copied().unwrap_or(0);
                    coaching.judging_potential = chunk.get(s + 13).copied().unwrap_or(0);
                }
            }
        }
    }

    if best_score < 20.0 { return CoachingAttrs::default(); }
    coaching
}

/// Probe club struct for facility values (6 fields, each 1-20).
fn probe_club_facilities(handle: HANDLE, club_ptr: usize) -> Option<ClubFacilities> {
    if club_ptr < 0x10000 { return None; }

    // Facilities are stored as bytes 1-20 in the club struct.
    // Read a large chunk and look for blocks of 4-6 bytes all in 1-20 range
    // that are away from the name strings (0xC0-0xD0).
    let chunk = memory::read_memory(handle, club_ptr, 1024).ok()?;

    let mut best_start = 0usize;
    let mut best_len = 0usize;

    for i in 0..chunk.len() {
        // Skip name pointer area
        if i >= 0xB0 && i <= 0xD8 { continue; }

        let mut run = 0usize;
        while i + run < chunk.len() && chunk[i + run] >= 1 && chunk[i + run] <= 20 {
            run += 1;
            if run > 20 { break; }
        }
        if run >= 4 && run <= 12 && run > best_len {
            best_len = run;
            best_start = i;
        }
    }

    if best_len >= 4 {
        let fac = ClubFacilities {
            corporate:         chunk.get(best_start).copied().unwrap_or(0),
            training:          chunk.get(best_start + 1).copied().unwrap_or(0),
            youth_facilities:  chunk.get(best_start + 2).copied().unwrap_or(0),
            junior_coaching:   chunk.get(best_start + 3).copied().unwrap_or(0),
            youth_recruitment: chunk.get(best_start + 4).copied().unwrap_or(0),
            youth_importance:  chunk.get(best_start + 5).copied().unwrap_or(0),
        };
        log::info!("Club facilities candidate at club+0x{:X}: {:?}", best_start, fac);
        Some(fac)
    } else {
        None
    }
}

#[tauri::command]
pub async fn get_staff_data(state: State<'_, AppState>) -> Result<Vec<StaffMember>, String> {
    Ok(state.staff.lock().unwrap().clone())
}

#[tauri::command]
pub async fn get_club_facilities(state: State<'_, AppState>) -> Result<Option<ClubFacilities>, String> {
    Ok(state.club_facilities.lock().unwrap().clone())
}
