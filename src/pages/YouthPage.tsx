import { useAppStore } from "@/stores/useAppStore";
import { useMemo, useState } from "react";
import {
  displayName, formatValue, formatWage, bestRoles, bestFormationFit,
  playerAthletics, playerHiddenMentals, calculateFeasibility,
} from "@/types/player";
import { generateAIDatabase } from "@/utils/aiBrief";
import type { Player, YouthTeam } from "@/types/player";
import { Download, Star, GitCompare, ChevronDown, ChevronUp, TrendingUp, Zap, Trophy } from "lucide-react";
import { PlayerDetail } from "@/components/player/PlayerDetail";

function caClass(ca: number) {
  return ca >= 140 ? "text-yellow-300" : ca >= 120 ? "text-emerald-400" : ca >= 100 ? "text-sky-400"
    : ca >= 80 ? "text-zinc-200" : ca >= 60 ? "text-zinc-400" : "text-zinc-600";
}
function growthClass(pa: number, ca: number) {
  const gap = pa - ca;
  return gap >= 40 ? "text-emerald-400" : gap >= 20 ? "text-sky-400" : gap >= 10 ? "text-zinc-300" : "text-zinc-500";
}
function ageColor(age: number) {
  return age <= 16 ? "text-emerald-400" : age <= 18 ? "text-sky-400" : age <= 20 ? "text-zinc-300" : "text-zinc-500";
}
function devColor(v: number) {
  return v >= 16 ? "text-emerald-400" : v >= 12 ? "text-sky-400" : v >= 8 ? "text-zinc-300" : "text-red-400";
}

function devScore(p: Player) {
  return (p.hidden.professionalism ?? 0) * 2 + (p.mental.determination ?? 0);
}
function growthProjection(p: Player): string {
  const gap = p.potential_ability - p.current_ability;
  if (gap <= 0) return "Peaked";
  const pro = p.hidden.professionalism ?? 10;
  const det = p.mental.determination ?? 10;
  const rate = (pro >= 14 ? 12 : pro >= 10 ? 9 : 7) + (det >= 14 ? 3 : det >= 10 ? 1 : 0);
  const years = Math.ceil(gap / rate);
  return `~${rate} CA/yr → ${years}yr`;
}

type SortKey = "ca" | "pa" | "gap" | "age" | "dev" | "name" | "pos" | "value";

export function YouthPage() {
  const { players, squadIds, managerProfile, youthTeams, setCurrentPage, addToCompare, toggleShortlist, shortlist, setSelectedPlayer, selectedPlayer } = useAppStore();
  const [activeTeam, setActiveTeam] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("pa");
  const [sortAsc, setSortAsc] = useState(false);
  const [exportMsg, setExportMsg] = useState("");
  const [filterPos, setFilterPos] = useState("");
  const [showProspects, setShowProspects] = useState(true);

  const clubName = managerProfile?.club_name ?? "";

  // All youth player IDs from backend teams
  const youthIdSets = useMemo(() => {
    const map: Record<string, Set<number>> = {};
    for (const t of youthTeams) {
      map[t.name] = new Set(t.player_ids);
    }
    return map;
  }, [youthTeams]);

  const allYouthIds = useMemo(() => {
    const s = new Set<number>();
    for (const t of youthTeams) for (const id of t.player_ids) s.add(id);
    return s;
  }, [youthTeams]);

  // Fallback: if backend found no youth teams, use frontend detection
  const youthPlayers = useMemo(() => {
    if (!clubName) return [];
    const clubLower = clubName.toLowerCase();
    if (allYouthIds.size > 0) {
      return players.filter(p => allYouthIds.has(p.id));
    }
    return players.filter(p =>
      p.club_name?.toLowerCase() === clubLower && !squadIds.has(p.id)
    );
  }, [players, squadIds, clubName, allYouthIds]);

  // Build fallback teams if backend didn't provide
  const effectiveTeams = useMemo((): YouthTeam[] => {
    if (youthTeams.length > 0) return youthTeams;
    const u18 = youthPlayers.filter(p => p.age <= 17);
    const u21 = youthPlayers.filter(p => p.age > 17);
    const result: YouthTeam[] = [];
    if (u21.length > 0) result.push({
      name: "U21 / Reserve", player_ids: u21.map(p => p.id), player_count: u21.length,
      avg_ca: u21.reduce((s, p) => s + p.current_ability, 0) / u21.length,
      avg_age: u21.reduce((s, p) => s + p.age, 0) / u21.length,
    });
    if (u18.length > 0) result.push({
      name: "U18 / Youth", player_ids: u18.map(p => p.id), player_count: u18.length,
      avg_ca: u18.reduce((s, p) => s + p.current_ability, 0) / u18.length,
      avg_age: u18.reduce((s, p) => s + p.age, 0) / u18.length,
    });
    return result;
  }, [youthTeams, youthPlayers]);

  const effectiveIdSets = useMemo(() => {
    const map: Record<string, Set<number>> = {};
    for (const t of effectiveTeams) map[t.name] = new Set(t.player_ids);
    return map;
  }, [effectiveTeams]);

  // Filtered + sorted player list
  const displayPlayers = useMemo(() => {
    let list = activeTeam === "all"
      ? youthPlayers
      : youthPlayers.filter(p => effectiveIdSets[activeTeam]?.has(p.id));
    if (filterPos) list = list.filter(p => p.natural_position === filterPos);

    const sorted = [...list];
    const dir = sortAsc ? 1 : -1;
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "ca": return (a.current_ability - b.current_ability) * dir;
        case "pa": return (a.potential_ability - b.potential_ability) * dir;
        case "gap": return ((a.potential_ability - a.current_ability) - (b.potential_ability - b.current_ability)) * dir;
        case "age": return (a.age - b.age) * dir;
        case "dev": return (devScore(a) - devScore(b)) * dir;
        case "name": return displayName(a).localeCompare(displayName(b)) * dir;
        case "pos": return a.natural_position.localeCompare(b.natural_position) * dir;
        case "value": return (Number(a.value) - Number(b.value)) * dir;
        default: return 0;
      }
    });
    return sorted;
  }, [youthPlayers, activeTeam, filterPos, sortKey, sortAsc, effectiveIdSets]);

  // Key analytics
  const starProspects = useMemo(() =>
    youthPlayers.filter(p => p.potential_ability >= 100).sort((a, b) => b.potential_ability - a.potential_ability),
    [youthPlayers]);

  const readyForFirstTeam = useMemo(() =>
    youthPlayers.filter(p => p.current_ability >= 80).sort((a, b) => b.current_ability - a.current_ability),
    [youthPlayers]);

  const devGems = useMemo(() =>
    youthPlayers.filter(p => devScore(p) >= 35 && p.potential_ability - p.current_ability >= 20)
      .sort((a, b) => devScore(b) - devScore(a)),
    [youthPlayers]);

  const positions = useMemo(() => {
    const s = new Set(youthPlayers.map(p => p.natural_position));
    return [...s].sort();
  }, [youthPlayers]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };
  const sortIcon = (key: SortKey) => sortKey === key ? (sortAsc ? "↑" : "↓") : "";

  const mp = managerProfile;
  const clubRep = mp?.squad_avg_world_rep ?? 0;
  const highW = mp?.squad_highest_wage ?? 0;
  const totalV = mp?.squad_total_value ?? 0;
  const gY = mp?.game_year ?? 2026;

  const handleExport = async () => {
    try {
      await generateAIDatabase(players, managerProfile!, squadIds, shortlist);
      setExportMsg("✓ Exported");
      setTimeout(() => setExportMsg(""), 3000);
    } catch (e) { setExportMsg(`✗ ${e}`); }
  };

  if (!managerProfile || !youthPlayers.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-zinc-500">
          <p className="text-lg mb-1">No youth squad data</p>
          <p className="text-sm">Connect to FM and load players first.</p>
          <button onClick={() => setCurrentPage("dashboard")}
            className="mt-4 px-4 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300">Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* ═══ Main content ═══ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-zinc-800/60">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-amber-400">🎓 {clubName} Youth Academy</h1>
            <span className="text-xs text-zinc-500">{youthPlayers.length} players across {effectiveTeams.length} team{effectiveTeams.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-zinc-500">
            <button onClick={handleExport}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800/70 hover:bg-emerald-900/40 border border-zinc-700/40 hover:border-emerald-600/40 transition-colors text-zinc-400 hover:text-emerald-300"
              title="Export all data including youth for AI analysis">
              <Download size={11} /><span className="text-[10px]">AI Brief</span>
            </button>
            {exportMsg && <span className={`text-[10px] ${exportMsg.startsWith("✓") ? "text-emerald-400" : "text-red-400"}`}>{exportMsg}</span>}
          </div>
        </div>

        {/* Team tabs */}
        <div className="flex items-center gap-1 px-5 py-2 border-b border-zinc-800/40 overflow-x-auto">
          <button onClick={() => setActiveTeam("all")}
            className={`px-2.5 py-1 text-xs rounded transition-colors flex items-center gap-1.5 ${
              activeTeam === "all" ? "bg-amber-600 text-white font-semibold" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60"
            }`}>
            All ({youthPlayers.length})
          </button>
          {effectiveTeams.map(t => (
            <button key={t.name} onClick={() => setActiveTeam(t.name)}
              className={`px-2.5 py-1 text-xs rounded transition-colors flex items-center gap-1.5 ${
                activeTeam === t.name ? "bg-amber-600 text-white font-semibold" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60"
              }`}>
              {t.name}
              <span className={`font-mono text-[10px] ${activeTeam === t.name ? "text-amber-200" : "text-zinc-600"}`}>
                {t.player_count} · CA {Math.round(t.avg_ca)}
              </span>
            </button>
          ))}

          <div className="flex-1" />
          <select value={filterPos} onChange={e => setFilterPos(e.target.value)}
            className="text-[10px] bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-300">
            <option value="">All Positions</option>
            {positions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Prospect cards */}
        {showProspects && activeTeam === "all" && (
          <div className="px-5 py-2 space-y-2 border-b border-zinc-800/40">
            {/* Star Prospects */}
            {starProspects.length > 0 && (
              <div className="bg-amber-900/10 rounded-lg border border-amber-800/30 p-2">
                <div className="text-[10px] font-semibold text-amber-400 mb-1 flex items-center gap-1"><Trophy size={10} /> Star Prospects (PA ≥ 100)</div>
                <div className="flex flex-wrap gap-2">
                  {starProspects.slice(0, 8).map(p => (
                    <button key={p.id} onClick={() => setSelectedPlayer(p)}
                      className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-zinc-800/60 rounded hover:bg-amber-800/20 transition-colors">
                      <span className={`font-mono font-bold ${caClass(p.current_ability)}`}>{p.current_ability}</span>
                      <span className="text-zinc-600">/</span>
                      <span className={`font-mono ${growthClass(p.potential_ability, p.current_ability)}`}>{p.potential_ability}</span>
                      <span className="text-sky-400">{p.natural_position}</span>
                      <span className="text-zinc-300">{displayName(p)}</span>
                      <span className={`${ageColor(p.age)}`}>{p.age}y</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Ready for First Team */}
            {readyForFirstTeam.length > 0 && (
              <div className="bg-emerald-900/10 rounded-lg border border-emerald-800/30 p-2">
                <div className="text-[10px] font-semibold text-emerald-400 mb-1 flex items-center gap-1"><Zap size={10} /> Ready for First Team (CA ≥ 80)</div>
                <div className="flex flex-wrap gap-2">
                  {readyForFirstTeam.map(p => (
                    <button key={p.id} onClick={() => setSelectedPlayer(p)}
                      className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-zinc-800/60 rounded hover:bg-emerald-800/20 transition-colors">
                      <span className={`font-mono font-bold ${caClass(p.current_ability)}`}>{p.current_ability}</span>
                      <span className="text-sky-400">{p.natural_position}</span>
                      <span className="text-zinc-300">{displayName(p)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Development Gems */}
            {devGems.length > 0 && (
              <div className="bg-sky-900/10 rounded-lg border border-sky-800/30 p-2">
                <div className="text-[10px] font-semibold text-sky-400 mb-1 flex items-center gap-1"><TrendingUp size={10} /> Development Gems (DevScore ≥ 35, Gap ≥ 20)</div>
                <div className="flex flex-wrap gap-2">
                  {devGems.slice(0, 6).map(p => (
                    <button key={p.id} onClick={() => setSelectedPlayer(p)}
                      className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-zinc-800/60 rounded hover:bg-sky-800/20 transition-colors">
                      <span className="text-zinc-300">{displayName(p)}</span>
                      <span className="text-sky-400">Pro {p.hidden.professionalism} Det {p.mental.determination}</span>
                      <span className="text-zinc-500">DS {devScore(p)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => setShowProspects(false)} className="text-[9px] text-zinc-600 hover:text-zinc-400">Hide cards ▲</button>
          </div>
        )}
        {!showProspects && activeTeam === "all" && (
          <button onClick={() => setShowProspects(true)} className="px-5 py-1 text-[9px] text-zinc-600 hover:text-zinc-400 border-b border-zinc-800/40">Show prospect cards ▼</button>
        )}

        {/* ═══ Player table ═══ */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-zinc-900 z-10">
              <tr className="text-zinc-500 border-b border-zinc-800">
                <th className="px-2 py-1.5 text-left font-medium cursor-pointer hover:text-zinc-300" onClick={() => toggleSort("name")}>Name {sortIcon("name")}</th>
                <th className="px-1 py-1.5 text-left font-medium cursor-pointer hover:text-zinc-300 w-8" onClick={() => toggleSort("age")}>Age {sortIcon("age")}</th>
                <th className="px-1 py-1.5 text-left font-medium cursor-pointer hover:text-zinc-300 w-8" onClick={() => toggleSort("pos")}>Pos {sortIcon("pos")}</th>
                <th className="px-1 py-1.5 text-right font-medium cursor-pointer hover:text-zinc-300 w-8" onClick={() => toggleSort("ca")}>CA {sortIcon("ca")}</th>
                <th className="px-1 py-1.5 text-right font-medium cursor-pointer hover:text-zinc-300 w-8" onClick={() => toggleSort("pa")}>PA {sortIcon("pa")}</th>
                <th className="px-1 py-1.5 text-right font-medium cursor-pointer hover:text-zinc-300 w-8" onClick={() => toggleSort("gap")}>Gap {sortIcon("gap")}</th>
                <th className="px-1 py-1.5 text-center font-medium w-14">Slot</th>
                <th className="px-1 py-1.5 text-center font-medium w-14">Role</th>
                <th className="px-1 py-1.5 text-center font-medium w-8">Pro</th>
                <th className="px-1 py-1.5 text-center font-medium w-8">Det</th>
                <th className="px-1 py-1.5 text-center font-medium w-8">Amb</th>
                <th className="px-1 py-1.5 text-center font-medium w-8">Imp</th>
                <th className="px-1 py-1.5 text-center font-medium w-8">Tem</th>
                <th className="px-1 py-1.5 text-right font-medium cursor-pointer hover:text-zinc-300 w-8" onClick={() => toggleSort("dev")}>Dev {sortIcon("dev")}</th>
                <th className="px-1 py-1.5 text-left font-medium w-20">Growth</th>
                <th className="px-1 py-1.5 text-right font-medium cursor-pointer hover:text-zinc-300 w-12" onClick={() => toggleSort("value")}>Value {sortIcon("value")}</th>
                <th className="px-1 py-1.5 text-center font-medium w-10">Team</th>
                <th className="px-1 py-1.5 text-center font-medium w-6"></th>
              </tr>
            </thead>
            <tbody>
              {displayPlayers.map((p) => {
                const gap = p.potential_ability - p.current_ability;
                const ff = bestFormationFit(p);
                const roles = bestRoles(p, 1);
                const ds = devScore(p);
                const starred = shortlist.some(x => x.id === p.id);
                const teamLabel = effectiveTeams.find(t => new Set(t.player_ids).has(p.id))?.name ?? "?";
                const shortTeam = teamLabel.length > 6 ? teamLabel.replace(/ \/ /g, "/").slice(0, 6) : teamLabel;

                return (
                  <tr key={p.id}
                    className="border-b border-zinc-800/30 hover:bg-zinc-800/40 cursor-pointer transition-colors"
                    onClick={() => setSelectedPlayer(p)}>
                    <td className="px-2 py-1 text-zinc-200 truncate max-w-[180px]">{displayName(p)}</td>
                    <td className={`px-1 py-1 font-mono ${ageColor(p.age)}`}>{p.age}</td>
                    <td className="px-1 py-1 text-sky-400 font-mono">{p.natural_position}</td>
                    <td className={`px-1 py-1 text-right font-mono font-bold ${caClass(p.current_ability)}`}>{p.current_ability}</td>
                    <td className={`px-1 py-1 text-right font-mono font-bold ${growthClass(p.potential_ability, p.current_ability)}`}>{p.potential_ability}</td>
                    <td className={`px-1 py-1 text-right font-mono ${gap >= 40 ? "text-emerald-400" : gap >= 20 ? "text-sky-400" : "text-zinc-500"}`}>
                      {gap > 0 ? `+${gap}` : gap}
                    </td>
                    <td className="px-1 py-1 text-center text-[10px] text-zinc-400">{ff.slot}</td>
                    <td className="px-1 py-1 text-center text-[10px] text-zinc-400">{roles[0]?.role.short ?? "-"}</td>
                    <td className={`px-1 py-1 text-center font-mono ${devColor(p.hidden.professionalism)}`}>{p.hidden.professionalism || "-"}</td>
                    <td className={`px-1 py-1 text-center font-mono ${devColor(p.mental.determination)}`}>{p.mental.determination || "-"}</td>
                    <td className={`px-1 py-1 text-center font-mono ${devColor(p.hidden.ambition)}`}>{p.hidden.ambition || "-"}</td>
                    <td className={`px-1 py-1 text-center font-mono ${devColor(p.hidden.important_matches)}`}>{p.hidden.important_matches || "-"}</td>
                    <td className={`px-1 py-1 text-center font-mono ${devColor(p.hidden.temperament)}`}>{p.hidden.temperament || "-"}</td>
                    <td className={`px-1 py-1 text-right font-mono font-bold ${ds >= 35 ? "text-emerald-400" : ds >= 28 ? "text-sky-400" : "text-zinc-500"}`}>{ds}</td>
                    <td className="px-1 py-1 text-[9px] text-zinc-500">{growthProjection(p)}</td>
                    <td className="px-1 py-1 text-right text-zinc-400">{formatValue(Number(p.value))}</td>
                    <td className="px-1 py-1 text-center text-[9px] text-zinc-600">{shortTeam}</td>
                    <td className="px-1 py-1 text-center">
                      <button onClick={(e) => { e.stopPropagation(); toggleShortlist(p); }}
                        className={`text-[10px] ${starred ? "text-amber-400" : "text-zinc-700 hover:text-amber-400"}`}>★</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ Right panel ═══ */}
      <div className="w-72 border-l border-zinc-800/60 bg-zinc-950/50 flex flex-col overflow-hidden">
        {selectedPlayer ? (
          <PlayerDetail />
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="text-xs text-zinc-400">
              <p className="font-semibold text-amber-400 mb-2">📊 Youth Squad Summary</p>
              <div className="space-y-1">
                <p>Total: <span className="text-zinc-200 font-mono">{youthPlayers.length}</span> players</p>
                <p>Avg CA: <span className={`font-mono font-bold ${caClass(Math.round(youthPlayers.reduce((s, p) => s + p.current_ability, 0) / (youthPlayers.length || 1)))}`}>
                  {Math.round(youthPlayers.reduce((s, p) => s + p.current_ability, 0) / (youthPlayers.length || 1))}
                </span></p>
                <p>Avg Age: <span className="text-zinc-200 font-mono">{(youthPlayers.reduce((s, p) => s + p.age, 0) / (youthPlayers.length || 1)).toFixed(1)}</span></p>
                <p>Total Value: <span className="text-zinc-200">{formatValue(youthPlayers.reduce((s, p) => s + Number(p.value), 0))}</span></p>
              </div>
            </div>

            {effectiveTeams.map(t => (
              <div key={t.name} className="bg-zinc-900/60 rounded-lg border border-zinc-800/50 p-2.5 space-y-1">
                <p className="text-[10px] font-semibold text-amber-400">{t.name}</p>
                <p className="text-[10px] text-zinc-500">{t.player_count} players · Avg CA {Math.round(t.avg_ca)} · Avg Age {t.avg_age.toFixed(1)}</p>
              </div>
            ))}

            <div className="text-[10px] text-zinc-600 space-y-0.5">
              <p className="font-semibold text-zinc-500 mb-1">Dev Score Guide</p>
              <p><span className="text-emerald-400">≥35</span> = Elite development profile</p>
              <p><span className="text-sky-400">28-34</span> = Good development</p>
              <p><span className="text-zinc-400">&lt;28</span> = Average/slow growth</p>
              <p className="mt-1">Formula: Pro×2 + Det</p>
              <p className="mt-2 font-semibold text-zinc-500">Key Columns</p>
              <p><span className="text-zinc-300">Pro</span> = Professionalism (#1 dev factor)</p>
              <p><span className="text-zinc-300">Det</span> = Determination (#2 dev factor)</p>
              <p><span className="text-zinc-300">Amb</span> = Ambition (affects signing/leaving)</p>
              <p><span className="text-zinc-300">Imp</span> = Important Matches</p>
              <p><span className="text-zinc-300">Tem</span> = Temperament</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
