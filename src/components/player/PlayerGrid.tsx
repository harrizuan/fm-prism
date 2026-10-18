import { useState, useMemo, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useAppStore } from "@/stores/useAppStore";
import type { Player } from "@/types/player";
import { displayName, attrColor, formatValue, formatWage, calculateFeasibility, bestFormationFit, playerAthletics, playerHiddenMentals, feasibilityColor, feasibilityScoreColor, developmentTrajectory, bigGameRating, injuryRiskIndex, pressingIntensity, consistencyIndex, valueEfficiency, leadershipScore, gsBestRating } from "@/types/player";
import { ArrowUp, ArrowDown, Star, StarOff } from "lucide-react";

function AttrCell({ value }: { value: number }) {
  if (value === 0) return <span className="text-zinc-700">-</span>;
  const bg = value >= 17 ? "bg-green-500/25" : value >= 13 ? "bg-green-500/10" : value >= 9 ? "bg-yellow-500/10" : value <= 4 ? "bg-red-500/15" : "";
  return (
    <span className={`font-mono text-xs tabular-nums w-full text-center inline-block rounded-sm py-0.5 ${bg} ${attrColor(value)}`}>
      {value}
    </span>
  );
}

function CACell({ value }: { value: number }) {
  const color = value >= 170 ? "text-purple-400" : value >= 150 ? "text-blue-400" : value >= 130 ? "text-fm-accent" : value >= 100 ? "text-green-400" : value >= 70 ? "text-yellow-400" : "text-zinc-400";
  return <span className={`font-mono font-bold text-xs tabular-nums ${color}`}>{value}</span>;
}

function PACell({ value }: { value: number }) {
  const color = value >= 180 ? "text-purple-400" : value >= 160 ? "text-blue-400" : value >= 140 ? "text-fm-accent" : value >= 120 ? "text-green-400" : value >= 90 ? "text-yellow-400" : "text-zinc-400";
  return <span className={`font-mono font-bold text-xs tabular-nums ${color}`}>{value === -1 ? "??" : value}</span>;
}

type ColGroup = "info" | "ability" | "finance" | "technical" | "mental" | "physical" | "goalkeeping" | "hidden" | "scouting";

interface ColMeta {
  group: ColGroup;
}

const COL_GROUPS: Record<ColGroup, { label: string; color: string }> = {
  info: { label: "Info", color: "text-zinc-300" },
  ability: { label: "Ability", color: "text-fm-accent" },
  finance: { label: "Finance", color: "text-yellow-400" },
  technical: { label: "Technical", color: "text-blue-400" },
  mental: { label: "Mental", color: "text-purple-400" },
  physical: { label: "Physical", color: "text-green-400" },
  goalkeeping: { label: "GK", color: "text-amber-400" },
  hidden: { label: "Hidden", color: "text-red-400" },
  scouting: { label: "Scouting", color: "text-cyan-400" },
};

function col(
  id: string, header: string, group: ColGroup, size: number,
  accessorOrFn: string | ((row: Player) => any),
  cellFn?: (value: any, row: Player) => React.ReactNode,
): ColumnDef<Player, any> {
  const base: any = {
    id,
    header,
    size,
    meta: { group } as ColMeta,
  };
  if (typeof accessorOrFn === "string") base.accessorKey = accessorOrFn;
  else base.accessorFn = accessorOrFn;

  if (cellFn) {
    base.cell = ({ getValue, row }: any) => cellFn(getValue(), row.original);
  }
  return base;
}

const textCell = (cls: string) => (v: any) => <span className={`text-xs truncate ${cls}`}>{v || ""}</span>;
const attrCellFn = (v: any) => <AttrCell value={v as number} />;

const allColumns: ColumnDef<Player, any>[] = [
  col("name", "Name", "info", 170, (r) => displayName(r), (v) => <span className="font-medium text-zinc-100 truncate block">{v}</span>),
  col("age", "Age", "info", 38, "age", (v) => <span className="text-zinc-300 text-xs tabular-nums">{v}</span>),
  col("pos", "Pos", "info", 42, "natural_position", (v) => <span className="text-sky-400 font-mono text-xs font-semibold">{v}</span>),
  col("club", "Club", "info", 130, "club_name", textCell("text-zinc-300")),
  col("nat", "Nat", "info", 90, "nationality", textCell("text-zinc-400")),
  col("foot", "Foot", "info", 42, "preferred_foot", (v) => <span className="text-zinc-400 text-xs">{v === "Right" ? "R" : v === "Left" ? "L" : "E"}</span>),
  col("height", "Ht", "info", 38, "height", (v) => <span className="text-zinc-400 text-xs tabular-nums">{v > 0 ? v : "-"}</span>),
  col("ca", "CA", "ability", 42, "current_ability", (v) => <CACell value={v as number} />),
  col("pa", "PA", "ability", 42, "potential_ability", (v) => <PACell value={v as number} />),
  col("value", "Value", "finance", 72, "value", (v) => <span className="text-zinc-300 text-xs">{v > 0 ? formatValue(v as number) : "-"}</span>),
  col("wage", "Wage", "finance", 62, "wage", (v) => <span className="text-zinc-400 text-xs">{v > 0 ? formatWage(v as number) : "-"}</span>),
  col("contract", "Contract", "finance", 72, "contract_expiry", (v) => <span className="text-zinc-500 text-xs">{v ? (v as string).slice(0, 7) : "-"}</span>),
  col("rep", "Rep", "ability", 42, "world_reputation", (v) => <span className="text-zinc-400 text-xs tabular-nums">{v > 0 ? v : "-"}</span>),
  col("gsRating", "GS%", "ability", 48, (p: Player) => gsBestRating(p).rating, (v) => {
    const val = v as number;
    const color = val >= 70 ? "text-green-400" : val >= 55 ? "text-emerald-300" : val >= 40 ? "text-yellow-400" : "text-orange-400";
    return <span className={`font-mono text-xs tabular-nums font-bold ${color}`}>{val > 0 ? val.toFixed(1) : "-"}</span>;
  }),
  // Technical
  col("cor", "Cor", "technical", 34, "technical.corners", attrCellFn),
  col("cro", "Cro", "technical", 34, "technical.crossing", attrCellFn),
  col("dri", "Dri", "technical", 34, "technical.dribbling", attrCellFn),
  col("fin", "Fin", "technical", 34, "technical.finishing", attrCellFn),
  col("fir", "Fir", "technical", 34, "technical.first_touch", attrCellFn),
  col("fk", "FK", "technical", 34, "technical.free_kick", attrCellFn),
  col("hea", "Hea", "technical", 34, "technical.heading", attrCellFn),
  col("ls", "LS", "technical", 34, "technical.long_shots", attrCellFn),
  col("lth", "LTh", "technical", 34, "technical.long_throws", attrCellFn),
  col("mar", "Mar", "technical", 34, "technical.marking", attrCellFn),
  col("pas", "Pas", "technical", 34, "technical.passing", attrCellFn),
  col("pen", "Pen", "technical", 34, "technical.penalty", attrCellFn),
  col("tac", "Tac", "technical", 34, "technical.tackling", attrCellFn),
  col("tec", "Tec", "technical", 34, "technical.technique", attrCellFn),
  // Mental
  col("agg", "Agg", "mental", 34, "mental.aggression", attrCellFn),
  col("ant", "Ant", "mental", 34, "mental.anticipation", attrCellFn),
  col("bra", "Bra", "mental", 34, "mental.bravery", attrCellFn),
  col("cmp", "Cmp", "mental", 34, "mental.composure", attrCellFn),
  col("cnt", "Cnt", "mental", 34, "mental.concentration", attrCellFn),
  col("dec", "Dec", "mental", 34, "mental.decisions", attrCellFn),
  col("det", "Det", "mental", 34, "mental.determination", attrCellFn),
  col("fla", "Fla", "mental", 34, "mental.flair", attrCellFn),
  col("lea", "Lea", "mental", 34, "mental.leadership", attrCellFn),
  col("otb", "OtB", "mental", 34, "mental.off_the_ball", attrCellFn),
  col("_pos", "Pos", "mental", 34, "mental.positioning", attrCellFn),
  col("tea", "Tea", "mental", 34, "mental.teamwork", attrCellFn),
  col("vis", "Vis", "mental", 34, "mental.vision", attrCellFn),
  col("wor", "Wor", "mental", 34, "mental.work_rate", attrCellFn),
  // Physical
  col("acc", "Acc", "physical", 34, "physical.acceleration", attrCellFn),
  col("agi", "Agi", "physical", 34, "physical.agility", attrCellFn),
  col("bal", "Bal", "physical", 34, "physical.balance", attrCellFn),
  col("jum", "Jum", "physical", 34, "physical.jumping", attrCellFn),
  col("nf", "NF", "physical", 34, "physical.natural_fitness", attrCellFn),
  col("pac", "Pac", "physical", 34, "physical.pace", attrCellFn),
  col("sta", "Sta", "physical", 34, "physical.stamina", attrCellFn),
  col("str", "Str", "physical", 34, "physical.strength", attrCellFn),
  // Goalkeeping
  col("han", "Han", "goalkeeping", 34, "goalkeeping.handling", attrCellFn),
  col("aer", "Aer", "goalkeeping", 34, "goalkeeping.aerial_reach", attrCellFn),
  col("cmd", "Cmd", "goalkeeping", 34, "goalkeeping.command_of_area", attrCellFn),
  col("com", "Com", "goalkeeping", 34, "goalkeeping.communication", attrCellFn),
  col("kic", "Kic", "goalkeeping", 34, "goalkeeping.kicking", attrCellFn),
  col("thr", "Thr", "goalkeeping", 34, "goalkeeping.throwing", attrCellFn),
  col("oo", "1v1", "goalkeeping", 34, "goalkeeping.one_on_ones", attrCellFn),
  col("ref", "Ref", "goalkeeping", 34, "goalkeeping.reflexes", attrCellFn),
  // Hidden
  col("con_h", "Con", "hidden", 34, "hidden.consistency", attrCellFn),
  col("imp", "Imp", "hidden", 34, "hidden.important_matches", attrCellFn),
  col("inj", "Inj", "hidden", 34, "hidden.injury_proneness", attrCellFn),
  col("ver", "Ver", "hidden", 34, "hidden.versatility", attrCellFn),
  col("adp", "Adp", "hidden", 34, "hidden.adaptability", attrCellFn),
  col("amb", "Amb", "hidden", 34, "hidden.ambition", attrCellFn),
  col("loy", "Loy", "hidden", 34, "hidden.loyalty", attrCellFn),
  col("pro_h", "Pro", "hidden", 34, "hidden.professionalism", attrCellFn),
  col("pre", "Pre", "hidden", 34, "hidden.pressure", attrCellFn),
  col("tem", "Tem", "hidden", 34, "hidden.temperament", attrCellFn),
  // Scouting — research-backed meta columns
  col("fmfit", "Fit", "scouting", 42, (r) => bestFormationFit(r).fit,
    (v) => { const n = v as number; const c = n >= 70 ? "text-green-400" : n >= 55 ? "text-emerald-300" : n >= 40 ? "text-yellow-400" : "text-orange-400"; return <span className={`font-mono font-bold text-xs ${c}`}>{n || "—"}</span>; }),
  col("fmslot", "Slot", "scouting", 38, (r) => bestFormationFit(r).slot,
    (v) => <span className="text-cyan-300 font-mono text-xs font-semibold">{v || "—"}</span>),
  col("ath", "Ath", "scouting", 34, (r) => playerAthletics(r),
    (v) => { const n = v as number; const c = n >= 16 ? "text-green-400" : n >= 12 ? "text-emerald-300" : n >= 8 ? "text-yellow-400" : "text-orange-400"; return <span className={`font-mono font-bold text-xs ${c}`}>{n}</span>; }),
  col("hmen", "Mnt", "scouting", 34, (r) => playerHiddenMentals(r),
    (v) => { const n = v as number; const c = n >= 16 ? "text-green-400" : n >= 12 ? "text-emerald-300" : n >= 8 ? "text-yellow-400" : "text-orange-400"; return <span className={`font-mono font-bold text-xs ${c}`}>{n}</span>; }),
  col("dirty", "Drt", "scouting", 34, "hidden.dirtiness",
    (v) => { const n = v as number; return <span className={`font-mono text-xs ${n >= 12 ? "text-red-400 font-bold" : n >= 8 ? "text-orange-400" : "text-green-400"}`}>{n || "—"}</span>; }),
  col("tfeas", "Feas%", "scouting", 46, (r) => {
      const store = useAppStore.getState();
      if (!store.managerProfile || store.squadIds.has(r.id)) return -1;
      return calculateFeasibility(r, store.managerProfile.squad_avg_world_rep, store.managerProfile.squad_highest_wage, store.managerProfile.squad_total_value, store.managerProfile.game_year).score;
    },
    (v) => {
      const n = v as number;
      if (n < 0) return <span className="text-zinc-600 text-xs">—</span>;
      return <span className={`font-mono font-bold text-xs ${feasibilityScoreColor(n)}`}>{n}</span>;
    }),
  col("repgap", "Gap", "scouting", 50, (r) => {
      const store = useAppStore.getState();
      if (!store.managerProfile) return 0;
      const pRep = Math.max(r.world_reputation, r.current_reputation);
      return pRep - store.managerProfile.squad_avg_world_rep;
    },
    (v) => {
      const gap = v as number;
      const absGap = Math.abs(gap);
      const color = gap <= -1000 ? "text-green-400" : gap <= 0 ? "text-emerald-400" : gap <= 1000 ? "text-yellow-400" : gap <= 2500 ? "text-orange-400" : "text-red-400";
      const label = gap > 0 ? `+${absGap > 999 ? (absGap / 1000).toFixed(1) + "k" : absGap}` : gap < 0 ? `-${absGap > 999 ? (absGap / 1000).toFixed(1) + "k" : absGap}` : "=";
      return <span className={`font-mono text-xs ${color}`}>{label}</span>;
    }),
  // ── Research-backed scouting intelligence columns ──
  col("dev", "Dev", "scouting", 38, (r) => developmentTrajectory(r),
    (v) => { const n = v as number; const c = n >= 60 ? "text-emerald-400" : n >= 35 ? "text-green-400" : n >= 15 ? "text-yellow-400" : "text-zinc-500"; return <span className={`font-mono font-bold text-xs ${c}`}>{n > 0 ? n.toFixed(0) : "—"}</span>; }),
  col("bgr", "Big", "scouting", 36, (r) => bigGameRating(r),
    (v) => { const n = v as number; const c = n >= 75 ? "text-green-400" : n >= 55 ? "text-emerald-300" : n >= 40 ? "text-yellow-400" : "text-orange-400"; return <span className={`font-mono text-xs ${c}`}>{n.toFixed(0)}</span>; }),
  col("inj", "Inj", "scouting", 34, (r) => injuryRiskIndex(r),
    (v) => { const n = v as number; const c = n >= 60 ? "text-red-400 font-bold" : n >= 35 ? "text-orange-400" : n >= 15 ? "text-yellow-400" : "text-green-400"; return <span className={`font-mono text-xs ${c}`}>{n.toFixed(0)}</span>; }),
  col("prs", "Prs", "scouting", 36, (r) => pressingIntensity(r),
    (v) => { const n = v as number; const c = n >= 70 ? "text-green-400" : n >= 55 ? "text-emerald-300" : n >= 40 ? "text-yellow-400" : "text-orange-400"; return <span className={`font-mono text-xs ${c}`}>{n.toFixed(0)}</span>; }),
  col("cns", "Con", "scouting", 36, (r) => consistencyIndex(r),
    (v) => { const n = v as number; const c = n >= 70 ? "text-green-400" : n >= 50 ? "text-emerald-300" : n >= 35 ? "text-yellow-400" : "text-orange-400"; return <span className={`font-mono text-xs ${c}`}>{n.toFixed(0)}</span>; }),
  col("ver", "VfM", "scouting", 38, (r) => valueEfficiency(r),
    (v) => { const n = v as number; const c = n >= 80 ? "text-green-400" : n >= 50 ? "text-emerald-300" : n >= 25 ? "text-yellow-400" : "text-orange-400"; return <span className={`font-mono text-xs ${c}`}>{n >= 100 ? "Free" : n.toFixed(0)}</span>; }),
  col("ldr", "Ldr", "scouting", 36, (r) => leadershipScore(r),
    (v) => { const n = v as number; const c = n >= 70 ? "text-green-400" : n >= 50 ? "text-emerald-300" : n >= 35 ? "text-yellow-400" : "text-zinc-500"; return <span className={`font-mono text-xs ${c}`}>{n.toFixed(0)}</span>; }),
];

const DEFAULT_VISIBLE = new Set([
  "name", "age", "pos", "club", "nat", "ca", "pa", "value", "wage",
  "fin", "pas", "dri", "tac", "hea", "cro", "fir", "tec",
  "cmp", "dec", "vis", "otb", "ant", "wor", "det",
  "pac", "acc", "str", "sta",
]);

export function PlayerGrid() {
  const { players, searchQuery, setSelectedPlayer, selectedPlayer, addToCompare, minCA, maxCA, minPA, maxAge, minAge, positionFilter, maxValue, minValue, footFilter, leagueFilter, showShortlistOnly, showRealisticOnly, minFit, minFeas, formationSlotFilter, excludeOwnSquad, shortlist, toggleShortlist, managerProfile, squadIds } = useAppStore();
  const [sorting, setSorting] = useState<SortingState>([{ id: "ca", desc: true }]);
  const [visibleCols, setVisibleCols] = useState<Set<string>>(DEFAULT_VISIBLE);
  const [showColPicker, setShowColPicker] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const columns = useMemo(
    () => allColumns.filter((c) => visibleCols.has(c.id!)),
    [visibleCols]
  );

  const shortlistSet = useMemo(() => new Set(shortlist.map((p) => p.id)), [shortlist]);

  const filteredData = useMemo(() => {
    let data = players;
    if (showShortlistOnly) data = data.filter((p) => shortlistSet.has(p.id));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        (p) =>
          displayName(p).toLowerCase().includes(q) ||
          p.club_name.toLowerCase().includes(q) ||
          p.nationality.toLowerCase().includes(q)
      );
    }
    if (minCA) data = data.filter((p) => p.current_ability >= minCA);
    if (maxCA) data = data.filter((p) => p.current_ability <= maxCA);
    if (minPA) data = data.filter((p) => p.potential_ability >= minPA);
    if (maxAge) data = data.filter((p) => p.age <= maxAge);
    if (minAge) data = data.filter((p) => p.age >= minAge);
    if (minValue) data = data.filter((p) => p.value >= minValue);
    if (maxValue) data = data.filter((p) => p.value <= maxValue);
    if (positionFilter) data = data.filter((p) => p.natural_position.toLowerCase().includes(positionFilter.toLowerCase()));
    if (footFilter) data = data.filter((p) => p.preferred_foot === footFilter);
    if (leagueFilter) data = data.filter((p) => p.league_name.toLowerCase().includes(leagueFilter.toLowerCase()));
    if (excludeOwnSquad) data = data.filter((p) => !squadIds.has(p.id));
    if (minFit) data = data.filter((p) => bestFormationFit(p).fit >= minFit);
    if (minFeas && managerProfile) {
      data = data.filter((p) => {
        if (squadIds.has(p.id)) return false;
        return calculateFeasibility(p, managerProfile.squad_avg_world_rep, managerProfile.squad_highest_wage, managerProfile.squad_total_value, managerProfile.game_year).score >= minFeas;
      });
    }
    if (formationSlotFilter) {
      const SLOT_MAP: Record<string, string[]> = {
        GK: ["GK"], DL: ["DL"], DC: ["DCL", "DCR"], DR: ["DR"],
        DM: ["DML", "DMR"], AML: ["AML"], AMC: ["AMC"], AMR: ["AMR"], ST: ["ST"],
      };
      const matchSlots = SLOT_MAP[formationSlotFilter] || [formationSlotFilter];
      data = data.filter((p) => matchSlots.includes(bestFormationFit(p).slot));
    }
    if (showRealisticOnly && managerProfile) {
      data = data.filter((p) => {
        if (squadIds.has(p.id)) return false; // exclude own players
        const f = calculateFeasibility(p, managerProfile.squad_avg_world_rep, managerProfile.squad_highest_wage, managerProfile.squad_total_value, managerProfile.game_year);
        return f.score >= 45; // "possible" or better
      });
    }
    return data;
  }, [players, searchQuery, minCA, maxCA, minPA, maxAge, minAge, positionFilter, maxValue, minValue, footFilter, leagueFilter, showShortlistOnly, showRealisticOnly, minFit, minFeas, formationSlotFilter, excludeOwnSquad, shortlistSet, managerProfile, squadIds]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { rows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 32,
    overscan: 30,
  });

  const toggleCol = (id: string) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const presets: Record<string, string[]> = {
    Compact: ["name", "age", "pos", "club", "ca", "pa", "value"],
    Full: allColumns.map((c) => c.id!),
    Scouting: ["name", "age", "pos", "club", "ca", "pa", "fmfit", "fmslot", "ath", "hmen", "tfeas", "repgap", "dev", "bgr", "inj", "prs", "cns", "ver", "ldr", "value", "wage"],
    Transfer: ["name", "age", "pos", "club", "ca", "pa", "fmfit", "fmslot", "tfeas", "repgap", "ver", "dev", "value", "wage", "contract", "rep", "amb", "loy", "ath"],
    Technical: ["name", "age", "pos", "club", "ca", ...allColumns.filter((c) => (c.meta as ColMeta)?.group === "technical").map((c) => c.id!)],
    Mental: ["name", "age", "pos", "club", "ca", ...allColumns.filter((c) => (c.meta as ColMeta)?.group === "mental").map((c) => c.id!)],
    Physical: ["name", "age", "pos", "club", "ca", ...allColumns.filter((c) => (c.meta as ColMeta)?.group === "physical").map((c) => c.id!)],
    GK: ["name", "age", "pos", "club", "ca", "pa", ...allColumns.filter((c) => (c.meta as ColMeta)?.group === "goalkeeping").map((c) => c.id!)],
    Hidden: ["name", "age", "pos", "club", "ca", "pa", ...allColumns.filter((c) => (c.meta as ColMeta)?.group === "hidden").map((c) => c.id!)],
    Finance: ["name", "age", "pos", "club", "ca", "pa", "value", "wage", "contract", "rep"],
  };

  const shortlistIdSet = new Set(shortlist.map((p) => p.id));

  return (
    <div className="flex flex-col h-full">
      {/* Count + Column picker */}
      <div className="px-3 py-1.5 text-xs text-zinc-500 border-b border-zinc-800 flex justify-between items-center gap-2 bg-zinc-900/30">
        <span>
          <span className="text-zinc-300 font-medium">{filteredData.length.toLocaleString()}</span> / {players.length.toLocaleString()} players
        </span>
        <div className="relative">
          <button onClick={() => setShowColPicker(!showColPicker)} className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-0.5 rounded bg-zinc-800/50 border border-zinc-700/50">
            Columns ({visibleCols.size})
          </button>
          {showColPicker && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl p-3 w-[420px] max-h-[500px] overflow-y-auto">
              <div className="flex gap-1 flex-wrap mb-3">
                {Object.entries(presets).map(([name, cols]) => (
                  <button key={name} onClick={() => setVisibleCols(new Set(cols))} className="text-[10px] px-2 py-0.5 bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded border border-zinc-700">
                    {name}
                  </button>
                ))}
              </div>
              {Object.entries(COL_GROUPS).map(([group, { label, color }]) => (
                <div key={group} className="mb-2">
                  <div className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${color}`}>{label}</div>
                  <div className="flex flex-wrap gap-1">
                    {allColumns.filter((c) => (c.meta as ColMeta)?.group === group).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => toggleCol(c.id!)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border transition-all ${
                          visibleCols.has(c.id!) ? "bg-fm-green/20 border-fm-green/40 text-fm-accent" : "bg-zinc-800 border-zinc-700 text-zinc-500"
                        }`}
                      >
                        {typeof c.header === "string" ? c.header : c.id}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table with horizontal scroll */}
      <div ref={tableContainerRef} className="flex-1 overflow-auto">
        <div style={{ minWidth: columns.reduce((sum, c) => sum + (c.size || 40), 0) + 40 }}>
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="bg-zinc-900/95 backdrop-blur border-b border-zinc-700">
                  <th className="w-8 px-1 py-1.5" />
                  {headerGroup.headers.map((header) => {
                    const group = (header.column.columnDef.meta as ColMeta)?.group;
                    const groupColor = group ? COL_GROUPS[group]?.color : "";
                    return (
                      <th
                        key={header.id}
                        className={`px-1 py-1.5 text-left text-[10px] font-semibold cursor-pointer select-none whitespace-nowrap transition-colors hover:text-zinc-100 ${
                          header.column.getIsSorted() ? "text-fm-accent" : groupColor || "text-zinc-400"
                        }`}
                        style={{ width: header.getSize(), minWidth: header.getSize() }}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-0.5">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === "asc" && <ArrowUp size={10} />}
                          {header.column.getIsSorted() === "desc" && <ArrowDown size={10} />}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {virtualizer.getVirtualItems().length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="text-center py-20 text-zinc-500">
                    {players.length === 0 ? "No players loaded. Connect to FM and scan." : "No players match filters."}
                  </td>
                </tr>
              ) : (
                <>
                  {virtualizer.getVirtualItems().length > 0 && (
                    <tr style={{ height: `${virtualizer.getVirtualItems()[0]?.start ?? 0}px` }}>
                      <td colSpan={columns.length + 1} />
                    </tr>
                  )}
                  {virtualizer.getVirtualItems().map((vr) => {
                    const row = rows[vr.index];
                    const p = row.original;
                    const isSel = selectedPlayer?.id === p.id;
                    const isStar = shortlistIdSet.has(p.id);
                    return (
                      <tr
                        key={row.id}
                        data-index={vr.index}
                        ref={(node) => virtualizer.measureElement(node)}
                        className={`border-b border-zinc-800/40 cursor-pointer transition-colors ${
                          isSel ? "bg-fm-green/15 border-l-2 border-l-fm-accent" : "hover:bg-zinc-800/40"
                        }`}
                        onClick={() => setSelectedPlayer(p)}
                        onDoubleClick={() => addToCompare(p)}
                      >
                        <td className="w-8 px-1 text-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleShortlist(p); }}
                            className={`p-0.5 rounded transition-colors ${isStar ? "text-yellow-400" : "text-zinc-700 hover:text-zinc-400"}`}
                          >
                            {isStar ? <Star size={12} fill="currentColor" /> : <StarOff size={12} />}
                          </button>
                        </td>
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="px-1 py-1 truncate"
                            style={{ maxWidth: cell.column.getSize(), minWidth: cell.column.getSize() }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  {virtualizer.getVirtualItems().length > 0 && (
                    <tr style={{ height: `${virtualizer.getTotalSize() - (virtualizer.getVirtualItems()[virtualizer.getVirtualItems().length - 1]?.end ?? 0)}px` }}>
                      <td colSpan={columns.length + 1} />
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
