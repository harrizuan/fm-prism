import { useAppStore } from "@/stores/useAppStore";
import { useMemo, useState } from "react";
import {
  displayName, formatValue, formatWage, analyzeLeague,
  attrColor, bestRoles, calculateRoleRatings,
} from "@/types/player";
import { generateAIDatabase } from "@/utils/aiBrief";
import type { Player, PositionMap } from "@/types/player";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer,
} from "recharts";
import { X, Star, GitCompare, Download } from "lucide-react";

// ─── Slot with FM26 dual-role + scoring keys ─────────────────
type Slot = {
  label: string;
  posKey: keyof PositionMap;
  x: number; y: number;
  ipRole: string; oopRole: string;
  ipKey: string;  // ROLES[].short for IP fit
  oopKey: string; // ROLES[].short for OOP fit
};

function S(l: string, pk: keyof PositionMap, x: number, y: number, ip: string, oop: string, ik: string, ok: string): Slot {
  return { label: l, posKey: pk, x, y, ipRole: ip, oopRole: oop, ipKey: ik, oopKey: ok };
}

// ─── Formations (IP / OOP roles + scoring keys) ──────────────
// Best LLM: extracted from FM26 Tactics Planner (Combined view)
// OOP key maps: CB→CD, CM→BBM, WMF→W, DM→DM(d)
const FORMATIONS: Record<string, { name: string; slots: Slot[] }> = {
  "best-llm": {
    name: "⚡ Best LLM",
    slots: [
      S("GK",  "goalkeeper",          50, 92, "GK",  "GK",  "GK",    "GK"),
      S("DL",  "defender_left",        12, 75, "FB",  "FB",  "FB",    "FB"),
      S("DCL", "defender_central",     36, 79, "BCB", "CB",  "BPD",   "CD"),
      S("DCR", "defender_central",     64, 79, "BCB", "CB",  "BPD",   "CD"),
      S("DR",  "defender_right",       88, 75, "FB",  "FB",  "FB",    "FB"),
      S("DML", "defensive_midfielder", 35, 57, "DM",  "DM",  "DM(d)", "DM(d)"),
      S("DMR", "defensive_midfielder", 65, 57, "DM",  "CM",  "DM(d)", "BBM"),
      S("AML", "winger_left",          12, 33, "W",   "WMF", "W",     "W"),
      S("AMC", "attacking_midfielder", 50, 37, "AM",  "CM",  "AM",    "BBM"),
      S("AMR", "winger_right",         88, 33, "W",   "WMF", "W",     "W"),
      S("ST",  "striker",              50, 12, "CFD", "CFD", "CF",    "CF"),
    ],
  },
  "4-3-3": {
    name: "4-3-3",
    slots: [
      S("GK",  "goalkeeper",        50, 92, "GK",  "GK",  "GK",  "GK"),
      S("DL",  "defender_left",      12, 75, "FB",  "FB",  "FB",  "FB"),
      S("DCL", "defender_central",   36, 79, "BPD", "CB",  "BPD", "CD"),
      S("DCR", "defender_central",   64, 79, "CD",  "CB",  "CD",  "CD"),
      S("DR",  "defender_right",     88, 75, "FB",  "FB",  "FB",  "FB"),
      S("MCL", "midfielder_central", 28, 55, "BBM", "CM",  "BBM", "BBM"),
      S("MC",  "midfielder_central", 50, 59, "DLP", "DM",  "DLP", "DM(d)"),
      S("MCR", "midfielder_central", 72, 55, "MEZ", "CM",  "MEZ", "BBM"),
      S("AML", "winger_left",        12, 28, "IF",  "WMF", "IF",  "W"),
      S("ST",  "striker",            50, 12, "AF",  "AF",  "AF",  "AF"),
      S("AMR", "winger_right",       88, 28, "IF",  "WMF", "IF",  "W"),
    ],
  },
  "4-4-2": {
    name: "4-4-2",
    slots: [
      S("GK",  "goalkeeper",        50, 92, "GK",  "GK",  "GK",  "GK"),
      S("DL",  "defender_left",      12, 75, "FB",  "FB",  "FB",  "FB"),
      S("DCL", "defender_central",   36, 79, "CD",  "CB",  "CD",  "CD"),
      S("DCR", "defender_central",   64, 79, "CD",  "CB",  "CD",  "CD"),
      S("DR",  "defender_right",     88, 75, "FB",  "FB",  "FB",  "FB"),
      S("ML",  "midfielder_left",    12, 52, "W",   "WMF", "W",   "W"),
      S("MCL", "midfielder_central", 36, 56, "BBM", "CM",  "BBM", "BBM"),
      S("MCR", "midfielder_central", 64, 56, "BBM", "CM",  "BBM", "BBM"),
      S("MR",  "midfielder_right",   88, 52, "W",   "WMF", "W",   "W"),
      S("STL", "striker",            36, 16, "CF",  "CF",  "CF",  "CF"),
      S("STR", "striker",            64, 16, "AF",  "AF",  "AF",  "AF"),
    ],
  },
  "3-5-2": {
    name: "3-5-2",
    slots: [
      S("GK",  "goalkeeper",        50, 92, "GK",  "GK",  "GK",  "GK"),
      S("DCL", "defender_central",   25, 79, "BPD", "CB",  "BPD", "CD"),
      S("DC",  "defender_central",   50, 81, "CD",  "CB",  "CD",  "CD"),
      S("DCR", "defender_central",   75, 79, "BPD", "CB",  "BPD", "CD"),
      S("WBL", "wing_back_left",      8, 57, "WB",  "FB",  "WB",  "FB"),
      S("MCL", "midfielder_central", 32, 55, "BBM", "CM",  "BBM", "BBM"),
      S("MC",  "midfielder_central", 50, 59, "DLP", "DM",  "DLP", "DM(d)"),
      S("MCR", "midfielder_central", 68, 55, "MEZ", "CM",  "MEZ", "BBM"),
      S("WBR", "wing_back_right",    92, 57, "WB",  "FB",  "WB",  "FB"),
      S("STL", "striker",            36, 16, "CF",  "CF",  "CF",  "CF"),
      S("STR", "striker",            64, 16, "AF",  "AF",  "AF",  "AF"),
    ],
  },
  "4-1-2-3": {
    name: "4-1-2-3",
    slots: [
      S("GK",  "goalkeeper",          50, 92, "GK",  "GK",  "GK",    "GK"),
      S("DL",  "defender_left",        12, 75, "FB",  "FB",  "FB",    "FB"),
      S("DCL", "defender_central",     36, 79, "BPD", "CB",  "BPD",   "CD"),
      S("DCR", "defender_central",     64, 79, "BPD", "CB",  "BPD",   "CD"),
      S("DR",  "defender_right",       88, 75, "FB",  "FB",  "FB",    "FB"),
      S("DM",  "defensive_midfielder", 50, 61, "DM",  "DM",  "DM(d)", "DM(d)"),
      S("MCL", "midfielder_central",   32, 45, "MEZ", "CM",  "MEZ",   "BBM"),
      S("MCR", "midfielder_central",   68, 45, "BBM", "CM",  "BBM",   "BBM"),
      S("AML", "winger_left",          12, 28, "IF",  "WMF", "IF",    "W"),
      S("ST",  "striker",              50, 12, "AF",  "AF",  "AF",    "AF"),
      S("AMR", "winger_right",         88, 28, "IF",  "WMF", "IF",    "W"),
    ],
  },
};

// ─── Helpers ──────────────────────────────────────────────────

function posRating(p: Player, key: keyof PositionMap): number {
  return (p.positions as unknown as Record<string, number>)[key] ?? 0;
}

const POS_LABELS: [keyof PositionMap, string][] = [
  ["goalkeeper", "GK"], ["defender_central", "DC"], ["defender_left", "DL"],
  ["defender_right", "DR"], ["wing_back_left", "WBL"], ["wing_back_right", "WBR"],
  ["defensive_midfielder", "DM"], ["midfielder_central", "MC"], ["midfielder_left", "ML"],
  ["midfielder_right", "MR"], ["attacking_midfielder", "AMC"], ["winger_left", "AML"],
  ["winger_right", "AMR"], ["striker", "ST"],
];

function getVersatility(p: Player): string[] {
  return POS_LABELS
    .filter(([key]) => (p.positions as unknown as Record<string, number>)[key] >= 14)
    .sort((a, b) => ((p.positions as unknown as Record<string, number>)[b[0]] ?? 0) - ((p.positions as unknown as Record<string, number>)[a[0]] ?? 0))
    .map(([, label]) => label);
}

function caClass(ca: number): string {
  if (ca >= 160) return "text-purple-400";
  if (ca >= 140) return "text-blue-400";
  if (ca >= 120) return "text-green-400";
  if (ca >= 100) return "text-yellow-400";
  return "text-zinc-400";
}

function ratingDot(r: number): string {
  if (r >= 18) return "bg-green-400"; if (r >= 14) return "bg-emerald-400";
  if (r >= 10) return "bg-yellow-400"; if (r >= 5) return "bg-orange-400";
  return "bg-zinc-600";
}

function ageColor(age: number): string {
  if (age <= 21) return "text-emerald-400"; if (age <= 23) return "text-green-300";
  if (age <= 29) return "text-zinc-400"; if (age <= 32) return "text-amber-400";
  return "text-red-400";
}

function growthClass(pa: number, ca: number): string {
  const gap = pa - ca;
  if (gap >= 30) return "text-emerald-400"; if (gap >= 15) return "text-green-400";
  if (gap >= 5) return "text-zinc-400"; return "text-zinc-600";
}

function condPct(raw: number): number {
  if (raw === 0) return 0;
  return raw > 200 ? Math.min(100, Math.round(raw / 100)) : Math.min(100, raw);
}
function condColor(p: number): string {
  if (p >= 90) return "bg-green-500"; if (p >= 70) return "bg-emerald-500";
  if (p >= 50) return "bg-yellow-500"; if (p >= 30) return "bg-orange-500";
  return "bg-red-500";
}
function moraleInfo(m: number) {
  if (m >= 18) return { label: "Superb", cls: "text-green-400" };
  if (m >= 14) return { label: "Good", cls: "text-emerald-400" };
  if (m >= 10) return { label: "OK", cls: "text-yellow-400" };
  if (m >= 6) return { label: "Poor", cls: "text-orange-400" };
  if (m > 0) return { label: "Very Poor", cls: "text-red-400" };
  return { label: "—", cls: "text-zinc-600" };
}

function dualRoleLabel(s: Slot): string {
  return s.ipRole === s.oopRole ? s.ipRole : `${s.ipRole} / ${s.oopRole}`;
}

function roleScoreFor(p: Player, rk: string): number {
  if (!rk) return 0;
  return Math.round(calculateRoleRatings(p).find((r) => r.role.short === rk)?.score ?? 0);
}

// Combined fit: 60% IP + 40% OOP, scaled by position familiarity
// Position familiarity acts as a ceiling — you can't fully utilise a role
// you're not natural at, matching the national team's slotScore logic.
function combinedFit(p: Player, slot: Slot): { ip: number; oop: number; combined: number } {
  const ip = slot.ipKey ? roleScoreFor(p, slot.ipKey) : 0;
  const oop = slot.oopKey ? roleScoreFor(p, slot.oopKey) : ip;
  const nat = posRating(p, slot.posKey);
  // Position familiarity multiplier — official FM bands:
  // Natural 18-20, Accomplished 15-17, Competent 12-14, Unconvincing 9-11, Awkward 5-8
  // Multipliers from FM-Arena testing: Nat≈100%, Acc≈90%, Comp≈75%, Unc≈60%, Awk≈40%
  const posFit = nat >= 18 ? 1.0 : nat >= 15 ? 0.90 : nat >= 12 ? 0.75 : nat >= 9 ? 0.60 : nat >= 5 ? 0.40 : 0.20;
  const rawCombined = ip * 0.6 + oop * 0.4;
  return { ip, oop, combined: Math.round(rawCombined * posFit) };
}

function fitColor(s: number): string {
  if (s >= 70) return "text-green-400"; if (s >= 55) return "text-emerald-300";
  if (s >= 40) return "text-yellow-400"; return "text-orange-400";
}
function fitBadgeCls(s: number): string {
  if (s >= 70) return "bg-green-500/25 text-green-300 border-green-500/40";
  if (s >= 55) return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
  if (s >= 40) return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
  return "bg-orange-500/20 text-orange-300 border-orange-500/30";
}

function validNum(n: number): string { return n > 0 && n !== 255 ? String(n) : "—"; }

function pickBest(players: Player[], posKey: keyof PositionMap, exclude: Set<number>, slot?: Slot): Player | null {
  let best: Player | null = null, bestScore = -1;
  for (const p of players) {
    if (exclude.has(p.id)) continue;
    if (slot) {
      // combinedFit already includes posFit, so use it directly with CA
      const fit = combinedFit(p, slot).combined;
      const score = fit * 0.5 + p.current_ability * 0.5;
      if (score > bestScore) { bestScore = score; best = p; }
    } else {
      const posFam = posRating(p, posKey) / 20;
      const score = posFam * 60 + (p.current_ability / 200) * 40;
      if (score > bestScore) { bestScore = score; best = p; }
    }
  }
  return best;
}

// Two-pass optimal assignment: natural positions first, then fill gaps
// Prevents e.g. a DM being stolen by DR slot before DM slots are considered
function buildOptimalXI(pool: Player[], slots: Slot[]): { starters: (Player | null)[]; used: Set<number> } {
  const used = new Set<number>();
  const starters: (Player | null)[] = new Array(slots.length).fill(null);

  // Rank slots by scarcity — fewer natural candidates = fill first
  const indexed = slots.map((s, i) => ({
    idx: i, slot: s,
    naturalCount: pool.filter(p => posRating(p, s.posKey) >= 14).length,
  }));
  const byScarcity = [...indexed].sort((a, b) => {
    if (a.slot.posKey === "goalkeeper") return -1;
    if (b.slot.posKey === "goalkeeper") return 1;
    return a.naturalCount - b.naturalCount;
  });

  // Pass 1: Only players with natural position fit (posRating >= 14)
  for (const { idx, slot } of byScarcity) {
    let best: Player | null = null, bestScore = -1;
    for (const p of pool) {
      if (used.has(p.id)) continue;
      if (posRating(p, slot.posKey) < 14) continue;
      const fit = combinedFit(p, slot).combined;
      const score = fit * 0.5 + p.current_ability * 0.5;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    if (best) { starters[idx] = best; used.add(best.id); }
  }

  // Pass 2: Fill remaining with best available (any player)
  for (const { idx, slot } of byScarcity) {
    if (starters[idx]) continue;
    const p = pickBest(pool, slot.posKey, used, slot);
    starters[idx] = p;
    if (p) used.add(p.id);
  }

  return { starters, used };
}

// ─── Hierarchy heuristics ─────────────────────────────────────
function detectHierarchy(squad: Player[]) {
  if (!squad.length) return { captainId: 0, vcId: 0, starId: 0, prospectId: 0 };
  const score = (p: Player) => p.mental.leadership * 4 + p.mental.teamwork * 2 + p.mental.determination + (p.age >= 25 ? 10 : 0) + p.world_reputation / 200;
  const sorted = [...squad].sort((a, b) => score(b) - score(a));
  const starId = [...squad].sort((a, b) => b.current_ability - a.current_ability)[0]?.id ?? 0;
  const young = squad.filter((p) => p.age <= 22);
  const prospectId = young.length ? young.sort((a, b) => b.potential_ability - a.potential_ability)[0]?.id ?? 0 : 0;
  return { captainId: sorted[0]?.id ?? 0, vcId: sorted[1]?.id ?? 0, starId, prospectId };
}
function hBadge(id: number, h: ReturnType<typeof detectHierarchy>): string | null {
  if (id === h.captainId) return "C"; if (id === h.vcId) return "VC";
  if (id === h.starId) return "★"; if (id === h.prospectId) return "↑"; return null;
}
function hStyle(b: string): string {
  if (b === "C") return "bg-yellow-500 text-zinc-900"; if (b === "VC") return "bg-yellow-500/60 text-zinc-900";
  if (b === "★") return "bg-purple-500 text-white"; if (b === "↑") return "bg-emerald-500 text-white";
  return "bg-zinc-600 text-zinc-200";
}

// ─── Insights generator ───────────────────────────────────────
function genInsights(starters: (Player | null)[], slots: Slot[], squad: Player[], gameYear: number): string[] {
  const out: string[] = [];
  let wSlot = "", wFit = 100, sSlot = "", sFit = 0;
  starters.forEach((p, i) => {
    if (!p) return;
    const fit = combinedFit(p, slots[i]).combined;
    if (fit < wFit) { wFit = fit; wSlot = `${slots[i].label} ${slots[i].ipRole}`; }
    if (fit > sFit) { sFit = fit; sSlot = `${slots[i].label} ${slots[i].ipRole}`; }
  });
  if (wSlot) out.push(`🔴 Weakest: ${wSlot} (${wFit}%)`);
  if (sSlot) out.push(`💪 Strongest: ${sSlot} (${sFit}%)`);
  const y = squad.filter((p) => p.age <= 23).length, pr = squad.filter((p) => p.age > 23 && p.age <= 29).length, v = squad.filter((p) => p.age > 29).length;
  out.push(`📊 ${y} young · ${pr} prime · ${v} vet`);
  const g = squad.filter((p) => p.potential_ability - p.current_ability >= 20).length;
  if (g) out.push(`🌱 ${g} with 20+ growth`);
  const exp = squad.filter((p) => { const yr = parseInt(p.contract_expiry?.split("-")[0] ?? "", 10); return !isNaN(yr) && yr <= gameYear + 1; });
  if (exp.length) out.push(`⏰ ${exp.length} contract${exp.length > 1 ? "s" : ""} expiring`);

  // Research-based meta insights
  const dirty = squad.filter((p) => p.hidden.dirtiness >= 14);
  if (dirty.length) out.push(`🟥 ${dirty.length} dirty player${dirty.length > 1 ? "s" : ""} — card risk`);
  const lowPressure = starters.filter((p) => p && p.hidden.pressure <= 6).length;
  if (lowPressure >= 3) out.push(`😰 ${lowPressure} starters low pressure — big game risk`);
  const avgAth = starters.filter(Boolean).length ? Math.round(starters.filter(Boolean).reduce((s, p) => s + (p!.physical.pace + p!.physical.acceleration) / 2, 0) / starters.filter(Boolean).length) : 0;
  if (avgAth > 0) out.push(`⚡ XI pace avg ${avgAth}`);
  return out;
}

// ─── Attribute bar ────────────────────────────────────────────
function AttrBar({ label, value }: { label: string; value: number }) {
  if (!value) return null;
  const pct = (value / 20) * 100;
  const bg = value >= 17 ? "bg-green-500" : value >= 13 ? "bg-emerald-500" : value >= 9 ? "bg-yellow-500" : value >= 5 ? "bg-orange-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-1.5 py-[1px]">
      <span className="text-[10px] text-zinc-400 w-[74px] truncate">{label}</span>
      <div className="flex-1 h-[14px] bg-zinc-800/80 rounded-sm overflow-hidden relative">
        <div className={`h-full rounded-sm ${bg}`} style={{ width: `${pct}%` }} />
        <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-bold ${attrColor(value)}`}>{value}</span>
      </div>
    </div>
  );
}

// ─── Player detail sidebar ────────────────────────────────────
function PlayerPanel({
  player, onClose, toggleShortlist, addToCompare, isStarred, hierarchy, slot,
}: {
  player: Player; onClose: () => void;
  toggleShortlist: (p: Player) => void; addToCompare: (p: Player) => void;
  isStarred: boolean; hierarchy: ReturnType<typeof detectHierarchy>;
  slot: Slot | null;
}) {
  const p = player;
  const isGK = p.natural_position === "GK";
  const cond = condPct(p.condition);
  const morale = moraleInfo(p.morale);
  const growth = p.potential_ability - p.current_ability;
  const badge = hBadge(p.id, hierarchy);
  const vers = getVersatility(p);
  const fit = slot ? combinedFit(p, slot) : null;

  const radarData = isGK
    ? [{ attr: "Handling", value: p.goalkeeping.handling }, { attr: "Reflexes", value: p.goalkeeping.reflexes },
       { attr: "Command", value: p.goalkeeping.command_of_area }, { attr: "1v1", value: p.goalkeeping.one_on_ones },
       { attr: "Kicking", value: p.goalkeeping.kicking }, { attr: "Aerial", value: p.goalkeeping.aerial_reach }]
    : [{ attr: "Tech", value: Math.round((p.technical.finishing + p.technical.passing + p.technical.dribbling + p.technical.first_touch + p.technical.technique) / 5) },
       { attr: "Mental", value: Math.round((p.mental.composure + p.mental.decisions + p.mental.vision + p.mental.anticipation + p.mental.off_the_ball) / 5) },
       { attr: "Physical", value: Math.round((p.physical.pace + p.physical.acceleration + p.physical.strength + p.physical.stamina + p.physical.agility) / 5) },
       { attr: "Attack", value: Math.round((p.technical.finishing + p.technical.dribbling + p.mental.off_the_ball + p.mental.composure) / 4) },
       { attr: "Defend", value: Math.round((p.technical.tackling + p.technical.marking + p.mental.positioning + p.mental.concentration) / 4) },
       { attr: "Create", value: Math.round((p.technical.passing + p.mental.vision + p.mental.flair + p.technical.crossing) / 4) }];

  const caColor = p.current_ability >= 170 ? "text-purple-400" : p.current_ability >= 150 ? "text-blue-400" : p.current_ability >= 130 ? "text-emerald-400" : "text-green-400";
  const paColor = p.potential_ability >= 180 ? "text-purple-400" : p.potential_ability >= 160 ? "text-blue-400" : p.potential_ability >= 140 ? "text-emerald-400" : "text-green-400";

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 bg-gradient-to-r from-emerald-900/30 to-zinc-900 border-b border-zinc-800">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold text-zinc-100 truncate">{displayName(p)}</h2>
              {badge && <span className={`text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center ${hStyle(badge)}`}>{badge}</span>}
            </div>
            <p className="text-[11px] text-zinc-400 truncate">{p.club_name || "Free Agent"}</p>
            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-zinc-500 flex-wrap">
              <span>{p.nationality}</span><span>·</span>
              <span>{p.natural_position}</span><span>·</span>
              <span className={ageColor(p.age)}>Age {p.age}</span>
              {p.height > 0 && <><span>·</span><span>{p.height}cm</span></>}
            </div>
            {/* Versatility tags */}
            {vers.length > 1 && (
              <div className="flex flex-wrap gap-0.5 mt-1">
                {vers.map((pos) => (
                  <span key={pos} className="text-[8px] px-1 py-px rounded bg-zinc-800 text-zinc-400 border border-zinc-700/40">{pos}</span>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-0.5 shrink-0 ml-1">
            <button onClick={() => toggleShortlist(p)} className={`p-1 rounded hover:bg-zinc-800 ${isStarred ? "text-yellow-400" : "text-zinc-600"}`}>
              <Star size={13} fill={isStarred ? "currentColor" : "none"} />
            </button>
            <button onClick={() => addToCompare(p)} className="p-1 text-zinc-600 hover:text-emerald-400 rounded hover:bg-zinc-800"><GitCompare size={13} /></button>
            <button onClick={onClose} className="p-1 text-zinc-600 hover:text-zinc-200 rounded hover:bg-zinc-800"><X size={13} /></button>
          </div>
        </div>

        {/* CA / PA / Value / Wage */}
        <div className="grid grid-cols-4 gap-1 mt-2">
          <div className="text-center"><div className="text-[8px] text-zinc-500 uppercase">CA</div><div className={`text-lg font-black ${caColor}`}>{p.current_ability}</div></div>
          <div className="text-center"><div className="text-[8px] text-zinc-500 uppercase">PA</div><div className={`text-lg font-black ${paColor}`}>{p.potential_ability}</div></div>
          <div className="text-center">
            <div className="text-[8px] text-zinc-500 uppercase">Value</div>
            <div className="text-[11px] font-semibold text-zinc-200 mt-0.5">{p.value > 0 ? formatValue(p.value) : "—"}</div>
            {p.asking_price > 0 && p.asking_price !== p.value && (
              <div className="text-[9px] text-zinc-500">ask {formatValue(p.asking_price)}</div>
            )}
          </div>
          <div className="text-center"><div className="text-[8px] text-zinc-500 uppercase">Wage</div><div className="text-[11px] font-semibold text-zinc-300 mt-0.5">{p.wage > 0 ? formatWage(p.wage) : "—"}</div></div>
        </div>

        {/* Status row */}
        <div className="grid grid-cols-4 gap-1 mt-2 pt-1.5 border-t border-zinc-800/50">
          <div className="text-center">
            <div className="text-[8px] text-zinc-500">Condition</div>
            {cond > 0 ? (<div className="mt-0.5"><div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mx-1"><div className={`h-full rounded-full ${condColor(cond)}`} style={{ width: `${cond}%` }} /></div><span className="text-[9px] text-zinc-400">{cond}%</span></div>) : <span className="text-[9px] text-zinc-600">—</span>}
          </div>
          <div className="text-center"><div className="text-[8px] text-zinc-500">Morale</div><span className={`text-[10px] font-medium ${morale.cls}`}>{morale.label}</span></div>
          <div className="text-center"><div className="text-[8px] text-zinc-500">Growth</div><span className={`text-[10px] font-bold font-mono ${growthClass(p.potential_ability, p.current_ability)}`}>{growth > 0 ? `+${growth}` : growth === 0 ? "Max" : "—"}</span></div>
          <div className="text-center"><div className="text-[8px] text-zinc-500">Contract</div><span className="text-[10px] text-zinc-300">{p.contract_expiry?.slice(0, 7) || "—"}</span></div>
        </div>

        {/* IP / OOP fit breakdown (when viewing from a slot) */}
        {fit && slot && (
          <div className="mt-2 pt-1.5 border-t border-zinc-800/50">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500">IP <span className="text-zinc-300">{slot.ipRole}</span></span>
              <span className={`font-mono font-bold ${fitColor(fit.ip)}`}>{fit.ip}%</span>
            </div>
            {slot.ipRole !== slot.oopRole && (
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-zinc-500">OOP <span className="text-zinc-300">{slot.oopRole}</span></span>
                <span className={`font-mono font-bold ${fitColor(fit.oop)}`}>{fit.oop}%</span>
              </div>
            )}
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-400 font-medium">Combined</span>
              <span className={`font-mono font-bold ${fitColor(fit.combined)}`}>{fit.combined}%</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-1.5 text-[10px]">
          <span className="text-zinc-500">Foot <span className="text-zinc-300">{p.preferred_foot || "—"}</span></span>
          <span className="text-zinc-500">Rep <span className="text-zinc-300">{p.world_reputation || 0}</span></span>
          <span className="text-zinc-500">#{validNum(p.squad_number)}</span>
        </div>

        {/* Research-based meta indicators */}
        {(() => {
          const athScore = Math.round((p.physical.pace + p.physical.acceleration + p.physical.jumping + p.physical.agility) / 4);
          const hiddenScore = Math.round((p.hidden.consistency + p.hidden.pressure + p.hidden.important_matches + p.hidden.professionalism) / 4);
          const athCls = athScore >= 16 ? "text-green-400" : athScore >= 12 ? "text-emerald-300" : athScore >= 8 ? "text-yellow-400" : "text-orange-400";
          const hidCls = hiddenScore >= 16 ? "text-green-400" : hiddenScore >= 12 ? "text-emerald-300" : hiddenScore >= 8 ? "text-yellow-400" : "text-orange-400";
          return (
            <div className="grid grid-cols-3 gap-1 mt-1.5 pt-1.5 border-t border-zinc-800/50">
              <div className="text-center">
                <div className="text-[8px] text-zinc-500">Athletics</div>
                <span className={`text-[11px] font-bold font-mono ${athCls}`}>{athScore}</span>
                <div className="text-[7px] text-zinc-600">pac/acc/jmp/agi</div>
              </div>
              <div className="text-center">
                <div className="text-[8px] text-zinc-500">Mentals</div>
                <span className={`text-[11px] font-bold font-mono ${hidCls}`}>{hiddenScore}</span>
                <div className="text-[7px] text-zinc-600">con/prs/big/pro</div>
              </div>
              <div className="text-center">
                <div className="text-[8px] text-zinc-500">Dirty</div>
                <span className={`text-[11px] font-bold font-mono ${p.hidden.dirtiness >= 12 ? "text-red-400" : p.hidden.dirtiness >= 8 ? "text-orange-400" : "text-green-400"}`}>{p.hidden.dirtiness || "—"}</span>
                <div className="text-[7px] text-zinc-600">{p.hidden.dirtiness >= 12 ? "⚠ cards risk" : p.hidden.dirtiness >= 8 ? "watch" : "clean"}</div>
              </div>
            </div>
          );
        })()}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="h-36 px-1">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="65%">
              <PolarGrid stroke="#333" /><PolarAngleAxis dataKey="attr" tick={{ fill: "#a1a1aa", fontSize: 9 }} />
              <PolarRadiusAxis angle={30} domain={[0, 20]} tick={false} axisLine={false} />
              <Radar dataKey="value" stroke={isGK ? "#f59e0b" : "#4ade80"} fill={isGK ? "#f59e0b" : "#4ade80"} fillOpacity={0.15} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="px-3 pb-4 space-y-2.5">
          <section>
            <h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Best Roles</h3>
            {bestRoles(p, 5).map((r) => { const pct = r.score; const bg = pct >= 75 ? "bg-green-500" : pct >= 60 ? "bg-emerald-500" : pct >= 45 ? "bg-yellow-500" : "bg-orange-500"; return (
              <div key={r.role.short} className="flex items-center gap-1.5 py-[1px]"><span className="text-[10px] text-zinc-400 w-[74px] truncate" title={r.role.name}>{r.role.short} {r.role.name}</span><div className="flex-1 h-[14px] bg-zinc-800/80 rounded-sm overflow-hidden relative"><div className={`h-full rounded-sm ${bg}`} style={{ width: `${pct}%` }} /><span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-zinc-100">{r.score.toFixed(0)}</span></div></div>
            ); })}
          </section>
          <section><h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Technical</h3>
            <AttrBar label="Corners" value={p.technical.corners} /><AttrBar label="Crossing" value={p.technical.crossing} /><AttrBar label="Dribbling" value={p.technical.dribbling} /><AttrBar label="Finishing" value={p.technical.finishing} /><AttrBar label="First Touch" value={p.technical.first_touch} /><AttrBar label="Free Kick" value={p.technical.free_kick} /><AttrBar label="Heading" value={p.technical.heading} /><AttrBar label="Long Shots" value={p.technical.long_shots} /><AttrBar label="Marking" value={p.technical.marking} /><AttrBar label="Passing" value={p.technical.passing} /><AttrBar label="Penalty" value={p.technical.penalty} /><AttrBar label="Tackling" value={p.technical.tackling} /><AttrBar label="Technique" value={p.technical.technique} /></section>
          <section><h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Mental</h3>
            <AttrBar label="Aggression" value={p.mental.aggression} /><AttrBar label="Anticipation" value={p.mental.anticipation} /><AttrBar label="Bravery" value={p.mental.bravery} /><AttrBar label="Composure" value={p.mental.composure} /><AttrBar label="Concentration" value={p.mental.concentration} /><AttrBar label="Decisions" value={p.mental.decisions} /><AttrBar label="Determination" value={p.mental.determination} /><AttrBar label="Flair" value={p.mental.flair} /><AttrBar label="Leadership" value={p.mental.leadership} /><AttrBar label="Off The Ball" value={p.mental.off_the_ball} /><AttrBar label="Positioning" value={p.mental.positioning} /><AttrBar label="Teamwork" value={p.mental.teamwork} /><AttrBar label="Vision" value={p.mental.vision} /><AttrBar label="Work Rate" value={p.mental.work_rate} /></section>
          <section><h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Physical</h3>
            <AttrBar label="Acceleration" value={p.physical.acceleration} /><AttrBar label="Agility" value={p.physical.agility} /><AttrBar label="Balance" value={p.physical.balance} /><AttrBar label="Jumping" value={p.physical.jumping} /><AttrBar label="Nat. Fitness" value={p.physical.natural_fitness} /><AttrBar label="Pace" value={p.physical.pace} /><AttrBar label="Stamina" value={p.physical.stamina} /><AttrBar label="Strength" value={p.physical.strength} /></section>
          {(isGK || p.goalkeeping.handling > 3) && (<section><h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Goalkeeping</h3>
            <AttrBar label="Handling" value={p.goalkeeping.handling} /><AttrBar label="Aerial Reach" value={p.goalkeeping.aerial_reach} /><AttrBar label="Command" value={p.goalkeeping.command_of_area} /><AttrBar label="Kicking" value={p.goalkeeping.kicking} /><AttrBar label="Reflexes" value={p.goalkeeping.reflexes} /><AttrBar label="One on Ones" value={p.goalkeeping.one_on_ones} /><AttrBar label="Rushing Out" value={p.goalkeeping.rushing_out} /><AttrBar label="Punching" value={p.goalkeeping.punching} /></section>)}
          <section><h3 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">Hidden</h3>
            <AttrBar label="Consistency" value={p.hidden.consistency} /><AttrBar label="Imp. Matches" value={p.hidden.important_matches} /><AttrBar label="Inj. Prone" value={p.hidden.injury_proneness} /><AttrBar label="Versatility" value={p.hidden.versatility} /><AttrBar label="Adaptability" value={p.hidden.adaptability} /><AttrBar label="Ambition" value={p.hidden.ambition} /><AttrBar label="Loyalty" value={p.hidden.loyalty} /><AttrBar label="Pressure" value={p.hidden.pressure} /><AttrBar label="Professional" value={p.hidden.professionalism} /><AttrBar label="Temperament" value={p.hidden.temperament} /></section>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

export function SquadPage() {
  const { players, squadIds, managerProfile, setCurrentPage, addToCompare, toggleShortlist, shortlist } = useAppStore();
  const [formation, setFormation] = useState("best-llm");
  const [detailPlayer, setDetailPlayer] = useState<Player | null>(null);
  const [detailSlot, setDetailSlot] = useState<Slot | null>(null);
  const [exportMsg, setExportMsg] = useState("");
  const [showYouth, setShowYouth] = useState(false);

  const squadPlayers = useMemo(() => players.filter((p) => squadIds.has(p.id)), [players, squadIds]);
  const hierarchy = useMemo(() => detectHierarchy(squadPlayers), [squadPlayers]);

  const { starters, subs, bench } = useMemo(() => {
    const f = FORMATIONS[formation];
    if (!f) return { starters: [] as (Player | null)[], subs: [] as (Player | null)[], bench: [] as Player[] };

    // Two-pass optimal XI: natural positions first, then fill gaps
    const { starters: st, used } = buildOptimalXI(squadPlayers, f.slots);

    // Subs: optimal assignment (not formation-order greedy)
    const subPool = squadPlayers.filter(p => !used.has(p.id));
    type SubCand = { player: Player; slotIdx: number; score: number };
    const subCandidates: SubCand[] = [];
    for (const p of subPool) {
      for (let si = 0; si < f.slots.length; si++) {
        const fit = combinedFit(p, f.slots[si]).combined;
        subCandidates.push({ player: p, slotIdx: si, score: fit * 0.5 + p.current_ability * 0.5 });
      }
    }
    subCandidates.sort((a, b) => b.score - a.score);
    const su: (Player | null)[] = new Array(f.slots.length).fill(null);
    const subSlotFilled = new Set<number>();
    const subUsed = new Set<number>();
    for (const cand of subCandidates) {
      if (subSlotFilled.size >= f.slots.length) break;
      if (subSlotFilled.has(cand.slotIdx)) continue;
      if (subUsed.has(cand.player.id)) continue;
      su[cand.slotIdx] = cand.player;
      subSlotFilled.add(cand.slotIdx);
      subUsed.add(cand.player.id);
      used.add(cand.player.id);
    }
    return { starters: st, subs: su, bench: squadPlayers.filter((p) => !used.has(p.id)).sort((a, b) => b.current_ability - a.current_ability) };
  }, [squadPlayers, formation]);

  const formationFits = useMemo(() => {
    const fits: Record<string, number> = {};
    for (const [key, form] of Object.entries(FORMATIONS)) {
      const { starters: st } = buildOptimalXI(squadPlayers, form.slots);
      let total = 0, count = 0;
      st.forEach((p, i) => {
        if (p) { total += combinedFit(p, form.slots[i]).combined; count++; }
      });
      fits[key] = count > 0 ? Math.round(total / count) : 0;
    }
    return fits;
  }, [squadPlayers]);

  const f = FORMATIONS[formation];
  const xiFit = formationFits[formation] ?? 0;
  const avgCA = squadPlayers.length ? Math.round(squadPlayers.reduce((s, p) => s + p.current_ability, 0) / squadPlayers.length) : 0;
  const avgAge = squadPlayers.length ? (squadPlayers.reduce((s, p) => s + p.age, 0) / squadPlayers.length).toFixed(1) : "—";

  const leagueRanking = useMemo(() => {
    if (!managerProfile?.league_name) return null;
    const a = analyzeLeague(players, managerProfile.league_name);
    const idx = a.findIndex((c) => c.clubName === managerProfile.club_name);
    return { clubs: a, ourRank: idx + 1, total: a.length };
  }, [players, managerProfile]);

  const insights = useMemo(() => genInsights(starters, f.slots, squadPlayers, managerProfile?.game_year ?? 2026), [starters, f.slots, squadPlayers, managerProfile]);

  // Youth / Reserve players: same club but NOT in first team squad
  const youthPlayers = useMemo(() => {
    if (!managerProfile?.club_name) return [];
    const clubLower = managerProfile.club_name.toLowerCase();
    return players.filter(p =>
      p.club_name?.toLowerCase() === clubLower && !squadIds.has(p.id)
    ).sort((a, b) => b.current_ability - a.current_ability);
  }, [players, squadIds, managerProfile]);

  const youthByGroup = useMemo(() => {
    const g: Record<string, Player[]> = { GK: [], DEF: [], MID: [], ATT: [] };
    for (const p of youthPlayers) {
      const pos = p.natural_position;
      if (pos === "GK") g.GK.push(p);
      else if (["DC", "DL", "DR", "WBL", "WBR"].includes(pos)) g.DEF.push(p);
      else if (["DM", "MC", "ML", "MR"].includes(pos)) g.MID.push(p);
      else g.ATT.push(p);
    }
    return g;
  }, [youthPlayers]);

  const openDetail = (p: Player, slot: Slot | null = null) => { setDetailPlayer(p); setDetailSlot(slot); };

  const handleExportForAI = async () => {
    try {
      await generateAIDatabase(players, managerProfile!, squadIds, shortlist);
      setExportMsg("✓ AI Brief exported");
      setTimeout(() => setExportMsg(""), 3000);
    } catch (e) { setExportMsg(`✗ ${e}`); }
  };

  if (!managerProfile || !squadPlayers.length) {
    return (<div className="flex-1 flex items-center justify-center"><div className="text-center text-zinc-500"><p className="text-lg mb-1">No squad data</p><p className="text-sm">Connect to FM and load players first.</p><button onClick={() => setCurrentPage("dashboard")} className="mt-4 px-4 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300">Dashboard</button></div></div>);
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* ═══ Pitch area ═══ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-zinc-800/60">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-zinc-100">{managerProfile.club_name}</h1>
            <span className="text-xs text-zinc-500">{managerProfile.league_name}</span>
            {leagueRanking && <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">#{leagueRanking.ourRank}/{leagueRanking.total}</span>}
          </div>
          <div className="flex items-center gap-2.5 text-xs text-zinc-500">
            <span>CA <span className={`font-mono font-bold ${caClass(avgCA)}`}>{avgCA}</span></span>
            <span className="text-zinc-700">·</span>
            <span>Age <span className="font-mono text-zinc-300">{avgAge}</span></span>
            <span className="text-zinc-700">·</span>
            <span>XI Fit <span className={`font-mono font-bold ${fitColor(xiFit)}`}>{xiFit}%</span></span>
            <span className="text-zinc-700">·</span>
            <span>{formatValue(squadPlayers.reduce((s, p) => s + p.value, 0))}</span>
            <span className="text-zinc-700">·</span>
            <span>{formatWage(squadPlayers.reduce((s, p) => s + p.wage, 0))}</span>
            <span className="text-zinc-700">|</span>
            <button onClick={handleExportForAI} className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800/70 hover:bg-emerald-900/40 border border-zinc-700/40 hover:border-emerald-600/40 transition-colors text-zinc-400 hover:text-emerald-300" title="Generate compact AI briefing for Cursor chat analysis">
              <Download size={11} /><span className="text-[10px]">AI Brief</span>
            </button>
            {exportMsg && <span className={`text-[10px] ${exportMsg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>{exportMsg}</span>}
          </div>
        </div>

        {/* Formation tabs with combined fit */}
        <div className="flex items-center gap-1 px-5 py-2 border-b border-zinc-800/40">
          {Object.entries(FORMATIONS).map(([key, val]) => (
            <button key={key} onClick={() => setFormation(key)} className={`px-2.5 py-1 text-xs rounded transition-colors flex items-center gap-1.5 ${formation === key ? "bg-emerald-600 text-white font-semibold" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60"}`}>
              {val.name}
              <span className={`font-mono text-[10px] ${formation === key ? "text-emerald-200" : fitColor(formationFits[key] ?? 0)}`}>{formationFits[key] ?? 0}%</span>
            </button>
          ))}
        </div>

        {/* Insights strip */}
        {insights.length > 0 && (
          <div className="flex items-center gap-2.5 px-5 py-1.5 border-b border-zinc-800/30 overflow-x-auto">
            {insights.slice(0, 5).map((msg, i) => <span key={i} className="text-[10px] text-zinc-400 whitespace-nowrap shrink-0">{msg}</span>)}
          </div>
        )}

        {/* Pitch */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="relative w-full max-w-[700px] border border-zinc-700/30 rounded-lg overflow-hidden" style={{ aspectRatio: "68 / 105", background: "linear-gradient(180deg, #1a3a1a 0%, #1e401e 50%, #1a3a1a 100%)" }}>
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 680 1050" fill="none">
              <rect x="1" y="1" width="678" height="1048" rx="4" stroke="#2d5a2d" strokeWidth="2" />
              <line x1="0" y1="525" x2="680" y2="525" stroke="#2d5a2d" strokeWidth="1.5" />
              <circle cx="340" cy="525" r="91.5" stroke="#2d5a2d" strokeWidth="1.5" /><circle cx="340" cy="525" r="4" fill="#2d5a2d" />
              <rect x="148" y="0" width="384" height="165" stroke="#2d5a2d" strokeWidth="1.5" fill="none" />
              <rect x="228" y="0" width="224" height="55" stroke="#2d5a2d" strokeWidth="1.5" fill="none" />
              <path d="M 248 165 A 91.5 91.5 0 0 0 432 165" stroke="#2d5a2d" strokeWidth="1.5" fill="none" />
              <rect x="148" y="885" width="384" height="165" stroke="#2d5a2d" strokeWidth="1.5" fill="none" />
              <rect x="228" y="995" width="224" height="55" stroke="#2d5a2d" strokeWidth="1.5" fill="none" />
              <path d="M 248 885 A 91.5 91.5 0 0 1 432 885" stroke="#2d5a2d" strokeWidth="1.5" fill="none" />
            </svg>

            {f.slots.map((slot, i) => {
              const starter = starters[i], sub = subs[i];
              const fit = starter ? combinedFit(starter, slot) : { ip: 0, oop: 0, combined: 0 };
              const isSel = detailPlayer?.id === starter?.id;
              const badge = starter ? hBadge(starter.id, hierarchy) : null;
              const cond = starter ? condPct(starter.condition) : 0;

              return (
                <div key={`${slot.label}-${i}`} className="absolute flex flex-col items-center" style={{ left: `${slot.x}%`, top: `${slot.y}%`, transform: "translate(-50%, -50%)" }}>
                  {starter ? (
                    <button onClick={() => openDetail(starter, slot)} className={`group flex flex-col items-center transition-all duration-150 ${isSel ? "scale-110" : "hover:scale-105"}`}>
                      <div className={`px-1.5 py-px rounded text-[9px] font-bold border leading-tight mb-0.5 ${fitBadgeCls(fit.combined)}`}>{dualRoleLabel(slot)}</div>
                      <div className="relative">
                        <div className={`w-10 h-10 rounded-full bg-zinc-900/90 border-2 flex items-center justify-center transition-colors ${isSel ? "border-emerald-400 shadow-lg shadow-emerald-500/20" : "border-zinc-600/60 group-hover:border-zinc-400"}`}>
                          <span className="text-sm font-bold text-zinc-100">{validNum(starter.squad_number)}</span>
                        </div>
                        {badge && <span className={`absolute -top-1 -right-1 text-[7px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center ${hStyle(badge)}`}>{badge}</span>}
                      </div>
                      <div className={`bg-zinc-900/90 backdrop-blur-sm rounded-md px-2 py-1 border text-center min-w-[90px] mt-0.5 transition-colors ${isSel ? "border-emerald-500/50" : "border-zinc-700/50"}`}>
                        <div className="flex items-center justify-center gap-1">
                          <p className="text-[11px] text-zinc-100 font-semibold truncate max-w-[72px] leading-tight">{starter.common_name || starter.last_name || starter.first_name}</p>
                          <span className={`text-[9px] ${ageColor(starter.age)}`}>{starter.age}</span>
                        </div>
                        <div className="flex items-center justify-center gap-1 mt-px">
                          <span className={`text-sm font-bold font-mono ${caClass(starter.current_ability)}`}>{starter.current_ability}</span>
                          <span className="text-[9px] text-zinc-600">/</span>
                          <span className={`text-xs font-mono ${growthClass(starter.potential_ability, starter.current_ability)}`}>{starter.potential_ability}</span>
                          <span className={`w-2 h-2 rounded-full shrink-0 ${ratingDot(posRating(starter, slot.posKey))}`} />
                        </div>
                        <p className={`text-[9px] font-mono ${fitColor(fit.combined)}`}>fit {fit.combined}%</p>
                        {cond > 0 && <div className="h-[2px] rounded-full mt-0.5 mx-1 overflow-hidden bg-zinc-800"><div className={`h-full rounded-full ${condColor(cond)}`} style={{ width: `${cond}%` }} /></div>}
                      </div>
                    </button>
                  ) : (
                    <div className="flex flex-col items-center opacity-30">
                      <div className="px-1.5 py-px rounded text-[9px] font-bold bg-zinc-700/30 text-zinc-600 border border-zinc-700/20 mb-0.5">{dualRoleLabel(slot)}</div>
                      <div className="w-10 h-10 rounded-full border-2 border-dashed border-zinc-600 flex items-center justify-center"><span className="text-xs text-zinc-600">?</span></div>
                      <span className="text-[9px] text-zinc-600 font-mono mt-0.5">{slot.label}</span>
                    </div>
                  )}
                  {sub && (
                    <button onClick={() => openDetail(sub, slot)} className={`mt-0.5 flex items-center gap-1 rounded px-1.5 py-0.5 border transition-colors ${detailPlayer?.id === sub.id ? "bg-zinc-700/70 border-emerald-500/40" : "bg-zinc-800/60 border-zinc-700/30 hover:bg-zinc-700/50"}`}>
                      <span className="text-[9px] text-zinc-400 truncate max-w-[56px]">{sub.common_name || sub.last_name}</span>
                      <span className={`text-[10px] font-mono font-bold ${caClass(sub.current_ability)}`}>{sub.current_ability}</span>
                      <span className="text-[8px] text-zinc-600">/</span>
                      <span className={`text-[9px] font-mono ${growthClass(sub.potential_ability, sub.current_ability)}`}>{sub.potential_ability}</span>
                      <span className={`text-[8px] font-mono ${fitColor(combinedFit(sub, slot).combined)}`}>{combinedFit(sub, slot).combined}%</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bench */}
        {bench.length > 0 && (
          <div className="px-5 py-2.5 border-t border-zinc-800/60">
            <div className="flex items-center gap-1.5 mb-1.5"><span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">Bench</span><span className="text-[10px] text-zinc-600">({bench.length})</span></div>
            <div className="flex flex-wrap gap-1.5">
              {bench.map((p) => { const badge = hBadge(p.id, hierarchy); return (
                <button key={p.id} onClick={() => openDetail(p)} className={`flex items-center gap-1 px-2 py-1 rounded border transition-colors ${detailPlayer?.id === p.id ? "bg-zinc-800 border-emerald-500/40" : "bg-zinc-800/50 border-zinc-800 hover:bg-zinc-800"}`}>
                  {badge && <span className={`text-[7px] font-bold w-3 h-3 rounded-full flex items-center justify-center ${hStyle(badge)}`}>{badge}</span>}
                  {p.squad_number > 0 && p.squad_number !== 255 && <span className="text-[10px] text-zinc-500">#{p.squad_number}</span>}
                  <span className="text-[10px] text-zinc-300 truncate max-w-[72px]">{p.common_name || p.last_name || p.first_name}</span>
                  <span className="text-[10px] text-sky-400 font-mono">{p.natural_position}</span>
                  <span className={`text-[10px] font-mono font-bold ${caClass(p.current_ability)}`}>{p.current_ability}</span>
                  <span className={`text-[9px] ${ageColor(p.age)}`}>{p.age}</span>
                </button>
              ); })}
            </div>
          </div>
        )}

        {/* ═══ U21 / U18 Youth & Reserves ═══ */}
        {youthPlayers.length > 0 && (
          <div className="px-5 py-2.5 border-t border-zinc-800/60">
            <button onClick={() => setShowYouth(!showYouth)}
              className="flex items-center gap-2 w-full text-left hover:bg-zinc-800/30 rounded px-1 py-0.5 -mx-1 transition-colors">
              <span className="text-[10px] text-amber-400/80 uppercase tracking-wider font-medium">
                🏟️ U21 / U18 / Reserves
              </span>
              <span className="text-[10px] text-zinc-600">({youthPlayers.length})</span>
              <span className="text-[10px] text-zinc-600 ml-1">
                avg CA {youthPlayers.length ? Math.round(youthPlayers.reduce((s, p) => s + p.current_ability, 0) / youthPlayers.length) : 0}
              </span>
              <span className="flex-1" />
              <span className="text-[10px] text-zinc-600">{showYouth ? "▲" : "▼"}</span>
            </button>

            {showYouth && (
              <div className="mt-2 space-y-2">
                {/* Ready for first team highlight */}
                {(() => {
                  const ready = youthPlayers.filter(p => p.current_ability >= 80);
                  if (!ready.length) return null;
                  return (
                    <div className="bg-emerald-900/15 rounded-lg border border-emerald-800/30 p-2">
                      <div className="text-[10px] font-semibold text-emerald-400 mb-1">
                        ⭐ Ready for First Team (CA ≥ 80)
                      </div>
                      {ready.map(p => {
                        const growth = p.potential_ability - p.current_ability;
                        return (
                          <div key={p.id}
                            className="flex items-center gap-1.5 py-0.5 text-[11px] cursor-pointer hover:bg-emerald-800/20 rounded px-1 -mx-1"
                            onClick={() => openDetail(p)}>
                            <span className={`font-mono font-bold w-6 text-right ${caClass(p.current_ability)}`}>{p.current_ability}</span>
                            <span className="text-zinc-600">/</span>
                            <span className={`font-mono w-6 ${growthClass(p.potential_ability, p.current_ability)}`}>{p.potential_ability}</span>
                            <span className="text-sky-400 font-mono w-6 text-center">{p.natural_position}</span>
                            <span className="text-zinc-200 truncate flex-1">{displayName(p)}</span>
                            <span className={`text-[9px] ${ageColor(p.age)}`}>{p.age}y</span>
                            {growth >= 20 && <span className="text-[8px] px-1 rounded bg-emerald-500/20 text-emerald-400">+{growth}</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Grouped by position */}
                {(["GK", "DEF", "MID", "ATT"] as const).map(grp => {
                  const ps = youthByGroup[grp];
                  if (!ps.length) return null;
                  const label = { GK: "🧤 Goalkeepers", DEF: "🛡️ Defenders", MID: "⚙️ Midfielders", ATT: "⚽ Attackers" }[grp];
                  return (
                    <div key={grp} className="bg-zinc-900/40 rounded-lg border border-zinc-800/50">
                      <div className="px-2 py-1 text-[10px] font-semibold text-zinc-400 border-b border-zinc-800/30 flex items-center justify-between">
                        <span>{label}</span>
                        <span className="text-zinc-600">{ps.length}</span>
                      </div>
                      <div className="py-0.5">
                        {ps.map(p => {
                          const growth = p.potential_ability - p.current_ability;
                          return (
                            <div key={p.id}
                              className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] cursor-pointer hover:bg-zinc-800/40 rounded"
                              onClick={() => openDetail(p)}>
                              <span className={`font-mono font-bold w-6 text-right ${caClass(p.current_ability)}`}>{p.current_ability}</span>
                              <span className="text-zinc-600">/</span>
                              <span className={`font-mono w-6 ${growthClass(p.potential_ability, p.current_ability)}`}>{p.potential_ability}</span>
                              <span className="text-sky-400 font-mono w-6 text-center">{p.natural_position}</span>
                              <span className="text-zinc-200 truncate flex-1 min-w-0">{displayName(p)}</span>
                              <span className={`text-[9px] ${ageColor(p.age)}`}>{p.age}y</span>
                              {growth >= 20 && <span className="text-[8px] px-1 rounded bg-emerald-500/20 text-emerald-400 shrink-0">+{growth}</span>}
                              {growth >= 10 && growth < 20 && <span className="text-[8px] px-1 rounded bg-zinc-700/50 text-zinc-400 shrink-0">+{growth}</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ Right sidebar ═══ */}
      <div className="w-72 border-l border-zinc-800/60 bg-zinc-950/50 flex flex-col overflow-hidden">
        {detailPlayer ? (
          <PlayerPanel player={detailPlayer} onClose={() => { setDetailPlayer(null); setDetailSlot(null); }}
            toggleShortlist={toggleShortlist} addToCompare={addToCompare}
            isStarred={shortlist.some((x) => x.id === detailPlayer.id)} hierarchy={hierarchy} slot={detailSlot} />
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="px-3 py-2.5 border-b border-zinc-800/40"><h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Position Depth</h2></div>
            <div className="divide-y divide-zinc-800/30">
              {f.slots.map((slot, i) => {
                const starter = starters[i], sub = subs[i];
                const allForSlot = squadPlayers
                  .filter((p) => posRating(p, slot.posKey) >= 8)
                  .sort((a, b) => combinedFit(b, slot).combined - combinedFit(a, slot).combined);
                const topPlayers = allForSlot.slice(0, 4);

                return (
                  <div key={`d-${slot.label}-${i}`} className="px-3 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-zinc-500">{slot.label}</span>
                        <span className={`text-[9px] font-bold px-1 rounded border ${fitBadgeCls(starter ? combinedFit(starter, slot).combined : 40)}`}>{dualRoleLabel(slot)}</span>
                      </div>
                      <span className="text-[9px] text-zinc-600">{allForSlot.length} opt</span>
                    </div>
                    {topPlayers.map((p, idx) => {
                      const badge = hBadge(p.id, hierarchy);
                      const fit = combinedFit(p, slot);
                      const isStarter = p.id === starter?.id;
                      const isSub = p.id === sub?.id;
                      const vers = getVersatility(p).filter((v) => v !== p.natural_position).slice(0, 3);
                      return (
                        <div key={p.id} className="flex items-center justify-between py-0.5 cursor-pointer hover:bg-zinc-800/30 rounded px-1 -mx-1" onClick={() => openDetail(p, slot)}>
                          <div className="flex items-center gap-1 min-w-0">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ratingDot(posRating(p, slot.posKey))}`} />
                            {badge && <span className={`text-[7px] font-bold w-3 h-3 rounded-full flex items-center justify-center shrink-0 ${hStyle(badge)}`}>{badge}</span>}
                            <span className={`text-[10px] truncate ${isStarter ? "text-zinc-100 font-medium" : isSub ? "text-zinc-300" : "text-zinc-500"}`}>{displayName(p)}</span>
                            {vers.length > 0 && <span className="text-[8px] text-zinc-600 shrink-0">{vers.join("·")}</span>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`text-[9px] font-mono ${fitColor(fit.combined)}`}>{fit.combined}</span>
                            <span className={`text-[10px] font-mono font-bold ${caClass(p.current_ability)}`}>{p.current_ability}</span>
                            <span className="text-[9px] text-zinc-600">/</span>
                            <span className={`text-[9px] font-mono ${growthClass(p.potential_ability, p.current_ability)}`}>{p.potential_ability}</span>
                            <span className={`text-[9px] w-4 text-right ${ageColor(p.age)}`}>{p.age}</span>
                          </div>
                        </div>
                      );
                    })}
                    {!topPlayers.length && <p className="text-[9px] text-red-400 py-0.5 px-1">No cover — signing needed</p>}
                  </div>
                );
              })}
            </div>

            {leagueRanking && leagueRanking.clubs.length > 0 && (<>
              <div className="px-3 py-2.5 border-t border-zinc-800/40"><h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">League</h2></div>
              <div className="px-3 pb-4">
                {leagueRanking.clubs.map((club, idx) => { const isUs = club.clubName === managerProfile.club_name; return (
                  <div key={club.clubName} className={`flex items-center justify-between py-0.5 text-[10px] ${isUs ? "text-zinc-100 font-medium" : "text-zinc-500"}`}>
                    <div className="flex items-center gap-1.5 min-w-0"><span className="w-3 text-right font-mono text-zinc-600">{idx + 1}</span><span className="truncate">{club.clubName}</span></div>
                    <span className={`font-mono shrink-0 ${isUs ? caClass(club.avgCA) : "text-zinc-600"}`}>{club.avgCA.toFixed(0)}</span>
                  </div>
                ); })}
              </div>
            </>)}
          </div>
        )}
      </div>
    </div>
  );
}
