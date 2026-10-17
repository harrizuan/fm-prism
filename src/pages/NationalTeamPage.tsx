import { useAppStore } from "@/stores/useAppStore";
import { useMemo, useState } from "react";
import {
  displayName, bestRoles, calculateRoleRatings,
} from "@/types/player";
import type { Player, PositionMap } from "@/types/player";
import { ChevronDown, ChevronUp, UserPlus } from "lucide-react";

// ─── Formation slots ─────────────────────────────────────────
type Slot = {
  label: string; posKey: keyof PositionMap;
  x: number; y: number;
  ipRole: string; oopRole: string; ipKey: string; oopKey: string;
};
function S(l: string, pk: keyof PositionMap, x: number, y: number, ip: string, oop: string, ik: string, ok: string): Slot {
  return { label: l, posKey: pk, x, y, ipRole: ip, oopRole: oop, ipKey: ik, oopKey: ok };
}
const FORMATIONS: Record<string, { name: string; slots: Slot[] }> = {
  "4-2-3-1": { name: "4-2-3-1", slots: [
    S("GK","goalkeeper",50,92,"GK","GK","GK","GK"),
    S("DL","defender_left",12,75,"FB","FB","FB","FB"),
    S("DCL","defender_central",36,79,"BPD","CB","BPD","CD"),
    S("DCR","defender_central",64,79,"BPD","CB","BPD","CD"),
    S("DR","defender_right",88,75,"FB","FB","FB","FB"),
    S("DML","defensive_midfielder",35,57,"DM","DM","DM(d)","DM(d)"),
    S("DMR","defensive_midfielder",65,57,"DM","CM","DM(d)","BBM"),
    S("AML","winger_left",12,33,"W","WMF","W","W"),
    S("AMC","attacking_midfielder",50,37,"AM","CM","AM","BBM"),
    S("AMR","winger_right",88,33,"W","WMF","W","W"),
    S("ST","striker",50,12,"CF","CF","CF","CF"),
  ]},
  "4-3-3": { name: "4-3-3", slots: [
    S("GK","goalkeeper",50,92,"GK","GK","GK","GK"),
    S("DL","defender_left",12,75,"FB","FB","FB","FB"),
    S("DCL","defender_central",36,79,"BPD","CB","BPD","CD"),
    S("DCR","defender_central",64,79,"CD","CB","CD","CD"),
    S("DR","defender_right",88,75,"FB","FB","FB","FB"),
    S("MCL","midfielder_central",28,55,"BBM","CM","BBM","BBM"),
    S("MC","midfielder_central",50,59,"DLP","DM","DLP","DM(d)"),
    S("MCR","midfielder_central",72,55,"MEZ","CM","MEZ","BBM"),
    S("AML","winger_left",12,28,"IF","WMF","IF","W"),
    S("ST","striker",50,12,"AF","AF","AF","AF"),
    S("AMR","winger_right",88,28,"IF","WMF","IF","W"),
  ]},
  "4-4-2": { name: "4-4-2", slots: [
    S("GK","goalkeeper",50,92,"GK","GK","GK","GK"),
    S("DL","defender_left",12,75,"FB","FB","FB","FB"),
    S("DCL","defender_central",36,79,"CD","CB","CD","CD"),
    S("DCR","defender_central",64,79,"CD","CB","CD","CD"),
    S("DR","defender_right",88,75,"FB","FB","FB","FB"),
    S("ML","midfielder_left",12,52,"W","WMF","W","W"),
    S("MCL","midfielder_central",36,56,"BBM","CM","BBM","BBM"),
    S("MCR","midfielder_central",64,56,"BBM","CM","BBM","BBM"),
    S("MR","midfielder_right",88,52,"W","WMF","W","W"),
    S("STL","striker",36,16,"CF","CF","CF","CF"),
    S("STR","striker",64,16,"AF","AF","AF","AF"),
  ]},
  "3-5-2": { name: "3-5-2", slots: [
    S("GK","goalkeeper",50,92,"GK","GK","GK","GK"),
    S("DCL","defender_central",25,79,"BPD","CB","BPD","CD"),
    S("DC","defender_central",50,81,"CD","CB","CD","CD"),
    S("DCR","defender_central",75,79,"BPD","CB","BPD","CD"),
    S("WBL","wing_back_left",8,57,"WB","FB","WB","FB"),
    S("MCL","midfielder_central",32,55,"BBM","CM","BBM","BBM"),
    S("MC","midfielder_central",50,59,"DLP","DM","DLP","DM(d)"),
    S("MCR","midfielder_central",68,55,"MEZ","CM","MEZ","BBM"),
    S("WBR","wing_back_right",92,57,"WB","FB","WB","FB"),
    S("STL","striker",36,16,"CF","CF","CF","CF"),
    S("STR","striker",64,16,"AF","AF","AF","AF"),
  ]},
};

// ─── Helpers ──────────────────────────────────────────────────
function posR(p: Player, key: keyof PositionMap): number {
  return (p.positions as unknown as Record<string, number>)[key] ?? 0;
}
function caClass(ca: number): string {
  if (ca >= 160) return "text-purple-400";
  if (ca >= 140) return "text-blue-400";
  if (ca >= 120) return "text-green-400";
  if (ca >= 100) return "text-yellow-400";
  return "text-zinc-400";
}

function isActualGK(p: Player): boolean {
  return posR(p, "goalkeeper") >= 15;
}

function roleScore(p: Player, roleKey: string): number {
  if (!roleKey) return 0;
  return calculateRoleRatings(p).find(r => r.role.short === roleKey)?.score ?? 0;
}

function slotScore(p: Player, slot: Slot): number {
  if (slot.posKey === "goalkeeper" && !isActualGK(p)) return 0;
  const ip = roleScore(p, slot.ipKey);
  const oop = roleScore(p, slot.oopKey);
  const nat = posR(p, slot.posKey);
  // Position familiarity multiplier — official FM bands:
  // Natural 18-20, Accomplished 15-17, Competent 12-14, Unconvincing 9-11, Awkward 5-8
  // Multipliers from FM-Arena testing: Nat≈100%, Acc≈90%, Comp≈75%, Unc≈60%, Awk≈40%
  const posFit = nat >= 18 ? 1.0 : nat >= 15 ? 0.90 : nat >= 12 ? 0.75 : nat >= 9 ? 0.60 : nat >= 5 ? 0.40 : 0.20;
  // 60% IP + 40% OOP — consistent with SquadPage and bestFormationFit in player.ts
  return (ip * 0.6 + oop * 0.4) * posFit;
}

// National team composite: CA-weighted because national teams pick their best
// overall players, not just the best role fits. A CA 84 natural AMR should
// always make a small nation's squad even with a modest Winger role score.
function composite(p: Player, slot: Slot): number {
  return slotScore(p, slot) * 0.5 + p.current_ability * 0.5;
}

function bestSlotFor(p: Player, slots: Slot[]): { slot: Slot; score: number } {
  let best = slots[0];
  let bestScore = -1;
  for (const slot of slots) {
    if (slot.posKey === "goalkeeper") continue;
    const s = composite(p, slot);
    if (s > bestScore) { bestScore = s; best = slot; }
  }
  return { slot: best, score: bestScore };
}

function playerGroup(p: Player): "gk" | "def" | "mid" | "att" {
  if (isActualGK(p)) return "gk";
  const pos = p.natural_position;
  if (["DC", "DL", "DR", "WBL", "WBR"].includes(pos)) return "def";
  if (["DM", "MC", "ML", "MR"].includes(pos)) return "mid";
  if (["AMC", "AML", "AMR", "ST"].includes(pos)) return "att";
  const defR = Math.max(posR(p, "defender_central"), posR(p, "defender_left"), posR(p, "defender_right"), posR(p, "wing_back_left"), posR(p, "wing_back_right"));
  const midR = Math.max(posR(p, "defensive_midfielder"), posR(p, "midfielder_central"), posR(p, "midfielder_left"), posR(p, "midfielder_right"));
  const attR = Math.max(posR(p, "attacking_midfielder"), posR(p, "winger_left"), posR(p, "winger_right"), posR(p, "striker"));
  if (defR >= midR && defR >= attR) return "def";
  if (attR >= midR) return "att";
  return "mid";
}

function posGroup(key: keyof PositionMap): "gk" | "def" | "mid" | "att" {
  if (key === "goalkeeper") return "gk";
  if (["defender_central","defender_left","defender_right","wing_back_left","wing_back_right"].includes(key)) return "def";
  if (["defensive_midfielder","midfielder_central","midfielder_left","midfielder_right"].includes(key)) return "mid";
  return "att";
}

type SquadEntry = { player: Player; slot: string; role: string; fit: number; group: "gk" | "def" | "mid" | "att"; isXI: boolean };
const GROUP_LABEL: Record<string, string> = { gk: "🧤 Goalkeepers", def: "🛡️ Defenders", mid: "⚙️ Midfielders", att: "⚽ Attackers" };

// ─── Component ───────────────────────────────────────────────
export function NationalTeamPage() {
  const { players, managerProfile, setSelectedPlayer, setCurrentPage } = useAppStore();
  const [formation, setFormation] = useState("4-2-3-1");
  const [expandPersuade, setExpandPersuade] = useState(true);

  const nationName = managerProfile?.nationality ?? "";
  const lowerNation = nationName.toLowerCase();

  const firstNatPlayers = useMemo(() =>
    players.filter(p => p.nationality?.toLowerCase() === lowerNation)
      .sort((a, b) => b.current_ability - a.current_ability),
    [players, lowerNation]);

  const persuasionTargets = useMemo(() =>
    players.filter(p =>
      p.second_nationality?.toLowerCase() === lowerNation &&
      p.nationality?.toLowerCase() !== lowerNation
    ).sort((a, b) => b.current_ability - a.current_ability),
    [players, lowerNation]);

  const allEligible = useMemo(() => {
    const ids = new Set<number>();
    const combined: Player[] = [];
    for (const p of [...firstNatPlayers, ...persuasionTargets]) {
      if (!ids.has(p.id)) { ids.add(p.id); combined.push(p); }
    }
    return combined.sort((a, b) => b.current_ability - a.current_ability);
  }, [firstNatPlayers, persuasionTargets]);

  const formationData = FORMATIONS[formation];

  // ── Build optimal 23-man squad ──
  // Step 1: Best XI (natural-first two-pass)
  // Step 2: +2 backup GKs
  // Step 3: +1 backup per outfield slot (formation-driven depth)
  // Step 4: fill to 23 with best remaining
  const { squad23, bestXI } = useMemo(() => {
    if (!formationData) return { squad23: [] as SquadEntry[], bestXI: [] as { slot: Slot; player: Player | null; fit: number }[] };

    const pool = [...allEligible];
    const used = new Set<number>();
    const entries: SquadEntry[] = [];
    const slots = formationData.slots;

    // ── Step 1: Best XI — two-pass natural-first ──
    const xiArr: (Player | null)[] = new Array(slots.length).fill(null);
    const indexed = slots.map((s, i) => ({
      idx: i, slot: s,
      naturalCount: pool.filter(p => posR(p, s.posKey) >= 14).length,
    }));
    const byScarcity = [...indexed].sort((a, b) => {
      if (a.slot.posKey === "goalkeeper") return -1;
      if (b.slot.posKey === "goalkeeper") return 1;
      return a.naturalCount - b.naturalCount;
    });

    // Pass 1: only natural players (posR >= 14)
    for (const { idx, slot } of byScarcity) {
      let best: Player | null = null, bestFit = -1;
      for (const p of pool) {
        if (used.has(p.id)) continue;
        if (slot.posKey === "goalkeeper" && !isActualGK(p)) continue;
        if (posR(p, slot.posKey) < 14) continue;
        const fit = composite(p, slot);
        if (fit > bestFit) { bestFit = fit; best = p; }
      }
      if (best) { xiArr[idx] = best; used.add(best.id); }
    }
    // Pass 2: fill remaining XI slots with best available
    for (const { idx, slot } of byScarcity) {
      if (xiArr[idx]) continue;
      let best: Player | null = null, bestFit = -1;
      for (const p of pool) {
        if (used.has(p.id)) continue;
        if (slot.posKey === "goalkeeper" && !isActualGK(p)) continue;
        const fit = composite(p, slot);
        if (fit > bestFit) { bestFit = fit; best = p; }
      }
      if (best) { xiArr[idx] = best; used.add(best.id); }
    }

    const xi = slots.map((slot, i) => {
      const player = xiArr[i];
      if (player) {
        entries.push({
          player, slot: slot.label, role: slot.ipRole,
          fit: slotScore(player, slot), group: posGroup(slot.posKey), isXI: true,
        });
      }
      return { slot, player, fit: player ? composite(player, slot) : -1 };
    });

    // ── Step 2: Add GKs to total of 3 ──
    const gkCount = entries.filter(e => e.group === "gk").length;
    const gkPool = pool.filter(p => !used.has(p.id) && isActualGK(p))
      .sort((a, b) => b.current_ability - a.current_ability);
    for (let i = 0; i < (3 - gkCount) && i < gkPool.length; i++) {
      used.add(gkPool[i].id);
      entries.push({ player: gkPool[i], slot: "GK", role: "GK", fit: roleScore(gkPool[i], "GK"), group: "gk", isXI: false });
    }

    // ── Step 3: 1 backup per outfield formation slot (optimal assignment) ──
    // Instead of iterating slots in formation order (which lets earlier slots
    // steal players from their best position), we assign each remaining player
    // to their highest-composite slot, then resolve conflicts.
    const outfieldSlots = slots.filter(s => s.posKey !== "goalkeeper");
    const backupNeeded = new Set(outfieldSlots.map((_, i) => i));
    const remaining = pool.filter(p => !used.has(p.id) && !isActualGK(p));

    // Score each player for each slot
    type Cand = { player: Player; slotIdx: number; score: number };
    const allCandidates: Cand[] = [];
    for (const p of remaining) {
      for (let si = 0; si < outfieldSlots.length; si++) {
        allCandidates.push({ player: p, slotIdx: si, score: composite(p, outfieldSlots[si]) });
      }
    }
    // Sort by composite descending — highest scores assigned first
    allCandidates.sort((a, b) => b.score - a.score);

    const backupUsed = new Set<number>();
    for (const cand of allCandidates) {
      if (entries.length >= 23) break;
      if (!backupNeeded.has(cand.slotIdx)) continue;
      if (backupUsed.has(cand.player.id)) continue;
      backupNeeded.delete(cand.slotIdx);
      backupUsed.add(cand.player.id);
      used.add(cand.player.id);
      const slot = outfieldSlots[cand.slotIdx];
      const roles = bestRoles(cand.player);
      entries.push({
        player: cand.player, slot: slot.label, role: roles[0]?.role.short ?? "-",
        fit: slotScore(cand.player, slot), group: playerGroup(cand.player), isXI: false,
      });
    }

    // ── Step 4: Fill to 23 with best remaining by composite ──
    if (entries.length < 23) {
      const remaining = pool
        .filter(p => !used.has(p.id) && !isActualGK(p))
        .map(p => {
          const { slot, score } = bestSlotFor(p, slots);
          const roles = bestRoles(p);
          return { player: p, slot: slot.label, role: roles[0]?.role.short ?? "-", fit: slotScore(p, slot), score, group: playerGroup(p) };
        })
        .sort((a, b) => b.score - a.score);

      for (const cand of remaining) {
        if (entries.length >= 23) break;
        entries.push({ player: cand.player, slot: cand.slot, role: cand.role, fit: cand.fit, group: cand.group, isXI: false });
        used.add(cand.player.id);
      }
    }

    return { squad23: entries, bestXI: xi, usedIds: used };
  }, [allEligible, formationData]);

  // ── "Just Missed" — top non-selected players for debugging ──
  const justMissed = useMemo(() => {
    if (!formationData) return [];
    const slots = formationData.slots;
    return allEligible
      .filter(p => !squad23.some(e => e.player.id === p.id) && !isActualGK(p))
      .map(p => {
        const { slot, score } = bestSlotFor(p, slots);
        return { player: p, bestSlot: slot.label, composite: score };
      })
      .sort((a, b) => b.composite - a.composite)
      .slice(0, 10);
  }, [allEligible, squad23, formationData]);

  // Group squad by position group
  const grouped = useMemo(() => {
    const g: Record<string, SquadEntry[]> = { gk: [], def: [], mid: [], att: [] };
    squad23.forEach(e => g[e.group].push(e));
    for (const k of Object.keys(g)) g[k].sort((a, b) => {
      if (a.isXI !== b.isXI) return a.isXI ? -1 : 1;
      return b.player.current_ability - a.player.current_ability;
    });
    return g;
  }, [squad23]);

  // Formation-specific position depth (only slots in current formation)
  const posDepth = useMemo(() => {
    const seen = new Set<string>();
    return formationData.slots
      .filter(s => { const k = s.posKey; if (seen.has(k)) return false; seen.add(k); return true; })
      .map(s => ({
        label: s.label, key: s.posKey, slot: s,
        players: firstNatPlayers.filter(p => posR(p, s.posKey) >= 10)
          .sort((a, b) => composite(b, s) - composite(a, s))
          .slice(0, 4),
      }));
  }, [firstNatPlayers, formationData]);

  const persuasionIds = useMemo(() => new Set(persuasionTargets.map(p => p.id)), [persuasionTargets]);

  if (!managerProfile) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-zinc-500">
          <p className="text-lg mb-1">No data loaded</p>
          <button onClick={() => setCurrentPage("dashboard")}
            className="mt-4 px-4 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300">Dashboard</button>
        </div>
      </div>
    );
  }

  const ntName = managerProfile.national_team_name || nationName;
  const go = (p: Player) => { setSelectedPlayer(p); setCurrentPage("players"); };

  function PlayerRow({ p, slot, highlight, fitPct }: { p: Player; slot?: string; highlight?: boolean; fitPct?: number }) {
    const roles = bestRoles(p);
    const is2nd = persuasionIds.has(p.id);
    return (
      <div
        className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded cursor-pointer hover:bg-zinc-800/60 border
          ${highlight ? "bg-emerald-900/15 border-emerald-800/30" : "border-transparent"}`}
        onClick={() => go(p)}>
        <span className={`font-mono w-7 text-right font-bold ${caClass(p.current_ability)}`}>{p.current_ability}</span>
        {slot && <span className={`font-mono text-[10px] w-8 ${highlight ? "text-emerald-400" : "text-sky-400"}`}>{slot}</span>}
        <span className="text-zinc-200 truncate flex-1 min-w-0">{displayName(p)}</span>
        {highlight && <span className="text-emerald-400 text-[9px] font-bold shrink-0">XI</span>}
        {is2nd && <span className="px-1 py-0.5 text-[9px] font-bold rounded bg-amber-500/20 text-amber-400 shrink-0">2nd</span>}
        {fitPct !== undefined && <span className={`text-[9px] font-mono shrink-0 ${fitPct >= 50 ? "text-emerald-400" : fitPct >= 30 ? "text-yellow-400" : "text-orange-400"}`}>{fitPct.toFixed(0)}%</span>}
        <span className="text-zinc-500 text-[10px] w-6 text-right shrink-0">{p.age}y</span>
        <span className="text-zinc-500 w-5 text-center shrink-0">{p.natural_position}</span>
        <span className="text-zinc-600 text-[10px] truncate max-w-[90px] shrink-0">{p.club_name || "Free"}</span>
        {roles.length > 0 && <span className="text-zinc-500 text-[10px] w-14 text-right shrink-0">{roles[0].role.short} {roles[0].score.toFixed(0)}</span>}
      </div>
    );
  }

  const avgXICA = squad23.filter(e => e.isXI).length
    ? Math.round(squad23.filter(e => e.isXI).reduce((s, e) => s + e.player.current_ability, 0) / squad23.filter(e => e.isXI).length)
    : 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏳️</span>
          <div>
            <h1 className="text-lg font-bold text-zinc-100">{ntName} National Team</h1>
            <p className="text-xs text-zinc-500">
              {firstNatPlayers.length} 1st nat · {persuasionTargets.length} persuasion · XI avg CA <span className={caClass(avgXICA)}>{avgXICA}</span>
            </p>
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Formation:</span>
          <select value={formation} onChange={e => setFormation(e.target.value)}
            className="bg-zinc-800 text-xs text-zinc-200 rounded px-2 py-1 border border-zinc-700">
            {Object.entries(FORMATIONS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
          </select>
        </div>
        <div className="text-xs text-zinc-500">
          Squad: <span className="text-emerald-400 font-bold">{squad23.length}/23</span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Formation pitch */}
        <div className="w-[340px] border-r border-zinc-800 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/30">
            <h2 className="text-sm font-semibold text-zinc-300">Best XI — {formationData.name}</h2>
          </div>
          <div className="flex-1 relative bg-gradient-to-b from-emerald-950/30 to-zinc-950 overflow-auto">
            <div className="relative w-full" style={{ paddingBottom: "120%" }}>
              {bestXI.map(({ slot, player }, i) => (
                <div key={i} className="absolute flex flex-col items-center"
                  style={{ left: `${slot.x}%`, top: `${slot.y}%`, transform: "translate(-50%, -50%)" }}>
                  {player ? (
                    <button onClick={() => go(player)} className="flex flex-col items-center group/c">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                        posR(player, slot.posKey) >= 18 ? "border-emerald-400 bg-emerald-900/60 text-emerald-200"
                        : posR(player, slot.posKey) >= 14 ? "border-yellow-400 bg-yellow-900/40 text-yellow-200"
                        : "border-orange-400 bg-orange-900/40 text-orange-200"
                      }`}>
                        {player.current_ability}
                      </div>
                      <span className="text-[10px] text-zinc-300 mt-0.5 max-w-[80px] truncate group-hover/c:text-white">
                        {displayName(player).split(" ").pop()}
                      </span>
                      <span className="text-[9px] text-zinc-500">{slot.ipRole}</span>
                      {persuasionIds.has(player.id) && <span className="text-[8px] text-amber-400 font-bold">2nd</span>}
                    </button>
                  ) : (
                    <div className="flex flex-col items-center opacity-40">
                      <div className="w-11 h-11 rounded-full border-2 border-zinc-600 bg-zinc-800/60 flex items-center justify-center text-[10px] text-zinc-500">?</div>
                      <span className="text-[10px] text-zinc-600 mt-0.5">{slot.label}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Squad + Depth + Persuasion */}
        <div className="flex-1 flex flex-col overflow-auto">
          {/* ── BEST 23 ── */}
          <div className="p-3 space-y-2">
            <h2 className="text-sm font-bold text-zinc-200">📋 Best 23-Man Squad</h2>
            {(["gk", "def", "mid", "att"] as const).map(grp => (
              <div key={grp} className="bg-zinc-900/50 rounded-lg border border-zinc-800">
                <div className="px-3 py-1.5 text-xs font-semibold text-zinc-300 border-b border-zinc-800/50 flex items-center">
                  {GROUP_LABEL[grp]}
                  <span className="ml-auto text-zinc-500 font-normal">{grouped[grp].length}</span>
                </div>
                <div className="py-0.5">
                  {grouped[grp].map(e => (
                    <PlayerRow key={e.player.id} p={e.player} slot={e.slot} highlight={e.isXI} fitPct={e.fit} />
                  ))}
                  {grouped[grp].length === 0 && (
                    <div className="px-3 py-2 text-xs text-red-400/60 italic">No eligible players</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ── FORMATION DEPTH ── */}
          <div className="p-3 pt-0 space-y-2">
            <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
              📊 Formation Depth — {formationData.name}
              <span className="text-zinc-500 font-normal text-xs">(top 4 per slot)</span>
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {posDepth.map(pos => (
                <div key={pos.label} className="bg-zinc-900/40 rounded border border-zinc-800/50 p-2">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-xs font-mono font-bold text-emerald-400">{pos.label}</span>
                    <span className="text-[10px] text-zinc-600">{pos.players.length} opt</span>
                  </div>
                  {pos.players.map((p, i) => {
                    const nat = posR(p, pos.key);
                    const fit = slotScore(p, pos.slot);
                    return (
                      <div key={p.id} className="flex items-center gap-1 text-[11px] cursor-pointer hover:bg-zinc-800/40 rounded px-1"
                        onClick={() => go(p)}>
                        <span className="text-zinc-600 w-3">{i + 1}</span>
                        <span className={`font-mono w-6 text-right ${caClass(p.current_ability)}`}>{p.current_ability}</span>
                        <div className={`w-3.5 h-3.5 rounded-full text-[8px] flex items-center justify-center font-bold ${
                          nat >= 18 ? "bg-emerald-500/30 text-emerald-300" : nat >= 14 ? "bg-yellow-500/20 text-yellow-300" : "bg-orange-500/20 text-orange-300"
                        }`}>{nat}</div>
                        <span className="text-zinc-300 truncate flex-1">{displayName(p)}</span>
                        <span className={`text-[9px] font-mono ${fit >= 50 ? "text-emerald-400" : fit >= 30 ? "text-yellow-400" : "text-orange-400"}`}>{fit.toFixed(0)}</span>
                        <span className="text-zinc-600 text-[10px]">{p.age}y</span>
                      </div>
                    );
                  })}
                  {pos.players.length === 0 && <div className="text-[10px] text-red-400/50 italic">None</div>}
                </div>
              ))}
            </div>
          </div>

          {/* ── PERSUASION TARGETS ── */}
          <div className="p-3 pt-0">
            <button onClick={() => setExpandPersuade(!expandPersuade)}
              className="flex items-center gap-2 text-sm font-bold text-amber-400 hover:text-amber-300 mb-2">
              <UserPlus size={16} />
              🟡 Persuasion Targets — 2nd Nationality ({persuasionTargets.length})
              {expandPersuade ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <p className="text-[10px] text-zinc-500 mb-2">
              Players whose 1st nationality is NOT {nationName} but 2nd nationality IS. Can be persuaded to switch.
            </p>
            {expandPersuade && (
              <div className="bg-amber-900/10 rounded-lg border border-amber-800/30 overflow-hidden">
                {persuasionTargets.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-zinc-500 text-center">
                    No 2nd nationality players detected yet. The second nationality memory offset may need calibration in a future update.
                    <br /><span className="text-zinc-600">For now, filter the Players page by your nation name to manually spot dual-nationals.</span>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-[30px_40px_1fr_40px_40px_90px_70px] gap-1 px-2 py-1 text-[10px] text-zinc-600 font-semibold border-b border-amber-800/20">
                      <span>#</span><span>CA</span><span>Name</span><span>Age</span><span>Pos</span><span>Club</span><span>1st Nation</span>
                    </div>
                    {persuasionTargets.slice(0, 50).map((p, i) => (
                      <div key={p.id}
                        className="grid grid-cols-[30px_40px_1fr_40px_40px_90px_70px] gap-1 px-2 py-1 text-xs hover:bg-amber-900/20 cursor-pointer border-b border-amber-800/10"
                        onClick={() => go(p)}>
                        <span className="text-zinc-600">{i + 1}</span>
                        <span className={`font-mono font-bold ${caClass(p.current_ability)}`}>{p.current_ability}</span>
                        <span className="text-zinc-200 truncate">{displayName(p)}</span>
                        <span className="text-zinc-500">{p.age}</span>
                        <span className="text-zinc-400">{p.natural_position}</span>
                        <span className="text-zinc-500 truncate">{p.club_name || "Free"}</span>
                        <span className="text-amber-400/70 truncate text-[10px]">{p.nationality}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── JUST MISSED — diagnostic ── */}
          {justMissed.length > 0 && (
            <div className="p-3 pt-0">
              <h2 className="text-sm font-bold text-red-400/80 mb-2">🔍 Just Missed the Squad (Top 10)</h2>
              <p className="text-[10px] text-zinc-600 mb-1">Highest-composite outfield players NOT selected. Helps verify selection accuracy.</p>
              <div className="bg-red-900/10 rounded-lg border border-red-800/20 overflow-hidden">
                <div className="grid grid-cols-[24px_36px_1fr_40px_40px_60px_60px] gap-1 px-2 py-1 text-[10px] text-zinc-600 font-semibold border-b border-red-800/15">
                  <span>#</span><span>CA</span><span>Name</span><span>Age</span><span>Pos</span><span>BestSlot</span><span>Score</span>
                </div>
                {justMissed.map((m, i) => (
                  <div key={m.player.id}
                    className="grid grid-cols-[24px_36px_1fr_40px_40px_60px_60px] gap-1 px-2 py-1 text-xs hover:bg-red-900/15 cursor-pointer border-b border-red-800/10"
                    onClick={() => go(m.player)}>
                    <span className="text-zinc-600">{i + 1}</span>
                    <span className={`font-mono font-bold ${caClass(m.player.current_ability)}`}>{m.player.current_ability}</span>
                    <span className="text-zinc-200 truncate">{displayName(m.player)}</span>
                    <span className="text-zinc-500">{m.player.age}</span>
                    <span className="text-zinc-400">{m.player.natural_position}</span>
                    <span className="text-sky-400 text-[10px] font-mono">{m.bestSlot}</span>
                    <span className="text-orange-400 text-[10px] font-mono">{m.composite.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
