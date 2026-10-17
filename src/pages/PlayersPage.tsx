import { useState, useMemo } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { PlayerGrid } from "@/components/player/PlayerGrid";
import { PlayerDetail } from "@/components/player/PlayerDetail";
import { Search, Filter, Download, X, Star, RotateCcw, UserX, Target, SlidersHorizontal } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";

const POSITIONS = ["GK", "DC", "DL", "DR", "DM", "MC", "ML", "MR", "AMC", "AML", "AMR", "ST", "WBL", "WBR"];

// Formation slot buttons matching Best LLM formation
// DC matches both DCL/DCR, DM matches both DML/DMR
const FORMATION_SLOTS = [
  { label: "GK", slots: ["GK"], color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  { label: "DL", slots: ["DL"], color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { label: "DC", slots: ["DCL", "DCR"], color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { label: "DR", slots: ["DR"], color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { label: "DM", slots: ["DML", "DMR"], color: "bg-teal-500/20 text-teal-400 border-teal-500/30" },
  { label: "AML", slots: ["AML"], color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { label: "AMC", slots: ["AMC"], color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { label: "AMR", slots: ["AMR"], color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { label: "ST", slots: ["ST"], color: "bg-red-500/20 text-red-400 border-red-500/30" },
];

function RangeFilter({ label, value, onChange, placeholder, width = "w-14" }: {
  label: string; value: number | null; onChange: (v: number | null) => void; placeholder?: string; width?: string;
}) {
  return (
    <input
      type="number"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      placeholder={placeholder}
      title={label}
      className={`${width} px-1.5 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-200 tabular-nums focus:outline-none focus:border-fm-accent/50 focus:ring-1 focus:ring-fm-accent/20 placeholder-zinc-600`}
    />
  );
}

export function PlayersPage() {
  const store = useAppStore();
  const [showFilters, setShowFilters] = useState(false);

  const handleExportCSV = async () => {
    const path = await save({ filters: [{ name: "CSV", extensions: ["csv"] }], defaultPath: "fm_players.csv" });
    if (path) await store.exportCSV(path);
  };
  const handleExportJSON = async () => {
    const path = await save({ filters: [{ name: "JSON", extensions: ["json"] }], defaultPath: "fm_players.json" });
    if (path) await store.exportJSON(path);
  };

  // Build active filter list for chips
  const activeFilters: { key: string; label: string; clear: () => void }[] = [];
  if (store.searchQuery) activeFilters.push({ key: "search", label: `"${store.searchQuery}"`, clear: () => store.setSearchQuery("") });
  if (store.minCA !== null) activeFilters.push({ key: "minCA", label: `CA ≥ ${store.minCA}`, clear: () => store.setMinCA(null) });
  if (store.maxCA !== null) activeFilters.push({ key: "maxCA", label: `CA ≤ ${store.maxCA}`, clear: () => store.setMaxCA(null) });
  if (store.minPA !== null) activeFilters.push({ key: "minPA", label: `PA ≥ ${store.minPA}`, clear: () => store.setMinPA(null) });
  if (store.minAge !== null) activeFilters.push({ key: "minAge", label: `Age ≥ ${store.minAge}`, clear: () => store.setMinAge(null) });
  if (store.maxAge !== null) activeFilters.push({ key: "maxAge", label: `Age ≤ ${store.maxAge}`, clear: () => store.setMaxAge(null) });
  if (store.positionFilter) activeFilters.push({ key: "pos", label: `Pos: ${store.positionFilter}`, clear: () => store.setPositionFilter("") });
  if (store.footFilter) activeFilters.push({ key: "foot", label: `Foot: ${store.footFilter}`, clear: () => store.setFootFilter("") });
  if (store.leagueFilter) activeFilters.push({ key: "league", label: `League: ${store.leagueFilter}`, clear: () => store.setLeagueFilter("") });
  if (store.minValue !== null) activeFilters.push({ key: "minVal", label: `Val ≥ ${(store.minValue / 1e6).toFixed(1)}M`, clear: () => store.setMinValue(null) });
  if (store.maxValue !== null) activeFilters.push({ key: "maxVal", label: `Val ≤ ${(store.maxValue / 1e6).toFixed(1)}M`, clear: () => store.setMaxValue(null) });
  if (store.minFit !== null) activeFilters.push({ key: "minFit", label: `Fit ≥ ${store.minFit}%`, clear: () => store.setMinFit(null) });
  if (store.minFeas !== null) activeFilters.push({ key: "minFeas", label: `Feas ≥ ${store.minFeas}`, clear: () => store.setMinFeas(null) });
  if (store.formationSlotFilter) activeFilters.push({ key: "slot", label: `Slot: ${store.formationSlotFilter}`, clear: () => store.setFormationSlotFilter("") });
  if (store.showShortlistOnly) activeFilters.push({ key: "star", label: "★ Shortlist only", clear: () => store.setShowShortlistOnly(false) });
  if (store.showRealisticOnly) activeFilters.push({ key: "real", label: "🎯 Realistic only", clear: () => store.setShowRealisticOnly(false) });
  if (store.excludeOwnSquad) activeFilters.push({ key: "excl", label: "Exclude own squad", clear: () => store.setExcludeOwnSquad(false) });

  const hasFilters = activeFilters.length > 0;

  // Unique leagues for dropdown
  const leagues = useMemo(() => {
    const set = new Map<string, number>();
    for (const p of store.players) {
      if (p.league_name && p.league_name.length >= 3) {
        set.set(p.league_name, (set.get(p.league_name) || 0) + 1);
      }
    }
    return [...set.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 80)
      .map(([name, count]) => ({ name, count }));
  }, [store.players]);

  const stats = useMemo(() => {
    const p = store.players;
    return {
      total: p.length,
      wonderkids: p.filter((x) => x.potential_ability >= 150 && x.age <= 21).length,
      elite: p.filter((x) => x.current_ability >= 150).length,
      listed: p.filter((x) => x.is_listed).length,
      free: p.filter((x) => !x.club_name || x.club_name === "Free Agent" || x.club_name === "None").length,
    };
  }, [store.players]);

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      <div className="flex flex-col flex-1 min-w-0">

        {/* ═══ Row 1: Search + Quick Actions ═══ */}
        <div className="px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search name, club, nation..."
              value={store.searchQuery}
              onChange={(e) => store.setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-fm-accent/50 focus:ring-1 focus:ring-fm-accent/20"
            />
            {store.searchQuery && (
              <button onClick={() => store.setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Quick presets */}
          <div className="hidden lg:flex items-center gap-1">
            {stats.wonderkids > 0 && (
              <button onClick={() => { store.clearAllFilters(); store.setMinPA(150); store.setMaxAge(21); setShowFilters(true); }}
                className="text-[10px] px-2 py-1 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/30 hover:bg-purple-500/25 transition-colors">
                ✨ {stats.wonderkids} WK
              </button>
            )}
            {stats.elite > 0 && (
              <button onClick={() => { store.clearAllFilters(); store.setMinCA(150); setShowFilters(true); }}
                className="text-[10px] px-2 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 transition-colors">
                🌟 {stats.elite} Elite
              </button>
            )}
            {stats.listed > 0 && (
              <button onClick={() => { store.clearAllFilters(); store.setSearchQuery("Listed"); }}
                className="text-[10px] px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors">
                🏷 {stats.listed} Listed
              </button>
            )}
          </div>

          {/* Toggle buttons */}
          <button onClick={() => setShowFilters(!showFilters)}
            className={`px-2 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
              showFilters || hasFilters ? "bg-fm-green/20 text-fm-accent border border-fm-green/30" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700"
            }`}>
            <SlidersHorizontal size={12} /> Filters
            {hasFilters && <span className="min-w-[16px] h-4 rounded-full bg-fm-accent text-zinc-900 text-[9px] font-bold flex items-center justify-center">{activeFilters.length}</span>}
          </button>

          <button onClick={() => store.setShowShortlistOnly(!store.showShortlistOnly)}
            className={`px-2 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
              store.showShortlistOnly ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700"
            }`}>
            <Star size={11} /> {store.shortlist.length}
          </button>

          {store.managerProfile && (
            <>
              <button onClick={() => store.setShowRealisticOnly(!store.showRealisticOnly)}
                className={`px-2 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
                  store.showRealisticOnly ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700"
                }`}>
                <Target size={11} /> Realistic
              </button>
              <button onClick={() => store.setExcludeOwnSquad(!store.excludeOwnSquad)}
                className={`px-2 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors ${
                  store.excludeOwnSquad ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700"
                }`}>
                <UserX size={11} /> Excl. Squad
              </button>
            </>
          )}

          <div className="flex items-center gap-1 ml-auto">
            <button onClick={handleExportCSV} disabled={store.players.length === 0}
              className="px-2 py-1.5 bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg text-[10px] border border-zinc-700 disabled:opacity-50 flex items-center gap-1">
              <Download size={10} /> CSV
            </button>
            <button onClick={handleExportJSON} disabled={store.players.length === 0}
              className="px-2 py-1.5 bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg text-[10px] border border-zinc-700 disabled:opacity-50 flex items-center gap-1">
              <Download size={10} /> JSON
            </button>
          </div>
        </div>

        {/* ═══ Row 2: Formation Slot Quick-Pick ═══ */}
        {store.managerProfile && (
          <div className="px-3 py-1.5 border-b border-zinc-800/60 bg-zinc-900/30 flex items-center gap-1.5">
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-medium mr-1">Best LLM</span>
            {FORMATION_SLOTS.map((fs) => (
              <button
                key={fs.label}
                onClick={() => store.setFormationSlotFilter(store.formationSlotFilter === fs.label ? "" : fs.label)}
                className={`text-[10px] px-2 py-0.5 rounded border font-mono font-semibold transition-all ${
                  store.formationSlotFilter === fs.label
                    ? "bg-fm-green/30 text-fm-accent border-fm-green/50 ring-1 ring-fm-accent/30"
                    : `${fs.color} hover:brightness-125`
                }`}
              >
                {fs.label}
              </button>
            ))}
            {store.formationSlotFilter && (
              <button onClick={() => store.setFormationSlotFilter("")}
                className="text-[9px] text-zinc-500 hover:text-zinc-300 ml-1">
                <X size={10} />
              </button>
            )}
          </div>
        )}

        {/* ═══ Row 3: Filter Panel (expandable) ═══ */}
        {showFilters && (
          <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/40">
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">

              {/* Ability */}
              <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold self-center">Ability</span>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-zinc-500">CA</span>
                  <RangeFilter label="CA min" value={store.minCA} onChange={store.setMinCA} placeholder="min" />
                  <span className="text-[9px] text-zinc-600">–</span>
                  <RangeFilter label="CA max" value={store.maxCA} onChange={store.setMaxCA} placeholder="max" />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-zinc-500">PA ≥</span>
                  <RangeFilter label="PA min" value={store.minPA} onChange={store.setMinPA} placeholder="min" />
                </div>
              </div>

              {/* Player */}
              <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold self-center">Player</span>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-zinc-500">Age</span>
                  <RangeFilter label="Age min" value={store.minAge} onChange={store.setMinAge} placeholder="min" />
                  <span className="text-[9px] text-zinc-600">–</span>
                  <RangeFilter label="Age max" value={store.maxAge} onChange={store.setMaxAge} placeholder="max" />
                </div>
                <select value={store.positionFilter} onChange={(e) => store.setPositionFilter(e.target.value)}
                  className="px-1.5 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-200 focus:outline-none focus:border-fm-accent/50">
                  <option value="">All Pos</option>
                  {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={store.footFilter} onChange={(e) => store.setFootFilter(e.target.value)}
                  className="px-1.5 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-200 focus:outline-none focus:border-fm-accent/50">
                  <option value="">All Feet</option>
                  <option value="Right">Right</option>
                  <option value="Left">Left</option>
                  <option value="Either">Either</option>
                </select>
                <select value={store.leagueFilter} onChange={(e) => store.setLeagueFilter(e.target.value)}
                  className="px-1.5 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-200 focus:outline-none focus:border-fm-accent/50 max-w-[200px]">
                  <option value="">All Leagues</option>
                  {leagues.map((l) => <option key={l.name} value={l.name}>{l.name} ({l.count})</option>)}
                </select>
              </div>

              {/* Scouting */}
              <span className="text-[9px] text-cyan-400 uppercase tracking-wider font-semibold self-center">Scout</span>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-zinc-500">Fit ≥</span>
                  <RangeFilter label="Min Fit" value={store.minFit} onChange={store.setMinFit} placeholder="0" />
                </div>
                {store.managerProfile && (
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-zinc-500">Feas ≥</span>
                    <RangeFilter label="Min Feasibility" value={store.minFeas} onChange={store.setMinFeas} placeholder="0" />
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-zinc-500">Val</span>
                  <RangeFilter label="Value min" value={store.minValue} onChange={store.setMinValue} placeholder="min" width="w-16" />
                  <span className="text-[9px] text-zinc-600">–</span>
                  <RangeFilter label="Value max" value={store.maxValue} onChange={store.setMaxValue} placeholder="max" width="w-16" />
                </div>
              </div>
            </div>

            {hasFilters && (
              <div className="flex justify-end mt-1.5">
                <button onClick={store.clearAllFilters} className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1">
                  <RotateCcw size={10} /> Clear All Filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══ Row 4: Active Filter Chips ═══ */}
        {activeFilters.length > 0 && (
          <div className="px-3 py-1 border-b border-zinc-800/40 bg-zinc-950/50 flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] text-zinc-600">Active:</span>
            {activeFilters.map((f) => (
              <span key={f.key} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-fm-green/10 text-fm-accent border border-fm-green/20">
                {f.label}
                <button onClick={f.clear} className="hover:text-red-400 transition-colors"><X size={9} /></button>
              </span>
            ))}
            <button onClick={store.clearAllFilters} className="text-[9px] text-zinc-500 hover:text-red-400 ml-auto">
              Clear all
            </button>
          </div>
        )}

        {/* Grid */}
        <PlayerGrid />
      </div>

      {/* Detail Panel */}
      <PlayerDetail />
    </div>
  );
}
