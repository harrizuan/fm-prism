pub mod offsets;

use crate::memory;
use crate::models::*;
use windows::Win32::Foundation::HANDLE;

// =============================================================================
// FM26 build 26.3.x offsets — from FMSuperScout + GlassScout validated entity maps
// Pinned to game_plugin.dll 26.3.0 / 26.3.2
// =============================================================================

// --- Manager/Registry ---
pub const MANAGER_REGISTRY_VECTOR_OFFSET: usize = 24;
pub const HUMAN_PERSON_OFFSET: usize = 1104;         // 0x450 dynamic offset for human manager
pub const ENTITY_UID_OFFSET: usize = 12;             // 0x0C — u32 unique ID

// --- Person block (pero) — offsets from person base ---
pub const PERSON_FIRST_NAME_OFFSET: usize = 0x50;    // 80 — nested string
pub const PERSON_SECOND_NAME_OFFSET: usize = 0x58;   // 88
pub const PERSON_COMMON_NAME_OFFSET: usize = 0x60;   // 96
pub const PERSON_NATIONALITY_OFFSET: usize = 0x68;   // 104 — ptr → nation
pub const PERSON_SECOND_NATIONALITY_OFFSET: usize = 0x78; // 120 — ptr → second nation (probed)
pub const PERSON_BIRTH_DATE_OFFSET: usize = 0x88;    // 136 — u32 FM date
pub const PERSON_CONTRACT_OFFSET: usize = 0xA8;      // 168 — ptr → contract

// Hidden personality (person offsets) — raw bytes 1..20, NOT ×5
pub const PERSON_ADAPTABILITY_OFFSET: usize = 0x70;   // 112
pub const PERSON_AMBITION_OFFSET: usize = 0x71;
pub const PERSON_LOYALTY_OFFSET: usize = 0x72;
pub const PERSON_PRESSURE_OFFSET: usize = 0x73;
pub const PERSON_PROFESSIONALISM_OFFSET: usize = 0x74;
pub const PERSON_SPORTSMANSHIP_OFFSET: usize = 0x75;
pub const PERSON_TEMPERAMENT_OFFSET: usize = 0x76;
pub const PERSON_CONTROVERSY_OFFSET: usize = 0x77;

// --- Player block (plao) — offsets from player base ---
pub const PLAYER_PERSON_OFFSET: usize = 0x288;       // 648 — dynamic offset to person
pub const PLAYER_POSITIONS_OFFSET: usize = 0x150;     // 336 — 15 bytes position familiarity
pub const PLAYER_ATTRIBUTES_OFFSET: usize = 0x15F;    // 351 — 55 bytes, stored ×5
pub const PLAYER_HEIGHT_OFFSET: usize = 0x22E;        // 558 — u16 cm
pub const PLAYER_GUIDE_VALUE_OFFSET: usize = 0x234;   // 564 — u32 GBP (FM's real transfer value)
pub const PLAYER_TRANSFER_VALUE_OFFSET: usize = 0x238; // 568 — u32 GBP (asking price)
pub const PLAYER_CONDITION_OFFSET: usize = 0x258;     // 600 — u16
pub const PLAYER_HOME_REP_OFFSET: usize = 0x25E;      // 606 — u16
pub const PLAYER_CUR_REP_OFFSET: usize = 0x260;       // 608 — u16
pub const PLAYER_WORLD_REP_OFFSET: usize = 0x262;     // 610 — u16
pub const PLAYER_CA_OFFSET: usize = 0x264;            // 612 — u16 (REAL CA, 1..200)
pub const PLAYER_PA_OFFSET: usize = 0x266;            // 614 — u16 (REAL PA, 1..200)
pub const PLAYER_MORALE_OFFSET: usize = 0x26C;        // 620 — byte
pub const PLAYER_CURRENT_DATE_OFFSET: usize = 512;

// --- Contract offsets (from contract pointer) ---
pub const CONTRACT_TEAM_OFFSET: usize = 0x10;         // 16 — ptr → team
pub const CONTRACT_WAGE_OFFSET: usize = 0x20;         // 32 — u32 GBP per week
pub const CONTRACT_EXPIRY_OFFSET: usize = 0x48;       // 72 — u32 FM date
pub const CONTRACT_STATUS_FLAGS_OFFSET: usize = 0x57; // 87 — byte bitfield
pub const CONTRACT_SQUAD_NUMBER_OFFSET: usize = 0x5D; // 93 — byte

// --- Team/Club ---
pub const TEAM_CLUB_OFFSET: usize = 0x30;             // 48 — ptr → club
pub const TEAM_PLAYERS_START_OFFSET: usize = 56;      // 0x38
pub const TEAM_PLAYERS_END_OFFSET: usize = 64;        // 0x40
pub const TEAM_COMP_OFFSET: usize = 0x50;             // 80 — ptr → competition
pub const TEAM_COMP_ALT_OFFSET: usize = 0x60;         // 96 — alt ptr → competition
pub const TEAM_MANAGER_OFFSET: usize = 0x80;          // 128 — ptr → manager
pub const TEAM_REP_OFFSET: usize = 0x90;              // 144 — u16 reputation (approx)
pub const CLUB_NAME_OFFSET: usize = 0xC0;             // 192 — indirect string
pub const CLUB_SHORT_NAME_OFFSET: usize = 0xC8;       // 200 — indirect string
pub const COMP_NAME_OFFSET: usize = 0x40;             // 64 — indirect string (full name)
pub const COMP_SHORT_NAME_OFFSET: usize = 0x48;       // 72 — indirect string (short name)
pub const NATION_NAME_OFFSET: usize = 0x30;            // 48 — FMSuperScout verified
pub const NATION_SHORT_NAME_OFFSET: usize = 0x20;     // 32 — short name

// --- Staff object offsets (probed) ---
// Staff objects share Person base with players. Person is at a different offset
// from the staff base vs player base. Staff also have coaching, knowledge, and
// tactical preference attributes stored as raw 1-20 bytes.
// The exact person offset within a staff object varies (not 0x288 like players).
// We discover it by trying multiple candidates.
pub const STAFF_PERSON_CANDIDATES: [usize; 8] = [
    0x30, 0x38, 0x40, 0x48, 0x50, 0x58, 0x60, 0x68,
];

pub const SIGNATURE: &str = "48 8B 0D ?? ?? ?? ?? 48 8B 41 18 48 8B 49 20 48 29 C1 48 C1 F9 03 48 39 CE";

/// FM26 attribute order within the 55-byte block at PLAYER_ATTRIBUTES_OFFSET
pub const ATTR_NAMES: [&str; 54] = [
    "Crossing", "Dribbling", "Finishing", "Heading", "Long Shots",
    "Marking", "Off the Ball", "Passing", "Penalty Taking", "Tackling",
    "Vision", "Handling", "Aerial Reach", "Command of Area", "Communication",
    "Kicking", "Throwing", "Anticipation", "Decisions", "One on Ones",
    "Positioning", "Reflexes", "First Touch", "Technique", "Left Foot",
    "Right Foot", "Flair", "Corners", "Teamwork", "Work Rate",
    "Long Throws", "Eccentricity", "Rushing Out", "Punching", "Acceleration",
    "Free Kick Taking", "Strength", "Stamina", "Pace", "Jumping Reach",
    "Leadership", "Dirtiness", "Balance", "Bravery", "Consistency",
    "Aggression", "Agility", "Important Matches", "Injury Proneness",
    "Versatility", "Natural Fitness", "Determination", "Composure", "Concentration",
];

/// FM26 position order within the 15-byte block at PLAYER_POSITIONS_OFFSET
pub const POSITION_NAMES: [&str; 15] = [
    "GK", "SW", "DL", "DC", "DR", "DM", "ML", "MC", "MR",
    "AML", "AMC", "AMR", "ST", "WBL", "WBR",
];

/// Convert FM26 internal raw attribute (0-99) to display value (1-20)
pub fn display_attr(raw: u8) -> u8 {
    if raw == 0 { return 0; }
    (raw.saturating_add(4) / 5).clamp(1, 20)
}

/// Determine preferred foot from internal left/right foot values
pub fn preferred_foot_label(left_raw: u8, right_raw: u8) -> &'static str {
    let left = display_attr(left_raw);
    let right = display_attr(right_raw);
    if right >= 14 && left >= 14 { "Either" }
    else if right >= left { "Right" }
    else { "Left" }
}

/// Decode FM date format: year = raw >> 16, day_of_year = raw & 0x1FF
pub fn decode_fm_date(raw: u32) -> (u16, u16) {
    let year = (raw >> 16) as u16;
    let doy = (raw & 0x1FF) as u16;
    (year, doy)
}

/// Format FM date as ISO string (YYYY-MM-DD)
pub fn fm_date_iso(raw: u32) -> String {
    let (year, doy) = decode_fm_date(raw);
    if year < 2000 || doy == 0 { return String::new(); }
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let max_days = if leap { 366 } else { 365 };
    if doy > max_days { return String::new(); }

    let days_in_month: [u16; 12] = if leap {
        [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    } else {
        [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    };
    let mut remaining = doy;
    let mut month = 1u16;
    for &d in &days_in_month {
        if remaining <= d { break; }
        remaining -= d;
        month += 1;
    }
    format!("{:04}-{:02}-{:02}", year, month, remaining)
}

/// Parse a player from a known player object address using validated FM26 offsets
pub fn parse_player_at(handle: HANDLE, player_ptr: usize, game_year: u16) -> Option<Player> {
    if player_ptr < 0x10000 { return None; }

    let mut p = Player::default();

    // Person is EMBEDDED at offset 0x288 within the player object.
    // Try pointer dereference first, fall back to embedded if the pointer is invalid.
    let person_ptr_val = memory::read_ptr(handle, player_ptr + PLAYER_PERSON_OFFSET).unwrap_or(0);
    let person_base = if person_ptr_val > 0x10000 && person_ptr_val < 0x800_0000_0000 {
        let test_name = memory::read_fm_string(handle, person_ptr_val + PERSON_FIRST_NAME_OFFSET);
        if !test_name.is_empty() && test_name.len() >= 2 && test_name.chars().any(|c| c.is_alphabetic()) {
            person_ptr_val
        } else {
            player_ptr + PLAYER_PERSON_OFFSET
        }
    } else {
        player_ptr + PLAYER_PERSON_OFFSET
    };

    // ============ REAL CA and PA ============
    let ca = memory::read_u16(handle, player_ptr + PLAYER_CA_OFFSET).unwrap_or(0);
    let pa = memory::read_u16(handle, player_ptr + PLAYER_PA_OFFSET).unwrap_or(0);
    if ca < 1 || ca > 200 || pa < 1 || pa > 200 {
        return None; // Not a valid player object
    }
    p.current_ability = ca as i16;
    p.potential_ability = pa as i16;

    // Unique ID from entity
    p.id = memory::read_u32(handle, person_base + ENTITY_UID_OFFSET).unwrap_or(0);

    // Names via nested strings (double-indirection)
    p.first_name = memory::read_fm_string(handle, person_base + PERSON_FIRST_NAME_OFFSET);
    p.last_name = memory::read_fm_string(handle, person_base + PERSON_SECOND_NAME_OFFSET);
    p.common_name = memory::read_fm_string(handle, person_base + PERSON_COMMON_NAME_OFFSET);

    if p.first_name.is_empty() && p.last_name.is_empty() && p.common_name.is_empty() {
        return None;
    }

    // Nationality: Person → Nation pointer → name
    if let Ok(nation_ptr) = memory::read_ptr(handle, person_base + PERSON_NATIONALITY_OFFSET) {
        if nation_ptr > 0x10000 {
            p.nationality = memory::read_fm_string(handle, nation_ptr + NATION_NAME_OFFSET);
        }
    }

    // Second nationality: probe at offset 0x78, 0x80, 0x90 for a valid nation pointer
    for &off in &[PERSON_SECOND_NATIONALITY_OFFSET, 0x80, 0x90] {
        if let Ok(nat2_ptr) = memory::read_ptr(handle, person_base + off) {
            if nat2_ptr > 0x10000 && nat2_ptr < 0x800_0000_0000 {
                let name = memory::read_fm_string(handle, nat2_ptr + NATION_NAME_OFFSET);
                if !name.is_empty() && name.len() >= 3 && name.len() <= 40
                    && name.chars().all(|c| c.is_alphabetic() || c == ' ' || c == '-' || c == '\'')
                    && name != p.nationality
                {
                    p.second_nationality = name;
                    break;
                }
            }
        }
    }

    // Date of birth: FM date format (year in top 16 bits, doy in bottom 9 bits)
    let dob_raw = memory::read_u32(handle, person_base + PERSON_BIRTH_DATE_OFFSET).unwrap_or(0);
    let (birth_year, _birth_doy) = decode_fm_date(dob_raw);
    if birth_year >= 1960 && birth_year <= 2015 && game_year >= birth_year {
        p.age = (game_year - birth_year) as u8;
    } else {
        // Fallback: scan for u16 year at various offsets
        for dob_off in [PERSON_BIRTH_DATE_OFFSET, PERSON_BIRTH_DATE_OFFSET + 4, PERSON_BIRTH_DATE_OFFSET - 4] {
            let year = memory::read_u16(handle, person_base + dob_off).unwrap_or(0);
            if year > 1960 && year < 2015 && game_year >= year {
                p.age = (game_year - year) as u8;
                break;
            }
        }
    }

    // ============ Contract chain: wages, expiry, transfer status, club ============
    if let Ok(contract_ptr) = memory::read_ptr(handle, person_base + PERSON_CONTRACT_OFFSET) {
        if contract_ptr > 0x10000 && contract_ptr < 0x800_0000_0000 {
            // Weekly wage in GBP
            let wage_raw = memory::read_u32(handle, contract_ptr + CONTRACT_WAGE_OFFSET).unwrap_or(0xFFFFFFFF);
            if wage_raw != 0xFFFFFFFF {
                p.wage = wage_raw;
            }

            // Contract expiry as ISO date
            let expiry_raw = memory::read_u32(handle, contract_ptr + CONTRACT_EXPIRY_OFFSET).unwrap_or(0);
            p.contract_expiry = fm_date_iso(expiry_raw);

            // Squad number
            p.squad_number = memory::read_u8(handle, contract_ptr + CONTRACT_SQUAD_NUMBER_OFFSET).unwrap_or(0);

            // Transfer status flags
            let flags = memory::read_u8(handle, contract_ptr + CONTRACT_STATUS_FLAGS_OFFSET).unwrap_or(0);
            let listed = (flags & (1 << 0)) != 0 || (flags & (1 << 3)) != 0;
            let not_for_sale = (flags & (1 << 4)) != 0;
            let set_for_release = (flags & (1 << 5)) != 0;
            p.is_listed = listed;
            p.transfer_status = if set_for_release { "Released".into() }
                else if listed { "Listed".into() }
                else if not_for_sale { "Not for Sale".into() }
                else { String::new() };

            // Club via: Contract → Team → Club → name
            if let Ok(team_ptr) = memory::read_ptr(handle, contract_ptr + CONTRACT_TEAM_OFFSET) {
                if team_ptr > 0x10000 {
                    if let Ok(club_ptr) = memory::read_ptr(handle, team_ptr + TEAM_CLUB_OFFSET) {
                        if club_ptr > 0x10000 {
                            p.club_name = memory::read_fm_string(handle, club_ptr + CLUB_NAME_OFFSET);
                        }
                    }
                    // League via: Team → Competition → name
                    for comp_off in [TEAM_COMP_OFFSET, TEAM_COMP_ALT_OFFSET] {
                        if let Ok(comp_ptr) = memory::read_ptr(handle, team_ptr + comp_off) {
                            if comp_ptr > 0x10000 {
                                let name = memory::read_fm_string(handle, comp_ptr + COMP_NAME_OFFSET);
                                if !name.is_empty() && name.len() >= 3 {
                                    p.league_name = name;
                                    break;
                                }
                                let short = memory::read_fm_string(handle, comp_ptr + COMP_SHORT_NAME_OFFSET);
                                if !short.is_empty() && short.len() >= 3 {
                                    p.league_name = short;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // ============ Value and height ============
    let guide_val = memory::read_u32(handle, player_ptr + PLAYER_GUIDE_VALUE_OFFSET).unwrap_or(0xFFFFFFFF);
    if guide_val != 0xFFFFFFFF && guide_val != 300_000_000 {
        p.value = guide_val as u64;
    }
    let transfer_val = memory::read_u32(handle, player_ptr + PLAYER_TRANSFER_VALUE_OFFSET).unwrap_or(0xFFFFFFFF);
    if transfer_val != 0xFFFFFFFF {
        p.asking_price = transfer_val as u64;
    }

    let height = memory::read_u16(handle, player_ptr + PLAYER_HEIGHT_OFFSET).unwrap_or(0);
    if height >= 140 && height <= 220 {
        p.height = height;
    }

    // Weight in kg — typically stored 2 bytes after height
    let weight = memory::read_u16(handle, player_ptr + PLAYER_HEIGHT_OFFSET + 2).unwrap_or(0);
    if weight >= 40 && weight <= 150 {
        p.weight = weight;
    }

    // ============ Reputation ============
    p.home_reputation = memory::read_u16(handle, player_ptr + PLAYER_HOME_REP_OFFSET).unwrap_or(0);
    p.current_reputation = memory::read_u16(handle, player_ptr + PLAYER_CUR_REP_OFFSET).unwrap_or(0);
    p.world_reputation = memory::read_u16(handle, player_ptr + PLAYER_WORLD_REP_OFFSET).unwrap_or(0);
    p.reputation = p.world_reputation as u32;

    // Condition and morale
    p.condition = memory::read_u16(handle, player_ptr + PLAYER_CONDITION_OFFSET).unwrap_or(0);
    p.morale = memory::read_u8(handle, player_ptr + PLAYER_MORALE_OFFSET).unwrap_or(0);

    // ============ Positions: 15 bytes ============
    if let Ok(pos_data) = memory::read_memory(handle, player_ptr + PLAYER_POSITIONS_OFFSET, 15) {
        if pos_data.len() == 15 {
            p.positions = PositionMap {
                goalkeeper: pos_data[0],
                sweeper: pos_data[1],
                defender_left: pos_data[2],
                defender_central: pos_data[3],
                defender_right: pos_data[4],
                defensive_midfielder: pos_data[5],
                midfielder_left: pos_data[6],
                midfielder_central: pos_data[7],
                midfielder_right: pos_data[8],
                winger_left: pos_data[9],
                attacking_midfielder: pos_data[10],
                winger_right: pos_data[11],
                striker: pos_data[12],
                wing_back_left: pos_data[13],
                wing_back_right: pos_data[14],
            };
            p.natural_position = p.positions.best_position().to_string();
        }
    }

    // ============ Attributes: 55 bytes, stored ×5 ============
    if let Ok(raw) = memory::read_memory(handle, player_ptr + PLAYER_ATTRIBUTES_OFFSET, 55) {
        if raw.len() >= 54 {
            let valid_count = raw.iter().take(54).filter(|&&b| b >= 1 && b <= 99).count();
            if valid_count < 20 {
                return None;
            }

            p.technical = TechnicalAttributes {
                crossing:    display_attr(raw[0]),
                dribbling:   display_attr(raw[1]),
                finishing:   display_attr(raw[2]),
                heading:     display_attr(raw[3]),
                long_shots:  display_attr(raw[4]),
                marking:     display_attr(raw[5]),
                passing:     display_attr(raw[7]),
                penalty:     display_attr(raw[8]),
                tackling:    display_attr(raw[9]),
                first_touch: display_attr(raw[22]),
                technique:   display_attr(raw[23]),
                corners:     display_attr(raw[27]),
                free_kick:   display_attr(raw[35]),
                long_throws: display_attr(raw[30]),
            };

            p.mental = MentalAttributes {
                off_the_ball:  display_attr(raw[6]),
                vision:        display_attr(raw[10]),
                anticipation:  display_attr(raw[17]),
                decisions:     display_attr(raw[18]),
                positioning:   display_attr(raw[20]),
                flair:         display_attr(raw[26]),
                teamwork:      display_attr(raw[28]),
                work_rate:     display_attr(raw[29]),
                leadership:    display_attr(raw[40]),
                bravery:       display_attr(raw[43]),
                aggression:    display_attr(raw[45]),
                determination: display_attr(raw[51]),
                composure:     display_attr(raw[52]),
                concentration: display_attr(raw[53]),
                creativity:    display_attr(raw[26]),
            };

            p.physical = PhysicalAttributes {
                acceleration:    display_attr(raw[34]),
                strength:        display_attr(raw[36]),
                stamina:         display_attr(raw[37]),
                pace:            display_attr(raw[38]),
                jumping:         display_attr(raw[39]),
                balance:         display_attr(raw[42]),
                agility:         display_attr(raw[46]),
                natural_fitness: display_attr(raw[50]),
            };

            p.goalkeeping = GoalkeepingAttributes {
                handling:        display_attr(raw[11]),
                aerial_reach:    display_attr(raw[12]),
                command_of_area: display_attr(raw[13]),
                communication:   display_attr(raw[14]),
                kicking:         display_attr(raw[15]),
                throwing:        display_attr(raw[16]),
                one_on_ones:     display_attr(raw[19]),
                reflexes:        display_attr(raw[21]),
                eccentricity:    display_attr(raw[31]),
                rushing_out:     display_attr(raw[32]),
                punching:        display_attr(raw[33]),
            };

            // Hidden attributes — from the ×5 attribute block
            p.hidden = HiddenAttributes {
                dirtiness:         display_attr(raw[41]),
                consistency:       display_attr(raw[44]),
                important_matches: display_attr(raw[47]),
                injury_proneness:  display_attr(raw[48]),
                versatility:       display_attr(raw[49]),
                // Personality attributes are NOT ×5 — read as raw 1-20 from person
                adaptability:     0,
                ambition:         0,
                controversy:      0,
                loyalty:          0,
                pressure:         0,
                professionalism:  0,
                sportsmanship:    0,
                temperament:      0,
            };

            // Preferred foot from attribute indexes 24 (Left) and 25 (Right)
            p.preferred_foot = preferred_foot_label(raw[24], raw[25]).to_string();
            p.left_foot = display_attr(raw[24]);
            p.right_foot = display_attr(raw[25]);
        }
    }

    // ============ Hidden personality (from person, NOT ×5 — raw 1..20) ============
    let clamp = |v: u8| -> u8 { if v >= 1 && v <= 20 { v } else { 0 } };
    p.hidden.adaptability    = clamp(memory::read_u8(handle, person_base + PERSON_ADAPTABILITY_OFFSET).unwrap_or(0));
    p.hidden.ambition        = clamp(memory::read_u8(handle, person_base + PERSON_AMBITION_OFFSET).unwrap_or(0));
    p.hidden.loyalty         = clamp(memory::read_u8(handle, person_base + PERSON_LOYALTY_OFFSET).unwrap_or(0));
    p.hidden.pressure        = clamp(memory::read_u8(handle, person_base + PERSON_PRESSURE_OFFSET).unwrap_or(0));
    p.hidden.professionalism = clamp(memory::read_u8(handle, person_base + PERSON_PROFESSIONALISM_OFFSET).unwrap_or(0));
    p.hidden.sportsmanship   = clamp(memory::read_u8(handle, person_base + PERSON_SPORTSMANSHIP_OFFSET).unwrap_or(0));
    p.hidden.temperament     = clamp(memory::read_u8(handle, person_base + PERSON_TEMPERAMENT_OFFSET).unwrap_or(0));
    p.hidden.controversy     = clamp(memory::read_u8(handle, person_base + PERSON_CONTROVERSY_OFFSET).unwrap_or(0));

    Some(p)
}

/// Read the current game date from a player struct
pub fn read_game_date(handle: HANDLE, player_ptr: usize) -> Option<u16> {
    memory::read_u16(handle, player_ptr + PLAYER_CURRENT_DATE_OFFSET).ok()
        .filter(|&y| y > 2020 && y < 2040)
}

/// Parse the signature pattern string into a byte pattern with wildcards
pub fn parse_signature(sig_str: &str) -> Vec<Option<u8>> {
    sig_str
        .split_whitespace()
        .map(|byte| {
            if byte == "??" { None }
            else { Some(u8::from_str_radix(byte, 16).unwrap_or(0)) }
        })
        .collect()
}

/// Resolve a RIP-relative MOV instruction to its target address
pub fn resolve_rip_relative(handle: HANDLE, instruction_addr: usize) -> Option<usize> {
    let disp_bytes = memory::read_memory(handle, instruction_addr + 3, 4).ok()?;
    if disp_bytes.len() < 4 { return None; }
    let displacement = i32::from_le_bytes([disp_bytes[0], disp_bytes[1], disp_bytes[2], disp_bytes[3]]);
    let target = (instruction_addr as i64 + 7 + displacement as i64) as usize;
    if target < 0x10000 { return None; }
    Some(target)
}

pub fn validate_player_data(p: &Player) -> bool {
    if p.first_name.is_empty() && p.last_name.is_empty() && p.common_name.is_empty() {
        return false;
    }
    if p.current_ability < 1 || p.current_ability > 200 {
        return false;
    }
    let tech_valid = [
        p.technical.finishing, p.technical.passing, p.technical.dribbling,
        p.technical.tackling, p.technical.heading, p.technical.crossing,
        p.technical.first_touch, p.technical.technique, p.technical.marking,
    ].iter().filter(|&&v| v >= 1 && v <= 20).count();

    tech_valid >= 3
}

/// Try to find the person base from a staff object pointer.
/// Staff objects embed person at a different offset than players.
/// We try multiple strategies:
///   1. Check if name strings appear at ptr + small offsets + person name offsets
///   2. Follow pointers at known offsets to find an embedded person
pub fn find_staff_person_base(handle: HANDLE, staff_ptr: usize) -> Option<usize> {
    // Strategy 1: Person embedded directly at staff + small offset
    for &off in &STAFF_PERSON_CANDIDATES {
        let candidate = staff_ptr + off;
        let first = memory::read_fm_string(handle, candidate + PERSON_FIRST_NAME_OFFSET);
        let last = memory::read_fm_string(handle, candidate + PERSON_SECOND_NAME_OFFSET);
        if (!first.is_empty() && first.chars().any(|c| c.is_alphabetic()))
            || (!last.is_empty() && last.chars().any(|c| c.is_alphabetic())) {
            return Some(candidate);
        }
    }

    // Strategy 2: Person via pointer at staff + offset (like players at 0x288)
    // Wider range: staff objects can have person pointers at various offsets
    for test_off in (0x08..0x400usize).step_by(8) {
        let pv = memory::read_ptr(handle, staff_ptr + test_off).unwrap_or(0);
        if pv < 0x10000 || pv > 0x800_0000_0000 { continue; }
        // Avoid self-reference or very nearby pointers (within the same object)
        if pv == staff_ptr { continue; }
        let first = memory::read_fm_string(handle, pv + PERSON_FIRST_NAME_OFFSET);
        let last = memory::read_fm_string(handle, pv + PERSON_SECOND_NAME_OFFSET);
        if (!first.is_empty() && first.chars().any(|c| c.is_alphabetic()))
            || (!last.is_empty() && last.chars().any(|c| c.is_alphabetic())) {
            return Some(pv);
        }
    }

    None
}

/// Discover the staff vtable by reading the vtable pointer from a known staff object.
/// Staff objects are found from the team/club struct. We verify candidates actually
/// have coaching-attribute-like data (8+ consecutive bytes in 1-20 range) to avoid
/// picking up generic person/contract/official vtables that lack coaching attrs.
pub fn discover_staff_vtable(
    handle: HANDLE,
    team_ptr: usize,
    club_ptr: usize,
    player_vtable: usize,
) -> Option<usize> {
    let search_targets: Vec<(&str, usize)> = {
        let mut v = vec![("team", team_ptr)];
        if club_ptr > 0x10000 && club_ptr != team_ptr { v.push(("club", club_ptr)); }
        v
    };

    let mut candidate_vtables: Vec<(usize, String, usize, usize)> = Vec::new(); // (vt, label, vec_off, obj_ptr)

    for (label, base_ptr) in &search_targets {
        if *base_ptr < 0x10000 { continue; }

        for vec_off in (0x08..0x400usize).step_by(8) {
            if *label == "team" && (vec_off == TEAM_PLAYERS_START_OFFSET || vec_off == TEAM_PLAYERS_END_OFFSET as usize) {
                continue;
            }

            let vs = memory::read_ptr(handle, base_ptr + vec_off).unwrap_or(0);
            let ve = memory::read_ptr(handle, base_ptr + vec_off + 8).unwrap_or(0);
            if vs < 0x10000 || ve <= vs { continue; }
            let count = (ve - vs) / 8;
            if count == 0 || count > 200 { continue; }

            for j in 0..count.min(10) {
                let ptr = match memory::read_ptr(handle, vs + j * 8) {
                    Ok(p) if p > 0x10000 && p < 0x800_0000_0000 => p,
                    _ => continue,
                };

                let vt = memory::read_ptr(handle, ptr).unwrap_or(0);
                if vt < 0x10000 || vt == player_vtable { continue; }
                if candidate_vtables.iter().any(|(v, _, _, _)| *v == vt) { continue; }

                let person_base = match find_staff_person_base(handle, ptr) {
                    Some(pb) => pb,
                    None => continue,
                };

                // Verify it does NOT have player CA/PA + positions
                let maybe_ca = memory::read_u16(handle, ptr + PLAYER_CA_OFFSET).unwrap_or(0);
                let maybe_pa = memory::read_u16(handle, ptr + PLAYER_PA_OFFSET).unwrap_or(0);
                let has_player_pos = if let Ok(pos) = memory::read_memory(handle, ptr + PLAYER_POSITIONS_OFFSET, 15) {
                    pos.iter().filter(|&&b| b >= 1 && b <= 20).count() >= 5
                } else { false };

                if has_player_pos && maybe_ca >= 1 && maybe_ca <= 200 && maybe_pa >= 1 && maybe_pa <= 200 {
                    continue;
                }

                // KEY CHECK: Verify this object has coaching-attribute-like data
                // Search BOTH from the object start AND around the person base
                // (coaching attrs may be stored near person, not near vtable)
                let has_coaching = {
                    let personality_base = person_base + 0x70;
                    let search_areas: Vec<(usize, usize)> = vec![
                        (ptr, 1024),
                        (person_base.wrapping_sub(256), 768),
                    ];
                    let mut found = false;
                    'outer: for (base, len) in search_areas {
                        if base < 0x10000 { continue; }
                        let chunk = match memory::read_memory(handle, base, len) {
                            Ok(c) => c,
                            Err(_) => continue,
                        };
                        let mut run_len = 0usize;
                        let mut run_vals: Vec<u8> = Vec::new();
                        for (i, &b) in chunk.iter().enumerate() {
                            let abs = base + i;
                            if abs >= personality_base && abs < personality_base + 8 {
                                if run_len >= 8 {
                                    let avg = run_vals.iter().map(|&v| v as f64).sum::<f64>() / run_vals.len() as f64;
                                    let ones = run_vals.iter().filter(|&&v| v == 1).count();
                                    if avg >= 4.0 && avg <= 18.0 && ones <= 3 { found = true; break 'outer; }
                                }
                                run_len = 0; run_vals.clear(); continue;
                            }
                            if b >= 1 && b <= 20 {
                                run_len += 1; run_vals.push(b);
                            } else {
                                if run_len >= 8 {
                                    let avg = run_vals.iter().map(|&v| v as f64).sum::<f64>() / run_vals.len() as f64;
                                    let ones = run_vals.iter().filter(|&&v| v == 1).count();
                                    if avg >= 4.0 && avg <= 18.0 && ones <= 3 { found = true; break 'outer; }
                                }
                                run_len = 0; run_vals.clear();
                            }
                        }
                        if !found && run_len >= 8 {
                            let avg = run_vals.iter().map(|&v| v as f64).sum::<f64>() / run_vals.len() as f64;
                            let ones = run_vals.iter().filter(|&&v| v == 1).count();
                            if avg >= 4.0 && avg <= 18.0 && ones <= 3 { found = true; }
                        }
                    }
                    found
                };

                log::info!("Staff vtable candidate: 0x{:X} from {}+0x{:X}[{}] (obj 0x{:X}, has_coaching={})",
                    vt, label, vec_off, j, ptr, has_coaching);

                if has_coaching {
                    log::info!("Staff vtable CONFIRMED: 0x{:X} — object has coaching attribute data", vt);
                    return Some(vt);
                }

                candidate_vtables.push((vt, label.to_string(), vec_off, ptr));
            }
        }
    }

    // No vtable had coaching data — log all candidates for debugging
    if !candidate_vtables.is_empty() {
        log::warn!("discover_staff_vtable: {} candidate vtables found but NONE had coaching data:", candidate_vtables.len());
        for (vt, label, off, ptr) in &candidate_vtables {
            log::warn!("  vtable 0x{:X} from {}+0x{:X} (obj 0x{:X})", vt, label, off, ptr);
        }
    }
    log::warn!("discover_staff_vtable: no staff vtable found with coaching data");
    None
}
