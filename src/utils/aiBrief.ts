import type { Player, ManagerProfile } from "@/types/player";
import {
  displayName, formatValue, formatWage,
  bestRoles, bestFormationFit, playerAthletics, playerHiddenMentals,
  calculateFeasibility, analyzeSquadNeeds, analyzeLeague,
} from "@/types/player";

const DB_DIR = "C:\\Users\\User\\Downloads\\0.footballmanager\\fm-db";

function esc(s: string) { return (s || "").replace(/\t/g, " ").replace(/\n/g, " "); }
function val(v: number) { return v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : `${v}`; }

export async function generateAIDatabase(
  players: Player[],
  managerProfile: ManagerProfile,
  squadIds: Set<number>,
  shortlist: Player[],
) {
  const { invoke } = await import("@tauri-apps/api/core");
  const write = (name: string, content: string) => invoke("write_file", { path: `${DB_DIR}\\${name}`, content });

  const mp = managerProfile;
  const gY = mp.game_year ?? 2026;
  const avgRep = mp.squad_avg_world_rep ?? 0;
  const highW = mp.squad_highest_wage ?? 0;
  const totalV = mp.squad_total_value ?? 0;
  const squadPlayers = players.filter((p) => squadIds.has(p.id));
  const shortIds = new Set(shortlist.map((s) => s.id));

  // ════════════════════════════════════════════════════════════
  // FILE 1: profile.md — small context file, always read first
  // ════════════════════════════════════════════════════════════
  const needs = analyzeSquadNeeds(squadPlayers);
  const league = analyzeLeague(players, mp.league_name ?? "");
  const leagueAvgCA = league.length > 0
    ? Math.round(league.reduce((s, c) => s + c.avgCA, 0) / league.length)
    : mp.squad_avg_ca;

  let profile = `# FM Save Profile\n`;
  profile += `Generated: ${new Date().toISOString()}\n`;
  profile += `Database: ${players.length} players\n\n`;
  profile += `## Manager\n`;
  profile += `- Name: ${mp.name}\n- Club: ${mp.club_name}\n- League: ${mp.league_name}\n- Nation: ${mp.nationality}\n`;
  if (mp.national_team_name) profile += `- National Team: ${mp.national_team_name}\n`;
  profile += `- Game Year: ${gY}\n- Club Rep: ${mp.club_reputation}\n\n`;
  profile += `## Squad Stats\n`;
  profile += `- Size: ${squadPlayers.length}\n- Avg CA: ${mp.squad_avg_ca}\n- Avg Age: ${mp.squad_avg_age.toFixed(1)}\n`;
  profile += `- Avg World Rep: ${avgRep}/10000\n- Highest Wage: £${highW.toLocaleString()}/w\n`;
  profile += `- Total Value: £${(totalV / 1e6).toFixed(1)}M\n- Total Wage: £${(mp.squad_total_wage / 1e3).toFixed(0)}k/w\n\n`;
  profile += `## League Avg CA: ${leagueAvgCA}\n\n`;
  profile += `## Squad Needs\n`;
  for (const n of needs) profile += `- ${n.position}: ${n.status} (${n.count} players, avgCA ${Math.round(n.avgCA)}) — ${n.recommendation}\n`;
  profile += `\n## League Clubs\n`;
  for (const c of league.slice(0, 25)) profile += `- ${c.clubName}: avgCA ${Math.round(c.avgCA)}, ${c.playerCount} players, best ${c.bestPlayer}(${c.bestPlayerCA})\n`;

  await write("profile.md", profile);

  // ════════════════════════════════════════════════════════════
  // FILE 2: squad.tsv — full detail on my squad players
  // ════════════════════════════════════════════════════════════
  const squadHeader = [
    "Name", "Age", "Pos", "CA", "PA", "Slot", "Fit%", "Role1", "R1Score", "Role2", "R2Score",
    "Ath", "Ment", "Value", "Wage", "Contract", "Rep", "WorldRep",
    "Cor", "Cro", "Dri", "Fin", "Fir", "FK", "Hea", "LS", "Mar", "Pas", "Pen", "Tac", "Tec",
    "Agg", "Ant", "Bra", "Cmp", "Cnt", "Dec", "Det", "Fla", "Lea", "OtB", "Pos", "Tea", "Vis", "Wor",
    "Acc", "Agi", "Bal", "Jum", "NF", "Pac", "Sta", "Str",
    "Con", "Pre", "Imp", "Pro", "Dir", "Inj", "Tem", "Amb",
    "Condition", "Form", "Fitness", "Morale",
  ].join("\t");

  const squadRows = [...squadPlayers]
    .sort((a, b) => b.current_ability - a.current_ability)
    .map((p) => {
      const ff = bestFormationFit(p);
      const roles = bestRoles(p, 2);
      const r1 = roles[0], r2 = roles[1];
      const t = p.technical, m = p.mental, ph = p.physical, h = p.hidden;
      return [
        esc(displayName(p)), p.age, p.natural_position, p.current_ability, p.potential_ability,
        ff.slot, ff.fit, r1?.role.short ?? "-", r1?.score ?? 0, r2?.role.short ?? "-", r2?.score ?? 0,
        playerAthletics(p), playerHiddenMentals(p), val(p.value), formatWage(p.wage), p.contract_expiry || "?",
        p.reputation, p.world_reputation,
        t.corners, t.crossing, t.dribbling, t.finishing, t.first_touch, t.free_kick, t.heading,
        t.long_shots, t.marking, t.passing, t.penalty, t.tackling, t.technique,
        m.aggression, m.anticipation, m.bravery, m.composure, m.concentration, m.decisions,
        m.determination, m.flair, m.leadership, m.off_the_ball, m.positioning, m.teamwork, m.vision, m.work_rate,
        ph.acceleration, ph.agility, ph.balance, ph.jumping, ph.natural_fitness, ph.pace, ph.stamina, ph.strength,
        h.consistency, h.pressure, h.important_matches, h.professionalism, h.dirtiness,
        h.injury_proneness, h.temperament, h.ambition,
        p.condition, p.form, p.fitness, p.morale,
      ].join("\t");
    });

  await write("squad.tsv", squadHeader + "\n" + squadRows.join("\n"));

  // ════════════════════════════════════════════════════════════
  // FILE 3: all-players.tsv — EVERY player in the database
  // Sorted by CA desc. Computed fields for all players.
  // This is the main searchable file (~15-20MB).
  // ════════════════════════════════════════════════════════════
  const allHeader = [
    "Name", "Age", "Pos", "CA", "PA", "Club", "League", "Nation", "Nation2",
    "Value", "Wage", "Contract", "Transfer", "OnLoan", "Listed",
    "Rep", "WorldRep", "IsSquad", "Shortlisted",
    "Slot", "Fit%", "Feas%",
    "Role1", "R1Score", "Role2", "R2Score",
    "Ath", "Ment", "Dirty",
    "Cor", "Cro", "Dri", "Fin", "Fir", "FK", "Hea", "LS", "Mar", "Pas", "Pen", "Tac", "Tec",
    "Agg", "Ant", "Bra", "Cmp", "Cnt", "Dec", "Det", "Fla", "Lea", "OtB", "Pos", "Tea", "Vis", "Wor",
    "Acc", "Agi", "Bal", "Jum", "NF", "Pac", "Sta", "Str",
    "Con", "Pre", "Imp", "Pro", "Inj", "Tem",
    "Height", "Foot",
    "pGK", "pDL", "pDC", "pDR", "pWBL", "pWBR", "pDM", "pMC", "pML", "pMR", "pAMC", "pAML", "pAMR", "pST",
  ].join("\t");

  const sorted = [...players].sort((a, b) => b.current_ability - a.current_ability);
  const allRows: string[] = [];

  for (const p of sorted) {
    const isSquad = squadIds.has(p.id);
    const ff = bestFormationFit(p);
    const roles = bestRoles(p, 2);
    const r1 = roles[0], r2 = roles[1];
    const feas = isSquad ? -1 : calculateFeasibility(p, avgRep, highW, totalV, gY).score;
    const t = p.technical, m = p.mental, ph = p.physical, h = p.hidden;

    allRows.push([
      esc(displayName(p)), p.age, p.natural_position, p.current_ability, p.potential_ability,
      esc(p.club_name), esc(p.league_name), esc(p.nationality), esc(p.second_nationality || ""),
      val(p.value), formatWage(p.wage), p.contract_expiry || "?", p.transfer_status || "-",
      p.is_on_loan ? "Y" : "N", p.is_listed ? "Y" : "N",
      p.reputation, p.world_reputation, isSquad ? "SQUAD" : "-", shortIds.has(p.id) ? "★" : "-",
      ff.slot, ff.fit, feas,
      r1?.role.short ?? "-", r1?.score ?? 0, r2?.role.short ?? "-", r2?.score ?? 0,
      playerAthletics(p), playerHiddenMentals(p), h.dirtiness,
      t.corners, t.crossing, t.dribbling, t.finishing, t.first_touch, t.free_kick, t.heading,
      t.long_shots, t.marking, t.passing, t.penalty, t.tackling, t.technique,
      m.aggression, m.anticipation, m.bravery, m.composure, m.concentration, m.decisions,
      m.determination, m.flair, m.leadership, m.off_the_ball, m.positioning, m.teamwork, m.vision, m.work_rate,
      ph.acceleration, ph.agility, ph.balance, ph.jumping, ph.natural_fitness, ph.pace, ph.stamina, ph.strength,
      h.consistency, h.pressure, h.important_matches, h.professionalism, h.injury_proneness, h.temperament,
      p.height, p.preferred_foot,
      p.positions.goalkeeper, p.positions.defender_left, p.positions.defender_central, p.positions.defender_right,
      p.positions.wing_back_left, p.positions.wing_back_right,
      p.positions.defensive_midfielder, p.positions.midfielder_central, p.positions.midfielder_left, p.positions.midfielder_right,
      p.positions.attacking_midfielder, p.positions.winger_left, p.positions.winger_right, p.positions.striker,
    ].join("\t"));
  }

  await write("all-players.tsv", allHeader + "\n" + allRows.join("\n"));

  const totalKB = Math.round((profile.length + squadRows.join("\n").length + allRows.join("\n").length) / 1024);
  console.log(`[AI DB] Written ${totalKB} KB across 3 files (${players.length} players)`);
  return totalKB;
}

export { DB_DIR };
