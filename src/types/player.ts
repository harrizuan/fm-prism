export interface Player {
  id: number;
  first_name: string;
  last_name: string;
  common_name: string;
  age: number;
  nationality: string;
  second_nationality: string;
  club_name: string;
  league_name: string;
  current_ability: number;
  potential_ability: number;
  reputation: number;
  home_reputation: number;
  current_reputation: number;
  world_reputation: number;
  value: number;
  wage: number;
  asking_price: number;
  release_clause: number;
  natural_position: string;
  preferred_foot: string;
  contract_expiry: string;
  transfer_status: string;
  is_on_loan: boolean;
  is_listed: boolean;
  morale: number;
  happiness: number;
  height: number;
  squad_number: number;
  condition: number;
  form: number;
  fitness: number;
  technical: TechnicalAttributes;
  mental: MentalAttributes;
  physical: PhysicalAttributes;
  hidden: HiddenAttributes;
  goalkeeping: GoalkeepingAttributes;
  positions: PositionMap;
}

export interface TechnicalAttributes {
  corners: number;
  crossing: number;
  dribbling: number;
  finishing: number;
  first_touch: number;
  free_kick: number;
  heading: number;
  long_shots: number;
  marking: number;
  passing: number;
  penalty: number;
  tackling: number;
  technique: number;
}

export interface MentalAttributes {
  aggression: number;
  anticipation: number;
  bravery: number;
  composure: number;
  concentration: number;
  creativity: number;  // LEGACY: FM26 renamed Creativity→Vision. This field contains flair data (same raw byte). Use vision for playmaker scoring.
  decisions: number;
  determination: number;
  flair: number;
  leadership: number;
  off_the_ball: number;
  positioning: number;
  teamwork: number;
  vision: number;
  work_rate: number;
}

export interface PhysicalAttributes {
  acceleration: number;
  agility: number;
  balance: number;
  jumping: number;
  natural_fitness: number;
  pace: number;
  stamina: number;
  strength: number;
}

export interface HiddenAttributes {
  adaptability: number;
  ambition: number;
  controversy: number;
  loyalty: number;
  pressure: number;
  professionalism: number;
  sportsmanship: number;
  temperament: number;
  consistency: number;
  dirtiness: number;
  important_matches: number;
  injury_proneness: number;
  versatility: number;
}

export interface GoalkeepingAttributes {
  aerial_reach: number;
  command_of_area: number;
  communication: number;
  eccentricity: number;
  handling: number;
  kicking: number;
  one_on_ones: number;
  punching: number;
  reflexes: number;
  rushing_out: number;
  throwing: number;
}

export interface PositionMap {
  goalkeeper: number;
  defender_central: number;
  defender_left: number;
  defender_right: number;
  wing_back_left: number;
  wing_back_right: number;
  defensive_midfielder: number;
  midfielder_central: number;
  midfielder_left: number;
  midfielder_right: number;
  attacking_midfielder: number;
  winger_left: number;
  winger_right: number;
  striker: number;
}

export interface GameInfo {
  connected: boolean;
  process_id: number;
  window_title: string;
  game_version: string;
  build_number: number;
  player_count: number;
}

export interface ManagerProfile {
  name: string;
  club_name: string;
  nationality: string;
  club_reputation: number;
  league_name: string;
  squad_size: number;
  squad_avg_ca: number;
  squad_avg_age: number;
  squad_avg_world_rep: number;
  squad_total_value: number;
  squad_total_wage: number;
  squad_highest_wage: number;
  game_year: number;
  national_team_name: string;
}

export interface LoadProgress {
  stage: string;
  current: number;
  total: number;
  message: string;
}

export function displayName(p: Player): string {
  if (p.common_name) return p.common_name;
  if (p.last_name) return p.first_name ? `${p.first_name} ${p.last_name}` : p.last_name;
  return p.first_name || "Unknown";
}

export function attrColor(val: number): string {
  if (val >= 19) return "attr-worldclass";
  if (val >= 17) return "attr-excellent";
  if (val >= 13) return "attr-good";
  if (val >= 9) return "attr-average";
  if (val >= 5) return "attr-poor";
  return "attr-terrible";
}

export function attrBgColor(val: number): string {
  if (val >= 19) return "bg-purple-500/20";
  if (val >= 17) return "bg-blue-500/20";
  if (val >= 13) return "bg-green-500/20";
  if (val >= 9) return "bg-yellow-500/20";
  if (val >= 5) return "bg-orange-500/20";
  return "bg-red-500/20";
}

export function formatValue(val: number): string {
  if (val >= 1_000_000_000) return `£${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 10_000_000) return `£${Math.round(val / 1_000_000)}M`;
  if (val >= 1_000_000) return `£${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 10_000) return `£${Math.round(val / 1_000)}K`;
  if (val >= 1_000) return `£${(val / 1_000).toFixed(1)}K`;
  return `£${val}`;
}

export function formatWage(val: number): string {
  if (val >= 1_000_000) return `£${(val / 1_000_000).toFixed(1)}M/w`;
  if (val >= 10_000) return `£${Math.round(val / 1_000)}K/w`;
  if (val >= 1_000) return `£${(val / 1_000).toFixed(1)}K/w`;
  return `£${val}/w`;
}

// ========================
// ROLE RATINGS ENGINE
// ========================
// FM calculates role score = Σ(attr × weight) / Σ(weights) on a 1-20 scale.
// From CAE's research (FM Scout, Feb 2022):
//   Total Weight = Position Weight + Role Weight × 5
//   Green key role_weight = 2 (adds +10), Blue preferable = 1 (adds +5)
// Our approximation: key attrs weighted 0.70, green attrs 0.30 of total score.
// This gives an effective ratio of ~2.33:1 — close to FM's ~2:1 observed ratio.
//
// Key vs Preferable classifications sourced from:
//   sortitoutsi.net/content/75078 (FM26 complete role guide, Nov 2025)
//   fmdossier.dev/guides/key-vs-preferable-attributes (FM26 analysis)
//   fm26tactics.com role guides (FM26 attribute highlights)
//
// Hidden attrs are NOT part of FM's role score but we add a small bonus
// to reflect their researched match-engine impact (FM-Arena FM26: "free CA").

export interface RoleDefinition {
  name: string;
  short: string;
  keyAttrs: string[];
  greenAttrs: string[];
  positions: string[];
}

// ROLES: 27 tactical roles — 22 verified from FM26 in-game data, 5 legacy approximations.
// Primary source: sortitoutsi FM26 complete role guide (edgardavids8, Nov 2025)
//   https://sortitoutsi.net/content/75078/fm26-important-attributes-for-every-role
// Cross-referenced with FM Dossier (fmdossier.dev/guides/key-vs-preferable-attributes),
// fm26tactics.com, and CAE's role ability calculator on FM Scout.
//
// key (green in-game) = higher weight in role score. preferable (blue) = lower weight.
// CAE formula: Total Weight = Position Weight + Role Weight × 5 (green=2, blue=1).
// Our approximation: key 70%, green 30%. Effective ratio ~2.33:1.
//
// CRITICAL: FM26 renamed "Creativity" → "Vision". All playmaker roles use "vision",
// NOT "creativity" which would double-count flair.
const ROLES: RoleDefinition[] = [
  // ─── STRIKERS ───
  // "Advanced Forward" has no exact FM26 match; approximated from Channel Forward data.
  { name: "Advanced Forward", short: "AF", positions: ["ST"],
    keyAttrs: ["finishing", "off_the_ball", "composure", "first_touch", "technique", "acceleration", "pace"],
    greenAttrs: ["dribbling", "anticipation", "decisions", "agility"] },
  // sortitoutsi FM26 Poacher: Key=Fin,Hea,Ant,Cmp,Con,OtB,Acc  Pref=FiT,Tec,Dec,Bal
  { name: "Poacher", short: "P", positions: ["ST"],
    keyAttrs: ["finishing", "heading", "anticipation", "composure", "concentration", "off_the_ball", "acceleration"],
    greenAttrs: ["first_touch", "technique", "decisions", "balance"] },
  // sortitoutsi FM26 Target Forward: Key=Fin,Hea,Agg,Bra,Cmp,OtB,Bal,Jum,Str  Pref=FiT,Ant,Dec,TW
  { name: "Target Man", short: "TM", positions: ["ST"],
    keyAttrs: ["finishing", "heading", "aggression", "bravery", "composure", "off_the_ball", "balance", "jumping", "strength"],
    greenAttrs: ["first_touch", "anticipation", "decisions", "teamwork"] },
  // sortitoutsi FM26 DLF: Key=Fin,FiT,Tec,Cmp,OtB,Str  Pref=Dri,Pas,Ant,Dec,TW,Vis,Bal
  { name: "Deep-Lying Forward", short: "DLF", positions: ["ST"],
    keyAttrs: ["finishing", "first_touch", "technique", "composure", "off_the_ball", "strength"],
    greenAttrs: ["dribbling", "passing", "anticipation", "decisions", "teamwork", "vision", "balance"] },
  // "Pressing Forward" has no exact FM26 IP match; based on pressing research + Tracking CF OOP.
  { name: "Pressing Forward", short: "PF", positions: ["ST"],
    keyAttrs: ["work_rate", "stamina", "aggression", "bravery", "off_the_ball", "finishing", "acceleration", "pace"],
    greenAttrs: ["anticipation", "teamwork", "determination", "strength"] },
  // sortitoutsi FM26 Centre Forward: Key=Fin,FiT,Hea,Tec,Cmp,OtB,Acc,Str  Pref=Dri,Pas,Ant,Dec,Agi,Bal,Jum,Pac
  { name: "Complete Forward", short: "CF", positions: ["ST"],
    keyAttrs: ["finishing", "first_touch", "heading", "technique", "composure", "off_the_ball", "acceleration", "strength"],
    greenAttrs: ["dribbling", "passing", "anticipation", "decisions", "agility", "balance", "jumping", "pace"] },
  // sortitoutsi FM26 False Nine: Key=Dri,FiT,Pas,Tec,Cmp,Dec,OtB,TW,Vis,Acc  Pref=Fin,Ant,Fla,Agi,Bal
  { name: "False Nine", short: "F9", positions: ["ST"],
    keyAttrs: ["dribbling", "first_touch", "passing", "technique", "composure", "decisions", "off_the_ball", "teamwork", "vision", "acceleration"],
    greenAttrs: ["finishing", "anticipation", "flair", "agility", "balance"] },
  // sortitoutsi FM26 Channel Forward: Key=Dri,Fin,FiT,Tec,Cmp,OtB,WR,Acc  Pref=Cro,Hea,Pas,Ant,Dec,Agi,Bal,Pac,Sta
  { name: "Channel Forward", short: "ChF", positions: ["ST"],
    keyAttrs: ["dribbling", "finishing", "first_touch", "technique", "composure", "off_the_ball", "work_rate", "acceleration"],
    greenAttrs: ["crossing", "heading", "passing", "anticipation", "decisions", "agility", "balance", "pace", "stamina"] },
  // ─── ATTACKING MIDFIELD ───
  // sortitoutsi FM26 AM: Key=FiT,Lon,Pas,Tec,Cmp,Fla,OtB  Pref=Cro,Dri,Fin,Ant,Dec,Vis,Acc,Agi
  { name: "Attacking Midfielder", short: "AM", positions: ["AMC"],
    keyAttrs: ["first_touch", "long_shots", "passing", "technique", "composure", "flair", "off_the_ball"],
    greenAttrs: ["crossing", "dribbling", "finishing", "anticipation", "decisions", "vision", "acceleration", "agility"] },
  // "Trequartista" has no exact FM26 match; legacy creative free-roamer approximation.
  { name: "Trequartista", short: "TQ", positions: ["AMC"],
    keyAttrs: ["vision", "flair", "technique", "dribbling", "first_touch", "passing", "off_the_ball", "composure"],
    greenAttrs: ["decisions", "acceleration", "agility", "finishing", "anticipation"] },
  // sortitoutsi FM26 Second Striker: Key=Fin,FiT,Ant,Cmp,OtB,Acc  Pref=Dri,Lon,Pas,Tec,Con,Dec,WR,Agi,Pac,Sta
  { name: "Second Striker", short: "SS", positions: ["AMC"],
    keyAttrs: ["finishing", "first_touch", "anticipation", "composure", "off_the_ball", "acceleration"],
    greenAttrs: ["dribbling", "long_shots", "passing", "technique", "concentration", "decisions", "work_rate", "agility", "pace", "stamina"] },
  // ─── WIDE ATTACKING ───
  // sortitoutsi FM26 IF: Key=Dri,FiT,Tec,Ant,Cmp,OtB,Acc,Agi  Pref=Cro,Fin,Lon,Pas,Fla,Vis,WR,Bal,Pac,Sta
  { name: "Inside Forward", short: "IF", positions: ["AML", "AMR"],
    keyAttrs: ["dribbling", "first_touch", "technique", "anticipation", "composure", "off_the_ball", "acceleration", "agility"],
    greenAttrs: ["crossing", "finishing", "long_shots", "passing", "flair", "vision", "work_rate", "balance", "pace", "stamina"] },
  // sortitoutsi FM26 Wide Forward: Key=Dri,FiT,Tec,Ant,OtB,Acc,Agi,Pac  Pref=Cro,Fin,Pas,Cmp,Fla,WR,Bal,Sta
  { name: "Wide Forward", short: "WF", positions: ["AML", "AMR"],
    keyAttrs: ["dribbling", "first_touch", "technique", "anticipation", "off_the_ball", "acceleration", "agility", "pace"],
    greenAttrs: ["crossing", "finishing", "passing", "composure", "flair", "work_rate", "balance", "stamina"] },
  // sortitoutsi FM26 Winger: Key=Cro,Dri,Tec,TW,Acc,Agi,Pac  Pref=FiT,Pas,Ant,Fla,OtB,WR,Bal,Sta
  // NOTE: sortitoutsi AND fm26tactics.com both confirm Technique is KEY (green).
  // FM Dossier previously called it blue — that was incorrect for the base Winger role.
  { name: "Winger", short: "W", positions: ["AML", "AMR", "ML", "MR"],
    keyAttrs: ["crossing", "dribbling", "technique", "teamwork", "acceleration", "agility", "pace"],
    greenAttrs: ["first_touch", "passing", "anticipation", "flair", "off_the_ball", "work_rate", "balance", "stamina"] },
  // sortitoutsi FM26 Inside Winger: Key=Dri,FiT,Tec,Cmp,TW,Acc,Agi  Pref=Cro,Lon,Pas,Ant,Fla,OtB,Vis,WR,Bal,Pac,Sta
  { name: "Inside Winger", short: "IW", positions: ["AML", "AMR", "ML", "MR"],
    keyAttrs: ["dribbling", "first_touch", "technique", "composure", "teamwork", "acceleration", "agility"],
    greenAttrs: ["crossing", "long_shots", "passing", "anticipation", "flair", "off_the_ball", "vision", "work_rate", "balance", "pace", "stamina"] },
  // sortitoutsi FM26 Wide Midfielder: Key=Cro,Pas,Tec,TW,WR,Pac,Sta  Pref=Dri,FiT,Ant,Cmp,OtB,Vis,Acc,Agi
  { name: "Wide Midfielder", short: "WM", positions: ["ML", "MR"],
    keyAttrs: ["crossing", "passing", "technique", "teamwork", "work_rate", "pace", "stamina"],
    greenAttrs: ["dribbling", "first_touch", "anticipation", "composure", "off_the_ball", "vision", "acceleration", "agility"] },
  // ─── CENTRAL MIDFIELD ───
  // sortitoutsi FM26 BBM (DM section): Key=Pas,Tck,OtB,TW,WR,Sta  Pref=Dri,Fin,FiT,Lon,Tec,Agg,Ant,Cmp,Dec,Pos,Acc,Bal,Pac,Str
  { name: "Box-to-Box Midfielder", short: "BBM", positions: ["MC"],
    keyAttrs: ["passing", "tackling", "off_the_ball", "teamwork", "work_rate", "stamina"],
    greenAttrs: ["dribbling", "finishing", "first_touch", "long_shots", "technique", "aggression", "anticipation", "composure", "decisions", "positioning", "acceleration", "balance", "pace", "strength"] },
  // sortitoutsi FM26 DLP: Key=FiT,Pas,Tec,Cmp,Dec,OtB,TW,Vis  Pref=Mrk,Tck,Ant,Con,Pos,WR,Bal,Sta
  { name: "Deep-Lying Playmaker", short: "DLP", positions: ["MC", "DM"],
    keyAttrs: ["first_touch", "passing", "technique", "composure", "decisions", "off_the_ball", "teamwork", "vision"],
    greenAttrs: ["marking", "tackling", "anticipation", "concentration", "positioning", "work_rate", "balance", "stamina"] },
  // sortitoutsi FM26 AP: Key=FiT,Pas,Tec,Cmp,Dec,OtB,TW,Vis  Pref=Cro,Dri,Ant,Fla,Acc,Agi
  { name: "Advanced Playmaker", short: "AP", positions: ["MC", "AMC"],
    keyAttrs: ["first_touch", "passing", "technique", "composure", "decisions", "off_the_ball", "teamwork", "vision"],
    greenAttrs: ["crossing", "dribbling", "anticipation", "flair", "acceleration", "agility"] },
  // "Mezzala" has no exact FM26 match; approximated from B2B Playmaker + Wide CM concepts.
  { name: "Mezzala", short: "MEZ", positions: ["MC"],
    keyAttrs: ["passing", "technique", "decisions", "dribbling", "acceleration", "off_the_ball", "vision"],
    greenAttrs: ["first_touch", "composure", "flair", "stamina", "agility"] },
  // "Ball-Winning Midfielder" has no exact FM26 match; based on DM + pressing/screening data.
  { name: "Ball-Winning Midfielder", short: "BWM", positions: ["MC", "DM"],
    keyAttrs: ["tackling", "aggression", "positioning", "stamina", "work_rate", "bravery", "teamwork"],
    greenAttrs: ["anticipation", "concentration", "strength", "marking", "composure"] },
  // ─── DEFENSIVE MIDFIELD ───
  // sortitoutsi FM26 DM: Key=Tck,Ant,Con,Pos,TW  Pref=FiT,Mrk,Pas,Agg,Cmp,Dec,WR,Sta,Str
  { name: "Defensive Midfielder", short: "DM(d)", positions: ["DM"],
    keyAttrs: ["tackling", "anticipation", "concentration", "positioning", "teamwork"],
    greenAttrs: ["first_touch", "marking", "passing", "aggression", "composure", "decisions", "work_rate", "stamina", "strength"] },
  // sortitoutsi FM26 Half-Back: Key=Hea,Mrk,Tck,Ant,Con,Pos,TW,Jum,Str  Pref=FiT,Pas,Agg,Bra,Cmp,Dec,WR,Sta
  { name: "Half-Back", short: "HB", positions: ["DM"],
    keyAttrs: ["heading", "marking", "tackling", "anticipation", "concentration", "positioning", "teamwork", "jumping", "strength"],
    greenAttrs: ["first_touch", "passing", "aggression", "bravery", "composure", "decisions", "work_rate", "stamina"] },
  // ─── DEFENCE ───
  // sortitoutsi FM26 WB: Key=Cro,Mrk,Tck,TW,WR,Acc,Pac,Sta  Pref=Dri,FiT,Pas,Tec,Ant,Con,Dec,OtB,Pos,Agi,Bal
  { name: "Wing-Back", short: "WB", positions: ["WBL", "WBR"],
    keyAttrs: ["crossing", "marking", "tackling", "teamwork", "work_rate", "acceleration", "pace", "stamina"],
    greenAttrs: ["dribbling", "first_touch", "passing", "technique", "anticipation", "concentration", "decisions", "off_the_ball", "positioning", "agility", "balance"] },
  // sortitoutsi FM26 FB: Key=Mrk,Tck,Ant,Con,Pos,TW,Acc  Pref=Cro,Dri,Pas,Tec,Dec,WR,Agi,Pac,Sta
  { name: "Full-Back", short: "FB", positions: ["DL", "DR"],
    keyAttrs: ["marking", "tackling", "anticipation", "concentration", "positioning", "teamwork", "acceleration"],
    greenAttrs: ["crossing", "dribbling", "passing", "technique", "decisions", "work_rate", "agility", "pace", "stamina"] },
  // sortitoutsi FM26 BPD: Key=Hea,Mrk,Pas,Tck,Ant,Cmp,Pos,Jum,Str  Pref=FiT,Tec,Agg,Bra,Con,Dec,Vis,Pac
  { name: "Ball-Playing Defender", short: "BPD", positions: ["DC"],
    keyAttrs: ["heading", "marking", "passing", "tackling", "anticipation", "composure", "positioning", "jumping", "strength"],
    greenAttrs: ["first_touch", "technique", "aggression", "bravery", "concentration", "decisions", "vision", "pace"] },
  // sortitoutsi FM26 CD: Key=Hea,Mrk,Tck,Ant,Pos,Jum,Str  Pref=Agg,Bra,Cmp,Con,Dec,Pac
  { name: "Central Defender", short: "CD", positions: ["DC"],
    keyAttrs: ["heading", "marking", "tackling", "anticipation", "positioning", "jumping", "strength"],
    greenAttrs: ["aggression", "bravery", "composure", "concentration", "decisions", "pace"] },
  // sortitoutsi FM26 GK: Key=AeR,CoA,Com,Han,Ref,Agi,Con,Pos  Pref=Kic,1v1,Thr,Ant,Dec
  { name: "Goalkeeper", short: "GK", positions: ["GK"],
    keyAttrs: ["aerial_reach", "command_of_area", "communication", "handling", "reflexes", "agility", "concentration", "positioning"],
    greenAttrs: ["kicking", "one_on_ones", "throwing", "anticipation", "decisions"] },
];

function getPlayerAttrValue(p: Player, attr: string): number {
  const t = p.technical as unknown as Record<string, number>;
  const m = p.mental as unknown as Record<string, number>;
  const ph = p.physical as unknown as Record<string, number>;
  const gk = p.goalkeeping as unknown as Record<string, number>;
  const h = p.hidden as unknown as Record<string, number>;
  return t[attr] ?? m[attr] ?? ph[attr] ?? gk[attr] ?? h[attr] ?? 0;
}

export interface RoleRating {
  role: RoleDefinition;
  score: number;
  max: number;
}

export function calculateRoleRatings(p: Player): RoleRating[] {
  return ROLES.map((role) => {
    const keyTotal = role.keyAttrs.reduce((s, a) => s + getPlayerAttrValue(p, a), 0);
    const greenTotal = role.greenAttrs.reduce((s, a) => s + getPlayerAttrValue(p, a), 0);
    const keyMax = role.keyAttrs.length * 20;
    const greenMax = role.greenAttrs.length * 20;
    // ── Core role score ──
    // FM formula: Σ(attr × weight) / Σ(weights) → 1-20 scale
    // We approximate: key attrs (green) at 70% weight, preferable (blue) at 30%
    // Effective ratio ~2.33:1, close to FM's observed ~2:1 (key=+10, pref=+5)
    const baseScore = ((keyTotal / keyMax) * 0.7 + (greenTotal / greenMax) * 0.3) * 100;

    // ── Hidden attribute bonus (our custom addition, NOT in FM's role score) ──
    // FM-Arena data mining confirms hidden attrs cost 0 CA but impact match output.
    // Pressure worth ~14.9 pts/season, Consistency affects ~15% of performances.
    // We add a small bonus to reflect "real output" beyond pure attribute fitness.
    const conBonus = (p.hidden.consistency / 20) * 3.0;      // 0-3 pts
    const preBonus = (p.hidden.pressure / 20) * 2.5;         // 0-2.5 pts
    const impBonus = (p.hidden.important_matches / 20) * 2.0; // 0-2 pts
    const proBonus = (p.hidden.professionalism / 20) * 1.5;  // 0-1.5 pts (training)
    const hBonus = conBonus + preBonus + impBonus + proBonus;  // max 9 pts

    const score = Math.min(100, baseScore + hBonus);
    return { role, score: Math.round(score * 10) / 10, max: 100 };
  });
}

export function bestRoles(p: Player, count = 5): RoleRating[] {
  return calculateRoleRatings(p)
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}

// ─── Formation fit helpers (shared across pages) ─────────────
// Best LLM formation role keys for quick scouting
const BEST_LLM_SLOTS: { label: string; posKey: string; ipKey: string; oopKey: string }[] = [
  { label: "GK",  posKey: "goalkeeper",          ipKey: "GK",    oopKey: "GK" },
  { label: "DL",  posKey: "defender_left",        ipKey: "FB",    oopKey: "FB" },
  { label: "DCL", posKey: "defender_central",     ipKey: "BPD",   oopKey: "CD" },
  { label: "DCR", posKey: "defender_central",     ipKey: "BPD",   oopKey: "CD" },
  { label: "DR",  posKey: "defender_right",       ipKey: "FB",    oopKey: "FB" },
  { label: "DML", posKey: "defensive_midfielder", ipKey: "DM(d)", oopKey: "DM(d)" },
  { label: "DMR", posKey: "defensive_midfielder", ipKey: "DM(d)", oopKey: "BBM" },
  { label: "AML", posKey: "winger_left",          ipKey: "W",     oopKey: "W" },
  { label: "AMC", posKey: "attacking_midfielder", ipKey: "AM",    oopKey: "BBM" },
  { label: "AMR", posKey: "winger_right",         ipKey: "W",     oopKey: "W" },
  { label: "ST",  posKey: "striker",              ipKey: "CF",    oopKey: "CF" },
];

function roleScoreForShort(p: Player, short: string): number {
  if (!short) return 0;
  return Math.round(calculateRoleRatings(p).find((r) => r.role.short === short)?.score ?? 0);
}

export function bestFormationFit(p: Player): { slot: string; fit: number; ipScore: number; oopScore: number } {
  let best = { slot: "—", fit: 0, ipScore: 0, oopScore: 0 };
  const posMap = p.positions as unknown as Record<string, number>;
  for (const s of BEST_LLM_SLOTS) {
    const posFam = (posMap[s.posKey] ?? 0);
    if (posFam < 5) continue;
    // Position familiarity multiplier — aligned with official FM bands:
    // Natural 18-20, Accomplished 15-17, Competent 12-14, Unconvincing 9-11, Awkward 5-8
    // Multipliers calibrated from FM-Arena position testing data (FM23/FM26):
    // Natural≈100%, Accomplished≈90%, Competent≈75%, Unconvincing≈60%, Awkward≈40%
    const posFit = posFam >= 18 ? 1.0 : posFam >= 15 ? 0.90 : posFam >= 12 ? 0.75 : posFam >= 9 ? 0.60 : posFam >= 5 ? 0.40 : 0.20;
    const ip = roleScoreForShort(p, s.ipKey);
    const oop = roleScoreForShort(p, s.oopKey);
    const combined = Math.round((ip * 0.6 + oop * 0.4) * posFit);
    if (combined > best.fit) best = { slot: s.label, fit: combined, ipScore: ip, oopScore: oop };
  }
  return best;
}

export function playerAthletics(p: Player): number {
  return Math.round((p.physical.pace + p.physical.acceleration + p.physical.jumping + p.physical.agility) / 4);
}

export function playerHiddenMentals(p: Player): number {
  return Math.round((p.hidden.consistency + p.hidden.pressure + p.hidden.important_matches + p.hidden.professionalism) / 4);
}

// ========================
// TRANSFER FEASIBILITY ENGINE
// ========================
// Heuristic model based on FM's transfer mechanics:
// - Club reputation vs player reputation (primary factor)
// - Wage affordability (can we match their demands?)
// - Contract status (listed, expiring = easier)
// - Player personality (ambition, loyalty affect willingness)
// - Age & career stage
//
// Reputation scale in FM: 0-10,000 for both clubs and players.
// Rule: players generally won't join clubs with significantly lower reputation.
// High ambition = wants bigger clubs. Low loyalty = easier to unsettle.

export type FeasibilityLevel = "very_likely" | "likely" | "possible" | "difficult" | "very_unlikely" | "unrealistic";

export interface TransferFeasibility {
  level: FeasibilityLevel;
  score: number;         // 0-100
  reasons: string[];
  repGap: number;        // reputation gap (positive = player > club)
  affordable: boolean;
  wageFeasible: boolean;
}

export function calculateFeasibility(
  player: Player,
  clubAvgWorldRep: number,
  highestWage: number,
  totalSquadValue: number,
  gameYear = 2026,
): TransferFeasibility {
  const reasons: string[] = [];
  let score = 50; // start neutral

  // ═══════════════════════════════════════════════════════════
  // 1. REPUTATION GAP (35-point swing) — Research: biggest factor
  // Reputation scale: 0-10,000 (0-2750 local, 2750-4000 regional,
  // 4000-6000 national, 6000-8000 continental, 8000-10000 world class)
  // ═══════════════════════════════════════════════════════════
  const playerRep = Math.max(player.world_reputation, player.current_reputation);
  const repGap = playerRep - clubAvgWorldRep;

  if (repGap <= -2000) {
    score += 25;
    reasons.push("Player far below our level — will jump at the chance");
  } else if (repGap <= -500) {
    score += 18;
    reasons.push("Player below our level — very interested");
  } else if (repGap <= 500) {
    score += 10;
    reasons.push("Similar reputation level — realistic target");
  } else if (repGap <= 1500) {
    score += 0;
    reasons.push("Slight reputation stretch — needs good offer");
  } else if (repGap <= 2500) {
    score -= 15;
    reasons.push("Notable reputation gap — needs convincing project");
  } else if (repGap <= 4000) {
    score -= 30;
    reasons.push("Large gap — very unlikely without CL or huge wages");
  } else {
    score -= 40;
    reasons.push("Unrealistic — world-class player won't consider us");
  }

  // ═══════════════════════════════════════════════════════════
  // 2. WAGE AFFORDABILITY (15-point swing) — Research: "wage demands
  // rise with club reputation, squad wage levels, and player ambition"
  // Compare vs highest AND implied average (highest × 0.6)
  // ═══════════════════════════════════════════════════════════
  const wageRatio = highestWage > 0 ? player.wage / highestWage : 99;
  if (player.wage === 0 || wageRatio <= 0.3) {
    score += 10;
    reasons.push("Wage easily affordable — well below our structure");
  } else if (wageRatio <= 0.7) {
    score += 6;
    reasons.push("Wage comfortably within structure");
  } else if (wageRatio <= 1.0) {
    score += 2;
    reasons.push("Wage at top of our structure — manageable");
  } else if (wageRatio <= 1.5) {
    score -= 6;
    reasons.push("Wage above our highest — would disrupt structure");
  } else if (wageRatio <= 2.5) {
    score -= 12;
    reasons.push("Wage far exceeds our wage bill");
  } else {
    score -= 15;
    reasons.push("Wage completely unaffordable");
  }

  // ═══════════════════════════════════════════════════════════
  // 3. TRANSFER FEE vs SQUAD VALUE (12-point swing)
  // Research: "asking price driven by player importance, contract length,
  // club finances, rivalry, registration rules, release clauses"
  // Use asking_price when available, else guide value
  // ═══════════════════════════════════════════════════════════
  const price = player.asking_price > 0 ? player.asking_price : player.value;
  const valueRatio = totalSquadValue > 0 ? price / totalSquadValue : 0;
  const affordable = price === 0 || valueRatio < 0.25;

  if (price === 0) {
    score += 10;
    reasons.push("Free agent — no transfer fee required");
  } else if (valueRatio < 0.03) {
    score += 6;
    reasons.push("Very affordable transfer fee");
  } else if (valueRatio < 0.10) {
    score += 2;
    reasons.push("Reasonable investment");
  } else if (valueRatio < 0.25) {
    score -= 4;
    reasons.push("Significant investment — big chunk of squad value");
  } else {
    score -= 12;
    reasons.push("Transfer fee likely prohibitive");
  }

  // ═══════════════════════════════════════════════════════════
  // 4. CONTRACT STATUS (12-point swing) — Research: "contract length
  // affects willingness + fee; listed players much easier to buy"
  // ═══════════════════════════════════════════════════════════
  if (player.is_listed || player.transfer_status.includes("Listed")) {
    score += 10;
    reasons.push("Transfer listed — club wants to sell");
  } else if (player.transfer_status.includes("Release")) {
    score += 8;
    reasons.push("Set for release — available cheaply");
  } else if (player.transfer_status.includes("Not for Sale")) {
    score -= 10;
    reasons.push("Not for sale — club will reject or demand premium");
  }

  if (player.contract_expiry && player.contract_expiry !== "Unknown") {
    const parts = player.contract_expiry.split("-");
    if (parts.length >= 1) {
      const expiryYear = parseInt(parts[0], 10);
      if (!isNaN(expiryYear)) {
        const yearsLeft = expiryYear - gameYear;
        if (yearsLeft <= 0) {
          score += 12;
          reasons.push("Contract expired — free transfer");
        } else if (yearsLeft <= 1) {
          score += 8;
          reasons.push("Last year of contract — club may sell cheaply / pre-contract");
        } else if (yearsLeft === 2) {
          score += 2;
          reasons.push("2 years left — reasonable negotiating position");
        } else if (yearsLeft >= 4) {
          score -= 5;
          reasons.push("Long contract (4yr+) — club in strong position");
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 5. PERSONALITY (12-point swing) — Research: "Ambition increases
  // appetite for bigger clubs. Loyalty reduces transfer interest.
  // Adaptability affects settling speed."
  // ═══════════════════════════════════════════════════════════
  const amb = player.hidden.ambition;
  const loy = player.hidden.loyalty;

  if (amb >= 16 && repGap > 500) {
    score -= 8;
    reasons.push("High ambition + we're below him — wants bigger clubs");
  } else if (amb >= 16 && repGap <= 0) {
    score += 4;
    reasons.push("High ambition — motivated by our level/project");
  } else if (amb <= 8 && amb > 0) {
    score += 4;
    reasons.push("Low ambition — less demanding about club status");
  }

  if (loy >= 16) {
    score -= 6;
    reasons.push("Very loyal — hard to unsettle from current club");
  } else if (loy <= 6 && loy > 0) {
    score += 4;
    reasons.push("Low loyalty — open to moving");
  }

  // Temperament affects negotiation difficulty
  if (player.hidden.temperament <= 6 && player.hidden.temperament > 0) {
    score -= 2;
    reasons.push("Poor temperament — difficult negotiator");
  }

  // ═══════════════════════════════════════════════════════════
  // 6. AGE MODIFIER (8-point swing) — Research: "young players see
  // lower clubs as development opportunity; veterans accept step down"
  // ═══════════════════════════════════════════════════════════
  if (player.age <= 20) {
    score += 5;
    reasons.push("Young — may see us as development opportunity");
  } else if (player.age <= 23 && repGap > 0) {
    score += 3;
    reasons.push("Young player wanting game time over prestige");
  } else if (player.age >= 33) {
    score += 6;
    reasons.push("33+ — likely to accept a step down for playing time");
  } else if (player.age >= 30) {
    score += 3;
    reasons.push("30+ — may prioritize stability over ambition");
  }

  // ═══════════════════════════════════════════════════════════
  // 7. DIRTINESS PENALTY (Research: "10x more impactful than injury
  // proneness — cards, penalties, sending off")
  // ═══════════════════════════════════════════════════════════
  if (player.hidden.dirtiness >= 16) {
    score -= 3;
    reasons.push("⚠ Very dirty — high card/sending off risk");
  }

  // Clamp and classify
  score = Math.max(0, Math.min(100, score));

  // Hard cap for extreme rep gaps — in FM, world-class players literally
  // can't be approached by tiny clubs regardless of other factors
  if (repGap > 4000) score = Math.min(score, 8);
  else if (repGap > 3000) score = Math.min(score, 20);
  else if (repGap > 2000) score = Math.min(score, 35);

  const wageFeasible = wageRatio <= 1.5;

  let level: FeasibilityLevel;
  if (score >= 80) level = "very_likely";
  else if (score >= 65) level = "likely";
  else if (score >= 50) level = "possible";
  else if (score >= 35) level = "difficult";
  else if (score >= 20) level = "very_unlikely";
  else level = "unrealistic";

  return { level, score, reasons, repGap, affordable, wageFeasible };
}

export function feasibilityColor(level: FeasibilityLevel): string {
  switch (level) {
    case "very_likely": return "text-green-400";
    case "likely": return "text-emerald-400";
    case "possible": return "text-yellow-400";
    case "difficult": return "text-orange-400";
    case "very_unlikely": return "text-red-400";
    case "unrealistic": return "text-red-600";
  }
}

export function feasibilityBg(level: FeasibilityLevel): string {
  switch (level) {
    case "very_likely": return "bg-green-500/20 border-green-500/30";
    case "likely": return "bg-emerald-500/20 border-emerald-500/30";
    case "possible": return "bg-yellow-500/20 border-yellow-500/30";
    case "difficult": return "bg-orange-500/20 border-orange-500/30";
    case "very_unlikely": return "bg-red-500/20 border-red-500/30";
    case "unrealistic": return "bg-red-500/10 border-red-500/20";
  }
}

export function feasibilityLabel(level: FeasibilityLevel): string {
  switch (level) {
    case "very_likely": return "Very Likely";
    case "likely": return "Likely";
    case "possible": return "Possible";
    case "difficult": return "Difficult";
    case "very_unlikely": return "Very Unlikely";
    case "unrealistic": return "Unrealistic";
  }
}

// ─── Shared color helpers (used across all pages) ─────────────
export function caColor(ca: number): string {
  if (ca >= 170) return "text-purple-400";
  if (ca >= 150) return "text-blue-400";
  if (ca >= 130) return "text-fm-accent";
  if (ca >= 100) return "text-green-400";
  if (ca >= 70) return "text-yellow-400";
  return "text-zinc-400";
}

export function paColor(pa: number): string {
  if (pa >= 180) return "text-purple-400";
  if (pa >= 160) return "text-blue-400";
  if (pa >= 140) return "text-fm-accent";
  if (pa >= 120) return "text-green-400";
  if (pa >= 90) return "text-yellow-400";
  return "text-zinc-400";
}

export function ageColor(age: number): string {
  if (age <= 21) return "text-emerald-400";
  if (age <= 23) return "text-green-300";
  if (age <= 29) return "text-zinc-400";
  if (age <= 32) return "text-amber-400";
  return "text-red-400";
}

export function fitColorClass(score: number): string {
  if (score >= 70) return "text-green-400";
  if (score >= 55) return "text-emerald-300";
  if (score >= 40) return "text-yellow-400";
  return "text-orange-400";
}

export function feasibilityScoreColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 65) return "text-emerald-300";
  if (score >= 50) return "text-yellow-400";
  if (score >= 35) return "text-orange-400";
  return "text-red-400";
}

// ========================
// SQUAD NEEDS ANALYSIS
// ========================

export interface PositionNeed {
  position: string;
  count: number;
  avgCA: number;
  status: "critical" | "thin" | "ok" | "deep";
  recommendation: string;
}

const MIN_DEPTH: Record<string, number> = {
  GK: 2, DC: 3, DL: 2, DR: 2, DM: 2, MC: 3, ML: 2, MR: 2,
  AMC: 2, AML: 2, AMR: 2, ST: 2, WBL: 1, WBR: 1,
};

export function analyzeSquadNeeds(squadPlayers: Player[]): PositionNeed[] {
  const POS_LIST = ["GK", "DC", "DL", "DR", "WBL", "WBR", "DM", "MC", "ML", "MR", "AMC", "AML", "AMR", "ST"];
  const POS_KEY_MAP: Record<string, keyof PositionMap> = {
    GK: "goalkeeper", DC: "defender_central", DL: "defender_left", DR: "defender_right",
    WBL: "wing_back_left", WBR: "wing_back_right", DM: "defensive_midfielder", MC: "midfielder_central",
    ML: "midfielder_left", MR: "midfielder_right", AMC: "attacking_midfielder", AML: "winger_left",
    AMR: "winger_right", ST: "striker",
  };
  return POS_LIST.map((pos) => {
    // Count natural players (exact match) AND versatile cover (posRating ≥ 14)
    const natural = squadPlayers.filter((p) => p.natural_position === pos);
    const posKey = POS_KEY_MAP[pos];
    const canCover = posKey
      ? squadPlayers.filter((p) => p.natural_position !== pos && (p.positions as unknown as Record<string, number>)[posKey] >= 14)
      : [];
    const count = natural.length;
    const coverCount = canCover.length;
    const avgCA = count > 0 ? natural.reduce((s, p) => s + p.current_ability, 0) / count : 0;
    const minReq = MIN_DEPTH[pos] || 2;

    let status: PositionNeed["status"];
    let recommendation: string;
    if (count === 0 && coverCount === 0) {
      status = "critical";
      recommendation = `No ${pos} in squad — URGENT signing needed`;
    } else if (count === 0 && coverCount > 0) {
      status = "thin";
      recommendation = `No natural ${pos} — ${coverCount} can cover but signing recommended`;
    } else if (count < minReq) {
      status = "thin";
      recommendation = `Only ${count} ${pos}(s)${coverCount > 0 ? ` + ${coverCount} cover` : ""} — need ${minReq - count} more for depth`;
    } else if (count <= minReq + 1) {
      status = "ok";
      recommendation = `${count} ${pos}(s) — adequate depth`;
    } else {
      status = "deep";
      recommendation = `${count} ${pos}(s) — consider selling surplus`;
    }
    return { position: pos, count, avgCA, status, recommendation };
  });
}

// ========================
// LEAGUE ANALYSIS
// ========================

export interface ClubAnalysis {
  clubName: string;
  playerCount: number;
  avgCA: number;
  avgPA: number;
  avgAge: number;
  totalValue: number;
  bestPlayer: string;
  bestPlayerCA: number;
}

// ========================
// SCOUTING INTELLIGENCE — Research-backed composite scores
// ========================
// Each score distills complex multi-attribute interactions into a single
// actionable number. Weights derived from FM match engine research:
// - FMAnalytics community regression analysis (2024-2026)
// - Zealand's attribute impact testing methodology
// - FMRTE/FMSuperScout statistical correlation data

/**
 * Development Trajectory Score (0-100)
 * Predicts how much a player will still develop.
 * Research: players develop fastest 17-23, slow 24-27, plateau 28+.
 * Professionalism is the #1 predictor of development speed (~35% weight).
 * Ambition drives willingness to push limits (~15% weight).
 */
export function developmentTrajectory(p: Player): number {
  const growth = p.potential_ability - p.current_ability;
  if (growth <= 0) return 0;

  // Age-based development window (research: peaks at ~21, steep drop after 24)
  let ageFactor: number;
  if (p.age <= 18)      ageFactor = 1.0;
  else if (p.age <= 20) ageFactor = 0.95;
  else if (p.age <= 22) ageFactor = 0.80;
  else if (p.age <= 24) ageFactor = 0.50;
  else if (p.age <= 26) ageFactor = 0.25;
  else if (p.age <= 28) ageFactor = 0.10;
  else                  ageFactor = 0.03;

  // Professionalism: #1 training development multiplier
  const proFactor = 0.65 + (p.hidden.professionalism / 20) * 0.35;
  // Ambition: drives player to push beyond comfort zone
  const ambFactor = 0.80 + (p.hidden.ambition / 20) * 0.20;
  // Determination: correlates with development persistence
  const detFactor = 0.85 + (p.mental.determination / 20) * 0.15;

  const raw = (growth / 80) * ageFactor * proFactor * ambFactor * detFactor * 100;
  return Math.round(Math.min(100, Math.max(0, raw)) * 10) / 10;
}

/**
 * Big Game Rating (0-100)
 * Predicts performance in high-pressure matches (derbies, finals, CL knockouts).
 * Research: ~25% of matches are "important" — players with low pressure/big-match
 * hidden attrs see 15-30% performance drops in these games.
 */
export function bigGameRating(p: Player): number {
  const raw = (
    p.hidden.pressure * 0.25 +
    p.hidden.important_matches * 0.25 +
    p.mental.composure * 0.20 +
    p.mental.concentration * 0.15 +
    p.hidden.consistency * 0.15
  ) / 20 * 100;
  return Math.round(Math.min(100, raw) * 10) / 10;
}

/**
 * Injury Risk Index (0-100, higher = MORE risky)
 * Research: injury_proneness is the primary factor (exponential impact above 12).
 * Natural fitness affects recovery speed. Professionalism affects injury prevention
 * through training discipline. Aggression correlates with tackle-related injuries.
 */
export function injuryRiskIndex(p: Player): number {
  const base = p.hidden.injury_proneness * 5;
  const nfMitigation = p.physical.natural_fitness * 1.2;
  const proMitigation = p.hidden.professionalism * 0.4;
  const aggRisk = Math.max(0, p.mental.aggression - 14) * 0.8;
  const raw = base - nfMitigation - proMitigation + aggRisk;
  return Math.round(Math.min(100, Math.max(0, raw)) * 10) / 10;
}

/**
 * Pressing Intensity Score (0-100)
 * For gegenpressing/high-press tactical systems (Klopp, Ten Hag, Slot).
 * Research: work_rate and stamina are binary requirements (below 12 = system breaks),
 * aggression/determination drive pressing triggers, pace enables recovery.
 */
export function pressingIntensity(p: Player): number {
  const raw = (
    p.mental.work_rate * 0.22 +
    p.physical.stamina * 0.18 +
    p.mental.aggression * 0.13 +
    p.mental.determination * 0.10 +
    p.mental.teamwork * 0.10 +
    p.physical.pace * 0.09 +
    p.physical.acceleration * 0.09 +
    p.mental.anticipation * 0.09
  ) / 20 * 100;
  return Math.round(Math.min(100, raw) * 10) / 10;
}

/**
 * Consistency Index (0-100)
 * Predicts match-to-match reliability (low variance in ratings).
 * Research: consistency hidden attr is THE primary factor (~40% weight).
 * Professional players maintain condition better = more consistent.
 */
export function consistencyIndex(p: Player): number {
  const raw = (
    p.hidden.consistency * 0.40 +
    p.hidden.important_matches * 0.20 +
    p.hidden.pressure * 0.15 +
    p.hidden.temperament * 0.10 +
    p.hidden.professionalism * 0.15
  ) / 20 * 100;
  return Math.round(Math.min(100, raw) * 10) / 10;
}

/**
 * Set Piece Threat (0-100)
 * Research: set pieces account for ~30% of goals in professional football.
 * Dead-ball delivery (FK, corners) + heading + technique for execution.
 */
export function setPieceThreat(p: Player): number {
  const raw = (
    p.technical.free_kick * 0.20 +
    p.technical.corners * 0.15 +
    p.technical.crossing * 0.15 +
    p.technical.heading * 0.15 +
    p.technical.technique * 0.10 +
    p.mental.composure * 0.10 +
    p.technical.long_shots * 0.10 +
    p.mental.flair * 0.05
  ) / 20 * 100;
  return Math.round(Math.min(100, raw) * 10) / 10;
}

/**
 * Value Efficiency Rating (0-100)
 * CA points per monetary unit, adjusted for age and contract status.
 * Research: FM's transfer market overvalues young players by ~40% and
 * undervalues 28-31 year olds in their actual peak output window.
 */
export function valueEfficiency(p: Player): number {
  if (p.value <= 0) return 100; // free = infinite efficiency
  const caPerMil = p.current_ability / (p.value / 1_000_000);
  let ageMult: number;
  if (p.age <= 21)      ageMult = 0.6;  // young = premium expected
  else if (p.age <= 24) ageMult = 0.8;
  else if (p.age <= 29) ageMult = 1.0;  // prime value
  else if (p.age <= 32) ageMult = 1.3;  // often undervalued
  else                  ageMult = 1.5;  // steep discount
  const raw = Math.min(100, caPerMil * ageMult * 3.5);
  return Math.round(Math.max(0, raw) * 10) / 10;
}

/**
 * Leadership Score (0-100)
 * Identifies potential captains and dressing room leaders.
 * Research: leadership + determination drive team talks and morale.
 * Composure under pressure prevents panic spread to teammates.
 */
export function leadershipScore(p: Player): number {
  const raw = (
    p.mental.leadership * 0.30 +
    p.mental.determination * 0.20 +
    p.mental.teamwork * 0.15 +
    p.mental.composure * 0.12 +
    p.mental.bravery * 0.08 +
    p.hidden.professionalism * 0.08 +
    p.hidden.temperament * 0.07
  ) / 20 * 100;
  return Math.round(Math.min(100, raw) * 10) / 10;
}

export function analyzeLeague(players: Player[], leagueName: string): ClubAnalysis[] {
  const leaguePlayers = players.filter((p) => p.league_name === leagueName && p.club_name);
  const clubs: Record<string, Player[]> = {};
  for (const p of leaguePlayers) {
    if (!clubs[p.club_name]) clubs[p.club_name] = [];
    clubs[p.club_name].push(p);
  }
  return Object.entries(clubs)
    .map(([name, pls]) => {
      const best = pls.reduce((a, b) => (b.current_ability > a.current_ability ? b : a), pls[0]);
      return {
        clubName: name,
        playerCount: pls.length,
        avgCA: pls.reduce((s, p) => s + p.current_ability, 0) / pls.length,
        avgPA: pls.reduce((s, p) => s + p.potential_ability, 0) / pls.length,
        avgAge: pls.reduce((s, p) => s + p.age, 0) / pls.length,
        totalValue: pls.reduce((s, p) => s + p.value, 0),
        bestPlayer: displayName(best),
        bestPlayerCA: best.current_ability,
      };
    })
    .sort((a, b) => b.avgCA - a.avgCA);
}
