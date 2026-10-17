import { useAppStore } from "@/stores/useAppStore";
import { useMemo, useState } from "react";
import { displayName, formatValue, formatWage, caColor, paColor, ageColor, bestFormationFit, fitColorClass, calculateFeasibility, feasibilityScoreColor, valueEfficiency } from "@/types/player";
import { ArrowLeftRight, Tag, UserMinus, Clock, Star, UserPlus, ArrowUp, ArrowDown, Filter, Sparkles, TrendingUp, ShieldAlert } from "lucide-react";
import type { Player, PositionMap } from "@/types/player";

type TransferTab = "smart" | "listed" | "free" | "expiring" | "loans";
type SortKey = "ca" | "pa" | "age" | "value" | "wage" | "fit" | "feas" | "vfm" | "name";
type SortDir = "asc" | "desc";

const SLOT_POSITIONS: Record<string, (keyof PositionMap)[]> = {
  GK: ["goalkeeper"],
  DL: ["defender_left"], DC: ["defender_central"], DR: ["defender_right"],
  WBL: ["wing_back_left"], WBR: ["wing_back_right"],
  DM: ["defensive_midfielder"],
  ML: ["midfielder_left"], MC: ["midfielder_central"], MR: ["midfielder_right"],
  AML: ["winger_left"], AMC: ["attacking_midfielder"], AMR: ["winger_right"],
  ST: ["striker"],
};

export function TransfersPage() {
  const { players, setSelectedPlayer, setCurrentPage, addToCompare, toggleShortlist, shortlist, managerProfile, squadIds } = useAppStore();
  const [tab, setTab] = useState<TransferTab>("smart");
  const [sortKey, setSortKey] = useState<SortKey>("feas");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [posFilter, setPosFilter] = useState<string>("");
  const [minCA, setMinCA] = useState(0);
  const [maxAge, setMaxAge] = useState(0);
  const [realisticOnly, setRealisticOnly] = useState(false);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const gameYear = managerProfile?.game_year ?? 2026;

  const squadPlayers = useMemo(() =>
    players.filter(p => squadIds.has(p.id)),
  [players, squadIds]);

  const squadAvgCA = useMemo(() => {
    if (squadPlayers.length === 0) return 0;
    return Math.round(squadPlayers.reduce((s, p) => s + p.current_ability, 0) / squadPlayers.length);
  }, [squadPlayers]);

  const squadPosStrength = useMemo(() => {
    const posMap: Record<string, number[]> = {};
    for (const [slot, keys] of Object.entries(SLOT_POSITIONS)) {
      posMap[slot] = [];
    }
    for (const p of squadPlayers) {
      const fm = bestFormationFit(p);
      if (fm.slot && fm.slot !== "—") {
        if (!posMap[fm.slot]) posMap[fm.slot] = [];
        posMap[fm.slot].push(p.current_ability);
      }
    }
    const result: Record<string, { count: number; avgCA: number; maxCA: number }> = {};
    for (const [slot, cas] of Object.entries(posMap)) {
      cas.sort((a, b) => b - a);
      result[slot] = {
        count: cas.length,
        avgCA: cas.length > 0 ? Math.round(cas.reduce((a, b) => a + b, 0) / cas.length) : 0,
        maxCA: cas.length > 0 ? cas[0] : 0,
      };
    }
    return result;
  }, [squadPlayers]);

  const weakPositions = useMemo(() => {
    return Object.entries(squadPosStrength)
      .filter(([slot]) => slot !== "GK")
      .sort((a, b) => {
        if (a[1].count <= 1 && b[1].count > 1) return -1;
        if (b[1].count <= 1 && a[1].count > 1) return 1;
        return a[1].avgCA - b[1].avgCA;
      })
      .slice(0, 3)
      .map(([slot, data]) => ({ slot, ...data }));
  }, [squadPosStrength]);

  const listed = useMemo(() => players.filter(
    (p) => p.is_listed || p.transfer_status.includes("Listed") || p.transfer_status.includes("Release")
  ).sort((a, b) => b.current_ability - a.current_ability), [players]);

  const freeAgents = useMemo(() => players.filter(
    (p) => p.club_name === "" || p.club_name === "Free Agent" || p.club_name === "None"
  ).sort((a, b) => b.current_ability - a.current_ability), [players]);

  const expiringContracts = useMemo(() => players.filter((p) => {
    if (!p.contract_expiry || p.contract_expiry === "Unknown") return false;
    const parts = p.contract_expiry.split("-");
    if (parts.length < 2) return false;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    return !isNaN(year) && !isNaN(month) && (year <= gameYear || (year === gameYear + 1 && month <= 6));
  }).sort((a, b) => b.current_ability - a.current_ability), [players, gameYear]);

  const loans = useMemo(() => players.filter(
    (p) => p.is_on_loan
  ).sort((a, b) => b.current_ability - a.current_ability), [players]);

  const smartPicks = useMemo(() => {
    if (!managerProfile) return [];
    const nonOwn = players.filter(p => !squadIds.has(p.id));
    const available = nonOwn.filter(p =>
      p.is_listed || p.transfer_status.includes("Listed") || p.transfer_status.includes("Release")
      || p.club_name === "" || p.club_name === "Free Agent" || p.club_name === "None"
      || (() => {
        if (!p.contract_expiry || p.contract_expiry === "Unknown") return false;
        const parts = p.contract_expiry.split("-");
        if (parts.length < 1) return false;
        const year = parseInt(parts[0], 10);
        return !isNaN(year) && year - gameYear <= 1;
      })()
    );
    return available
      .map(p => {
        const feas = calculateFeasibility(p, managerProfile.squad_avg_world_rep, managerProfile.squad_highest_wage, managerProfile.squad_total_value, gameYear);
        const fm = bestFormationFit(p);
        const improvesPos = weakPositions.some(wp => wp.slot === fm.slot);
        const caBoost = p.current_ability - squadAvgCA;
        const smartScore = feas.score * 0.35 + Math.min(fm.fit, 100) * 0.25 + Math.max(0, Math.min(caBoost, 40)) * 0.5 + (improvesPos ? 12 : 0) + (p.age <= 23 && p.potential_ability > p.current_ability + 15 ? 8 : 0);
        return { ...p, _feasScore: feas.score, _fm: fm, _smartScore: smartScore, _improvesPos: improvesPos, _caBoost: caBoost };
      })
      .filter(p => p._feasScore >= 35)
      .sort((a, b) => b._smartScore - a._smartScore)
      .slice(0, 500);
  }, [players, managerProfile, squadIds, weakPositions, squadAvgCA, gameYear]);

  const tabs: { id: TransferTab; label: string; icon: typeof Tag; count: number }[] = [
    { id: "smart", label: "Smart Picks", icon: Sparkles, count: smartPicks.length },
    { id: "listed", label: "Listed", icon: Tag, count: listed.length },
    { id: "free", label: "Free Agents", icon: UserMinus, count: freeAgents.length },
    { id: "expiring", label: "Expiring", icon: Clock, count: expiringContracts.length },
    { id: "loans", label: "On Loan", icon: ArrowLeftRight, count: loans.length },
  ];

  const basePlayers: Player[] =
    tab === "smart" ? smartPicks
    : tab === "listed" ? listed
    : tab === "free" ? freeAgents
    : tab === "expiring" ? expiringContracts
    : loans;

  const getFeas = (p: Player) => {
    if (!managerProfile || squadIds.has(p.id)) return -1;
    return calculateFeasibility(p, managerProfile.squad_avg_world_rep, managerProfile.squad_highest_wage, managerProfile.squad_total_value, gameYear).score;
  };

  const getVfm = (p: Player) => valueEfficiency(p);

  const filtered = useMemo(() => {
    let data = [...basePlayers];
    if (posFilter) {
      const posKeys = SLOT_POSITIONS[posFilter];
      if (posKeys) {
        data = data.filter(p => {
          const posMap = p.positions as unknown as Record<string, number>;
          return posKeys.some(k => (posMap[k] ?? 0) >= 10);
        });
      }
    }
    if (minCA > 0) data = data.filter(p => p.current_ability >= minCA);
    if (maxAge > 0) data = data.filter(p => p.age <= maxAge);
    if (realisticOnly && managerProfile) data = data.filter(p => getFeas(p) >= 35);
    return data;
  }, [basePlayers, posFilter, minCA, maxAge, realisticOnly, managerProfile]);

  const currentPlayers = useMemo(() => {
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      let va: number, vb: number;
      switch (sortKey) {
        case "ca": va = a.current_ability; vb = b.current_ability; break;
        case "pa": va = a.potential_ability; vb = b.potential_ability; break;
        case "age": va = a.age; vb = b.age; break;
        case "value": va = a.value; vb = b.value; break;
        case "wage": va = a.wage; vb = b.wage; break;
        case "fit": va = bestFormationFit(a).fit; vb = bestFormationFit(b).fit; break;
        case "feas": va = getFeas(a); vb = getFeas(b); break;
        case "vfm": va = getVfm(a); vb = getVfm(b); break;
        case "name": return sortDir === "asc" ? displayName(a).localeCompare(displayName(b)) : displayName(b).localeCompare(displayName(a));
        default: va = a.current_ability; vb = b.current_ability;
      }
      return sortDir === "desc" ? vb - va : va - vb;
    });
    return sorted;
  }, [filtered, sortKey, sortDir, managerProfile]);

  const shortlistSet = new Set(shortlist.map((p) => p.id));

  const SortHeader = ({ label, sKey, className = "" }: { label: string; sKey: SortKey; className?: string }) => (
    <th className={`px-2 py-2 text-xs text-zinc-500 uppercase cursor-pointer select-none hover:text-zinc-300 transition-colors ${className}`} onClick={() => toggleSort(sKey)}>
      <div className="flex items-center gap-0.5">
        {label}
        {sortKey === sKey && (sortDir === "desc" ? <ArrowDown size={10} className="text-fm-accent" /> : <ArrowUp size={10} className="text-fm-accent" />)}
      </div>
    </th>
  );

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <h1 className="text-2xl font-bold text-zinc-100 mb-4 flex items-center gap-3">
        <ArrowLeftRight size={28} className="text-fm-accent" />
        Transfer Market
      </h1>

      {/* Squad Context Banner */}
      {managerProfile && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-4 flex flex-wrap gap-6 items-center">
          <div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Squad Avg CA</div>
            <div className={`text-lg font-bold font-mono ${caColor(squadAvgCA)}`}>{squadAvgCA}</div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Squad Size</div>
            <div className="text-lg font-bold text-zinc-200">{squadPlayers.length}</div>
          </div>
          <div className="border-l border-zinc-700 pl-6">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Weakest Positions</div>
            <div className="flex gap-2">
              {weakPositions.map(wp => (
                <button
                  key={wp.slot}
                  onClick={() => setPosFilter(posFilter === wp.slot ? "" : wp.slot)}
                  className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                    posFilter === wp.slot
                      ? "bg-red-500/20 text-red-300 border-red-500/40"
                      : "bg-zinc-800 text-orange-400 border-zinc-700 hover:border-orange-500/40"
                  }`}
                >
                  <ShieldAlert size={10} className="inline mr-1" />
                  {wp.slot} {wp.count <= 1 && <span className="text-red-400">(need cover)</span>}
                  <span className="text-zinc-500 ml-1">avg {wp.avgCA}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); if (t.id === "smart") { setSortKey("feas"); setSortDir("desc"); } }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? "bg-fm-green/20 text-fm-accent border border-fm-accent/30" : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
            }`}
          >
            <t.icon size={16} />
            {t.label}
            <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-zinc-800">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <Filter size={14} className="text-zinc-500" />
        <select
          value={posFilter}
          onChange={(e) => setPosFilter(e.target.value)}
          className="bg-zinc-800 text-zinc-300 text-xs rounded px-2 py-1.5 border border-zinc-700 focus:border-fm-accent/50 outline-none"
        >
          <option value="">All positions</option>
          {Object.keys(SLOT_POSITIONS).map(s => (
            <option key={s} value={s}>{s}{squadPosStrength[s] ? ` (${squadPosStrength[s].count} in squad, avg ${squadPosStrength[s].avgCA})` : ""}</option>
          ))}
        </select>
        <input
          type="number"
          placeholder={`Min CA${squadAvgCA ? ` (team avg: ${squadAvgCA})` : ""}`}
          value={minCA || ""}
          onChange={(e) => setMinCA(parseInt(e.target.value) || 0)}
          className="bg-zinc-800 text-zinc-300 text-xs rounded px-2 py-1.5 border border-zinc-700 w-52 focus:border-fm-accent/50 outline-none"
        />
        <input
          type="number"
          placeholder="Max Age"
          value={maxAge || ""}
          onChange={(e) => setMaxAge(parseInt(e.target.value) || 0)}
          className="bg-zinc-800 text-zinc-300 text-xs rounded px-2 py-1.5 border border-zinc-700 w-24 focus:border-fm-accent/50 outline-none"
        />
        <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={realisticOnly}
            onChange={(e) => setRealisticOnly(e.target.checked)}
            className="rounded border-zinc-600 bg-zinc-800 text-fm-accent focus:ring-fm-accent"
          />
          Realistic only
        </label>
        {(posFilter || minCA || maxAge || realisticOnly) && (
          <button
            onClick={() => { setPosFilter(""); setMinCA(0); setMaxAge(0); setRealisticOnly(false); }}
            className="text-xs text-zinc-500 hover:text-zinc-300 underline"
          >
            Clear filters
          </button>
        )}
        <span className="text-xs text-zinc-600 ml-auto">{currentPlayers.length} results</span>
      </div>

      {/* Player Table */}
      {currentPlayers.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-500">No players found. Try adjusting filters.</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <SortHeader label="Name" sKey="name" className="text-left" />
                <th className="px-2 py-2 text-center text-xs text-zinc-500 uppercase">Pos</th>
                <SortHeader label="Age" sKey="age" className="text-center" />
                <SortHeader label="CA" sKey="ca" className="text-center" />
                <SortHeader label="PA" sKey="pa" className="text-center" />
                <SortHeader label="Fit" sKey="fit" className="text-center" />
                <th className="px-2 py-2 text-center text-xs text-zinc-500 uppercase">Slot</th>
                <SortHeader label="Feas%" sKey="feas" className="text-center" />
                <SortHeader label="VfM" sKey="vfm" className="text-center" />
                <th className="px-2 py-2 text-left text-xs text-zinc-500 uppercase">Club</th>
                <SortHeader label="Value" sKey="value" className="text-right" />
                <SortHeader label="Wage" sKey="wage" className="text-right" />
                <th className="px-2 py-2 text-center text-xs text-zinc-500 uppercase">Contract</th>
                <th className="px-2 py-2 text-center text-xs text-zinc-500 uppercase">Status</th>
                <th className="px-2 py-2 text-center text-xs text-zinc-500 uppercase w-16">Act</th>
              </tr>
            </thead>
            <tbody>
              {currentPlayers.slice(0, 300).map((p) => {
                const fm = bestFormationFit(p);
                const feasScore = getFeas(p);
                const vfm = getVfm(p);
                const isOwn = squadIds.has(p.id);
                const caVsTeam = p.current_ability - squadAvgCA;
                return (
                <tr
                  key={p.id}
                  className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer ${isOwn ? "opacity-50" : ""}`}
                  onClick={() => { setSelectedPlayer(p); setCurrentPage("players"); }}
                >
                  <td className="px-2 py-2 text-zinc-100 font-medium truncate max-w-[150px]">
                    {displayName(p)}
                    {tab === "smart" && (p as any)._improvesPos && (
                      <TrendingUp size={10} className="inline ml-1 text-green-400" title="Fills weak position" />
                    )}
                  </td>
                  <td className="px-2 py-2 text-center text-sky-400 font-mono text-xs">{p.natural_position}</td>
                  <td className={`px-2 py-2 text-center text-xs ${ageColor(p.age)}`}>{p.age}</td>
                  <td className="px-2 py-2 text-center font-mono text-xs">
                    <span className={`font-bold ${caColor(p.current_ability)}`}>{p.current_ability}</span>
                    {squadAvgCA > 0 && (
                      <span className={`ml-0.5 text-[9px] ${caVsTeam > 5 ? "text-green-400" : caVsTeam >= -5 ? "text-zinc-500" : "text-red-400"}`}>
                        {caVsTeam > 0 ? `+${caVsTeam}` : caVsTeam}
                      </span>
                    )}
                  </td>
                  <td className={`px-2 py-2 text-center font-mono text-xs ${paColor(p.potential_ability)}`}>{p.potential_ability}</td>
                  <td className={`px-2 py-2 text-center font-mono font-bold text-xs ${fitColorClass(fm.fit)}`}>{fm.fit || "—"}</td>
                  <td className="px-2 py-2 text-center text-cyan-300 font-mono text-xs">{fm.slot}</td>
                  <td className={`px-2 py-2 text-center font-mono font-bold text-xs ${feasScore >= 0 ? feasibilityScoreColor(feasScore) : "text-zinc-600"}`}>{feasScore >= 0 ? feasScore : "—"}</td>
                  <td className={`px-2 py-2 text-center font-mono text-xs ${vfm >= 80 ? "text-green-400 font-bold" : vfm >= 60 ? "text-emerald-300" : vfm >= 40 ? "text-yellow-400" : "text-zinc-500"}`}>{vfm || "—"}</td>
                  <td className="px-2 py-2 text-zinc-400 text-xs truncate max-w-[120px]">{p.club_name || "—"}</td>
                  <td className="px-2 py-2 text-right text-zinc-400 text-xs">{p.value > 0 ? formatValue(p.value) : "—"}</td>
                  <td className="px-2 py-2 text-right text-zinc-400 text-xs">{p.wage > 0 ? formatWage(p.wage) : "—"}</td>
                  <td className="px-2 py-2 text-center text-zinc-500 text-xs">{p.contract_expiry?.slice(0, 7) || "—"}</td>
                  <td className="px-2 py-2 text-center">
                    {p.transfer_status && p.transfer_status !== "Unavailable" ? (
                      <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400">{p.transfer_status}</span>
                    ) : (
                      <span className="text-zinc-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        title="Toggle shortlist"
                        onClick={(e) => { e.stopPropagation(); toggleShortlist(p); }}
                        className={`p-1 rounded hover:bg-zinc-700 ${shortlistSet.has(p.id) ? "text-amber-400" : "text-zinc-600"}`}
                      >
                        <Star size={14} />
                      </button>
                      <button
                        title="Compare"
                        onClick={(e) => { e.stopPropagation(); addToCompare(p); }}
                        className="p-1 rounded hover:bg-zinc-700 text-zinc-600 hover:text-zinc-300"
                      >
                        <UserPlus size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ); })}
            </tbody>
          </table>
          </div>
          {currentPlayers.length > 300 && (
            <p className="px-3 py-2 text-xs text-zinc-600 text-center border-t border-zinc-800">
              Showing first 300 of {currentPlayers.length} players
            </p>
          )}
        </div>
      )}
    </div>
  );
}
