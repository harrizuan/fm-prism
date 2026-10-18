import { useAppStore } from "@/stores/useAppStore";
import { useMemo, useState } from "react";
import {
  displayName, formatValue, formatWage, bestRoles, bestFormationFit,
  playerAthletics, playerHiddenMentals,
  estimateCAPerYear, projectCAAtAge, mentoringUrgency, trainingPlan, developmentAction,
} from "@/types/player";
import { generateAIDatabase } from "@/utils/aiBrief";
import type { Player, YouthTeam, MentoringAlert, DevelopmentAdvice } from "@/types/player";
import { Download, TrendingUp, Zap, Trophy, AlertTriangle, ArrowUpRight, Shield, GraduationCap } from "lucide-react";
import { PlayerDetail } from "@/components/player/PlayerDetail";

function caClass(ca: number) {
  return ca >= 140 ? "text-yellow-300" : ca >= 120 ? "text-emerald-400" : ca >= 100 ? "text-sky-400"
    : ca >= 80 ? "text-zinc-200" : ca >= 60 ? "text-zinc-400" : "text-zinc-600";
}
function gapClass(gap: number) {
  return gap >= 40 ? "text-emerald-400" : gap >= 20 ? "text-sky-400" : gap >= 10 ? "text-zinc-300" : "text-zinc-500";
}
function ageColor(age: number) {
  return age <= 16 ? "text-emerald-400" : age <= 18 ? "text-sky-400" : age <= 20 ? "text-zinc-300" : "text-zinc-500";
}
function devColor(v: number) {
  return v >= 16 ? "text-emerald-400" : v >= 12 ? "text-sky-400" : v >= 8 ? "text-zinc-300" : "text-red-400";
}
function cayrColor(rate: number) {
  return rate >= 10 ? "text-emerald-400" : rate >= 7 ? "text-sky-400" : rate >= 4 ? "text-amber-400" : rate >= 1 ? "text-zinc-400" : "text-zinc-600";
}
function actionColor(a: DevelopmentAdvice) {
  switch (a.action) {
    case "PROTECT": return "text-amber-400";
    case "PROMOTE": return "text-emerald-400";
    case "MENTOR":  return "text-red-400";
    case "LOAN":    return "text-sky-400";
    case "SELL":    return "text-yellow-300";
    case "RELEASE": return "text-zinc-600";
    default:        return "text-zinc-400";
  }
}
function gradeColor(grade: string) {
  return grade === "A" ? "text-emerald-400" : grade === "B" ? "text-sky-400"
    : grade === "C" ? "text-amber-400" : "text-red-400";
}

type SortKey = "ca" | "pa" | "gap" | "age" | "cayr" | "name" | "pos" | "value" | "pro" | "action";

export function YouthPage() {
  const { players, squadIds, managerProfile, youthTeams, setCurrentPage, toggleShortlist, shortlist, setSelectedPlayer, selectedPlayer } = useAppStore();
  const [activeTeam, setActiveTeam] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("pa");
  const [sortAsc, setSortAsc] = useState(false);
  const [exportMsg, setExportMsg] = useState("");
  const [filterPos, setFilterPos] = useState("");
  const [showProspects, setShowProspects] = useState(true);

  const clubName = managerProfile?.club_name ?? "";
  const squadAvgCA = managerProfile?.squad_avg_ca ?? 80;

  const allYouthIds = useMemo(() => {
    const s = new Set<number>();
    for (const t of youthTeams) for (const id of t.player_ids) s.add(id);
    return s;
  }, [youthTeams]);

  const youthPlayers = useMemo(() => {
    if (!clubName) return [];
    const clubLower = clubName.toLowerCase();
    if (allYouthIds.size > 0) return players.filter(p => allYouthIds.has(p.id));
    return players.filter(p => p.club_name?.toLowerCase() === clubLower && !squadIds.has(p.id));
  }, [players, squadIds, clubName, allYouthIds]);

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

  // Pre-compute growth data for all youth players
  const playerData = useMemo(() => {
    const map = new Map<number, { cayr: number; ca3: number; action: DevelopmentAdvice; mentor: MentoringAlert }>();
    for (const p of youthPlayers) {
      map.set(p.id, {
        cayr: estimateCAPerYear(p),
        ca3: projectCAAtAge(p, p.age + 3),
        action: developmentAction(p, squadAvgCA),
        mentor: mentoringUrgency(p),
      });
    }
    return map;
  }, [youthPlayers, squadAvgCA]);

  const displayPlayers = useMemo(() => {
    let list = activeTeam === "all"
      ? youthPlayers
      : youthPlayers.filter(p => effectiveIdSets[activeTeam]?.has(p.id));
    if (filterPos) list = list.filter(p => p.natural_position === filterPos);

    const sorted = [...list];
    const dir = sortAsc ? 1 : -1;
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "ca":   return (a.current_ability - b.current_ability) * dir;
        case "pa":   return (a.potential_ability - b.potential_ability) * dir;
        case "gap":  return ((a.potential_ability - a.current_ability) - (b.potential_ability - b.current_ability)) * dir;
        case "age":  return (a.age - b.age) * dir;
        case "cayr": return ((playerData.get(a.id)?.cayr ?? 0) - (playerData.get(b.id)?.cayr ?? 0)) * dir;
        case "name": return displayName(a).localeCompare(displayName(b)) * dir;
        case "pos":  return a.natural_position.localeCompare(b.natural_position) * dir;
        case "value":return (Number(a.value) - Number(b.value)) * dir;
        case "pro":  return ((a.hidden.professionalism ?? 0) - (b.hidden.professionalism ?? 0)) * dir;
        case "action": {
          const order: Record<string, number> = { MENTOR: 0, PROTECT: 1, PROMOTE: 2, LOAN: 3, DEVELOP: 4, SELL: 5, RELEASE: 6 };
          return ((order[playerData.get(a.id)?.action.action ?? "DEVELOP"] ?? 4) - (order[playerData.get(b.id)?.action.action ?? "DEVELOP"] ?? 4)) * dir;
        }
        default: return 0;
      }
    });
    return sorted;
  }, [youthPlayers, activeTeam, filterPos, sortKey, sortAsc, effectiveIdSets, playerData]);

  // ═══ Prospect card categories ═══
  const mentorUrgent = useMemo(() =>
    youthPlayers.filter(p => {
      const m = playerData.get(p.id)?.mentor;
      return m && (m.level === "critical" || m.level === "high") && p.potential_ability >= 100;
    }).sort((a, b) => b.potential_ability - a.potential_ability),
    [youthPlayers, playerData]);

  const eliteProspects = useMemo(() =>
    youthPlayers.filter(p => {
      const a = playerData.get(p.id)?.action;
      return a?.action === "PROTECT" || (p.potential_ability >= 120 && (p.hidden.professionalism ?? 0) >= 12);
    }).sort((a, b) => b.potential_ability - a.potential_ability),
    [youthPlayers, playerData]);

  const promoteReady = useMemo(() =>
    youthPlayers.filter(p => playerData.get(p.id)?.action.action === "PROMOTE")
      .sort((a, b) => b.current_ability - a.current_ability),
    [youthPlayers, playerData]);

  const loanCandidates = useMemo(() =>
    youthPlayers.filter(p => playerData.get(p.id)?.action.action === "LOAN")
      .sort((a, b) => b.potential_ability - a.potential_ability),
    [youthPlayers, playerData]);

  // ═══ System health ═══
  const systemHealth = useMemo(() => {
    if (youthPlayers.length === 0) return null;
    const avgPro = youthPlayers.reduce((s, p) => s + (p.hidden.professionalism ?? 10), 0) / youthPlayers.length;
    const avgDet = youthPlayers.reduce((s, p) => s + (p.mental.determination ?? 10), 0) / youthPlayers.length;
    const avgCAYr = youthPlayers.reduce((s, p) => s + (playerData.get(p.id)?.cayr ?? 0), 0) / youthPlayers.length;
    const needMentor = youthPlayers.filter(p => playerData.get(p.id)?.mentor.level !== "none").length;
    const pctNeedMentor = needMentor / youthPlayers.length;
    const stars = youthPlayers.filter(p => p.potential_ability >= 120).length;
    const sizeBad = effectiveTeams.filter(t => t.player_count < 12 || t.player_count > 22).length;

    let score = 0;
    score += Math.min(25, avgPro * 1.5);
    score += Math.min(12, avgDet * 0.75);
    score += (1 - pctNeedMentor) * 20;
    score += sizeBad === 0 ? 15 : sizeBad === 1 ? 10 : 5;
    score += Math.min(15, stars * 5);
    score += Math.min(13, avgCAYr * 1.5);
    const grade = score >= 75 ? "A" : score >= 60 ? "B" : score >= 45 ? "C" : score >= 30 ? "D" : "F";
    return { avgPro, avgDet, avgCAYr, needMentor, pctNeedMentor, stars, sizeBad, score, grade };
  }, [youthPlayers, playerData, effectiveTeams]);

  // ═══ Best mentors from first team ═══
  const mentors = useMemo(() =>
    players
      .filter(p => squadIds.has(p.id) && (p.hidden.professionalism ?? 0) >= 12 && p.age >= 24)
      .sort((a, b) => {
        const sa = (a.hidden.professionalism ?? 0) * 3 + (a.mental.determination ?? 0) + (a.hidden.ambition ?? 0);
        const sb = (b.hidden.professionalism ?? 0) * 3 + (b.mental.determination ?? 0) + (b.hidden.ambition ?? 0);
        return sb - sa;
      })
      .slice(0, 5),
    [players, squadIds]);

  const positions = useMemo(() => {
    const s = new Set(youthPlayers.map(p => p.natural_position));
    return [...s].sort();
  }, [youthPlayers]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };
  const si = (key: SortKey) => sortKey === key ? (sortAsc ? " \u2191" : " \u2193") : "";

  const handleExport = async () => {
    try {
      await generateAIDatabase(players, managerProfile!, squadIds, shortlist);
      setExportMsg("\u2713 Exported");
      setTimeout(() => setExportMsg(""), 3000);
    } catch (e) { setExportMsg(`\u2717 ${e}`); }
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
            <h1 className="text-sm font-semibold text-amber-400 flex items-center gap-1.5">
              <GraduationCap size={14} /> {clubName} Youth Academy
            </h1>
            <span className="text-xs text-zinc-500">{youthPlayers.length} players · {effectiveTeams.length} team{effectiveTeams.length !== 1 ? "s" : ""}</span>
            {systemHealth && (
              <span className={`text-xs font-bold ${gradeColor(systemHealth.grade)}`} title={`System Score: ${Math.round(systemHealth.score)}/100`}>
                Grade {systemHealth.grade}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5 text-xs text-zinc-500">
            <button onClick={handleExport}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800/70 hover:bg-emerald-900/40 border border-zinc-700/40 hover:border-emerald-600/40 transition-colors text-zinc-400 hover:text-emerald-300"
              title="Export all data including youth for AI analysis">
              <Download size={11} /><span className="text-[10px]">AI Brief</span>
            </button>
            {exportMsg && <span className={`text-[10px] ${exportMsg.startsWith("\u2713") ? "text-emerald-400" : "text-red-400"}`}>{exportMsg}</span>}
          </div>
        </div>

        {/* Team tabs + filter */}
        <div className="flex items-center gap-1 px-5 py-2 border-b border-zinc-800/40 overflow-x-auto">
          <button onClick={() => setActiveTeam("all")}
            className={`px-2.5 py-1 text-xs rounded transition-colors flex items-center gap-1.5 ${
              activeTeam === "all" ? "bg-amber-600 text-white font-semibold" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60"
            }`}>All ({youthPlayers.length})</button>
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
            <option value="">All Pos</option>
            {positions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* ═══ Prospect cards ═══ */}
        {showProspects && activeTeam === "all" && (
          <div className="px-5 py-2 space-y-2 border-b border-zinc-800/40">
            {/* MENTOR NOW */}
            {mentorUrgent.length > 0 && (
              <div className="bg-red-900/10 rounded-lg border border-red-800/30 p-2">
                <div className="text-[10px] font-semibold text-red-400 mb-1 flex items-center gap-1">
                  <AlertTriangle size={10} /> Needs Mentoring — High PA at risk ({mentorUrgent.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {mentorUrgent.slice(0, 6).map(p => {
                    const m = playerData.get(p.id)?.mentor;
                    return (
                      <button key={p.id} onClick={() => setSelectedPlayer(p)}
                        className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-zinc-800/60 rounded hover:bg-red-800/20 transition-colors">
                        <span className="text-red-400">{m?.emoji}</span>
                        <span className="text-zinc-300">{displayName(p)}</span>
                        <span className="text-sky-400">PA {p.potential_ability}</span>
                        <span className="text-red-400/80">{m?.needs.join(", ")}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ELITE PROSPECTS */}
            {eliteProspects.length > 0 && (
              <div className="bg-amber-900/10 rounded-lg border border-amber-800/30 p-2">
                <div className="text-[10px] font-semibold text-amber-400 mb-1 flex items-center gap-1">
                  <Trophy size={10} /> Elite Prospects — PA {"\u2265"} 120 + Good Personality ({eliteProspects.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {eliteProspects.slice(0, 6).map(p => (
                    <button key={p.id} onClick={() => setSelectedPlayer(p)}
                      className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-zinc-800/60 rounded hover:bg-amber-800/20 transition-colors">
                      <span className={`font-mono font-bold ${caClass(p.current_ability)}`}>{p.current_ability}</span>
                      <span className="text-zinc-600">/</span>
                      <span className={`font-mono ${gapClass(p.potential_ability - p.current_ability)}`}>{p.potential_ability}</span>
                      <span className="text-sky-400">{p.natural_position}</span>
                      <span className="text-zinc-300">{displayName(p)}</span>
                      <span className="text-emerald-400/80">{(playerData.get(p.id)?.cayr ?? 0).toFixed(1)}/yr</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* PROMOTE NOW */}
            {promoteReady.length > 0 && (
              <div className="bg-emerald-900/10 rounded-lg border border-emerald-800/30 p-2">
                <div className="text-[10px] font-semibold text-emerald-400 mb-1 flex items-center gap-1">
                  <Zap size={10} /> Ready to Promote — CA near first-team level ({promoteReady.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {promoteReady.map(p => (
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

            {/* LOAN CANDIDATES */}
            {loanCandidates.length > 0 && (
              <div className="bg-sky-900/10 rounded-lg border border-sky-800/30 p-2">
                <div className="text-[10px] font-semibold text-sky-400 mb-1 flex items-center gap-1">
                  <ArrowUpRight size={10} /> Loan Candidates — Need competitive minutes ({loanCandidates.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {loanCandidates.slice(0, 6).map(p => (
                    <button key={p.id} onClick={() => setSelectedPlayer(p)}
                      className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-zinc-800/60 rounded hover:bg-sky-800/20 transition-colors">
                      <span className="text-zinc-300">{displayName(p)}</span>
                      <span className="text-sky-400/80">CA {p.current_ability} PA {p.potential_ability}</span>
                      <span className={`${ageColor(p.age)}`}>{p.age}y</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => setShowProspects(false)} className="text-[9px] text-zinc-600 hover:text-zinc-400">
              Hide cards {"\u25B2"}
            </button>
          </div>
        )}
        {!showProspects && activeTeam === "all" && (
          <button onClick={() => setShowProspects(true)} className="px-5 py-1 text-[9px] text-zinc-600 hover:text-zinc-400 border-b border-zinc-800/40">
            Show prospect cards {"\u25BC"}
          </button>
        )}

        {/* ═══ Player table ═══ */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-zinc-900 z-10">
              <tr className="text-zinc-500 border-b border-zinc-800">
                <th className="px-2 py-1.5 text-left font-medium cursor-pointer hover:text-zinc-300" onClick={() => toggleSort("name")}>Name{si("name")}</th>
                <th className="px-1 py-1.5 text-left font-medium cursor-pointer hover:text-zinc-300 w-8" onClick={() => toggleSort("age")}>Age{si("age")}</th>
                <th className="px-1 py-1.5 text-left font-medium cursor-pointer hover:text-zinc-300 w-8" onClick={() => toggleSort("pos")}>Pos{si("pos")}</th>
                <th className="px-1 py-1.5 text-right font-medium cursor-pointer hover:text-zinc-300 w-8" onClick={() => toggleSort("ca")}>CA{si("ca")}</th>
                <th className="px-1 py-1.5 text-right font-medium cursor-pointer hover:text-zinc-300 w-8" onClick={() => toggleSort("pa")}>PA{si("pa")}</th>
                <th className="px-1 py-1.5 text-right font-medium cursor-pointer hover:text-zinc-300 w-8" onClick={() => toggleSort("gap")}>Gap{si("gap")}</th>
                <th className="px-1 py-1.5 text-right font-medium cursor-pointer hover:text-zinc-300 w-10" onClick={() => toggleSort("cayr")} title="Estimated CA gain per year (with matches)">CA/yr{si("cayr")}</th>
                <th className="px-1 py-1.5 text-right font-medium w-9" title="Projected CA in 3 years">+3yr</th>
                <th className="px-1 py-1.5 text-center font-medium cursor-pointer hover:text-zinc-300 w-14" onClick={() => toggleSort("action")} title="Recommended development action">Action{si("action")}</th>
                <th className="px-1 py-1.5 text-center font-medium cursor-pointer hover:text-zinc-300 w-8" onClick={() => toggleSort("pro")}>Pro{si("pro")}</th>
                <th className="px-1 py-1.5 text-center font-medium w-8">Det</th>
                <th className="px-1 py-1.5 text-center font-medium w-8">Amb</th>
                <th className="px-1 py-1.5 text-center font-medium w-14">Role</th>
                <th className="px-1 py-1.5 text-right font-medium cursor-pointer hover:text-zinc-300 w-12" onClick={() => toggleSort("value")}>Value{si("value")}</th>
                <th className="px-1 py-1.5 text-center font-medium w-10">Team</th>
                <th className="px-1 py-1.5 text-center font-medium w-6"></th>
              </tr>
            </thead>
            <tbody>
              {displayPlayers.map((p) => {
                const gap = p.potential_ability - p.current_ability;
                const d = playerData.get(p.id);
                const cayr = d?.cayr ?? 0;
                const ca3 = d?.ca3 ?? p.current_ability;
                const act = d?.action ?? { action: "DEVELOP", emoji: "\uD83D\uDCC8", label: "Develop", reason: "" };
                const mnt = d?.mentor;
                const roles = bestRoles(p, 1);
                const starred = shortlist.some(x => x.id === p.id);
                const teamLabel = effectiveTeams.find(t => new Set(t.player_ids).has(p.id))?.name ?? "?";
                const shortTeam = teamLabel.length > 6 ? teamLabel.replace(/ \/ /g, "/").slice(0, 6) : teamLabel;

                return (
                  <tr key={p.id}
                    className={`border-b border-zinc-800/30 hover:bg-zinc-800/40 cursor-pointer transition-colors ${
                      mnt?.level === "critical" ? "bg-red-950/20" : ""
                    }`}
                    onClick={() => setSelectedPlayer(p)}>
                    <td className="px-2 py-1 text-zinc-200 truncate max-w-[170px]">
                      {mnt && mnt.level !== "none" && <span className="mr-1" title={`${mnt.reason}: ${mnt.needs.join(", ")}`}>{mnt.emoji}</span>}
                      {displayName(p)}
                    </td>
                    <td className={`px-1 py-1 font-mono ${ageColor(p.age)}`}>{p.age}</td>
                    <td className="px-1 py-1 text-sky-400 font-mono">{p.natural_position}</td>
                    <td className={`px-1 py-1 text-right font-mono font-bold ${caClass(p.current_ability)}`}>{p.current_ability}</td>
                    <td className={`px-1 py-1 text-right font-mono font-bold ${gapClass(gap)}`}>{p.potential_ability}</td>
                    <td className={`px-1 py-1 text-right font-mono ${gapClass(gap)}`}>{gap > 0 ? `+${gap}` : gap}</td>
                    <td className={`px-1 py-1 text-right font-mono font-bold ${cayrColor(cayr)}`} title="CA/year with regular matches">
                      {cayr > 0 ? cayr.toFixed(1) : "-"}
                    </td>
                    <td className={`px-1 py-1 text-right font-mono ${caClass(ca3)}`} title={`Projected CA at age ${p.age + 3}`}>
                      {ca3 > p.current_ability ? ca3 : "-"}
                    </td>
                    <td className={`px-1 py-1 text-center text-[10px] font-semibold ${actionColor(act)}`} title={act.reason}>
                      {act.emoji} {act.label}
                    </td>
                    <td className={`px-1 py-1 text-center font-mono ${devColor(p.hidden.professionalism)}`}>{p.hidden.professionalism || "-"}</td>
                    <td className={`px-1 py-1 text-center font-mono ${devColor(p.mental.determination)}`}>{p.mental.determination || "-"}</td>
                    <td className={`px-1 py-1 text-center font-mono ${devColor(p.hidden.ambition)}`}>{p.hidden.ambition || "-"}</td>
                    <td className="px-1 py-1 text-center text-[10px] text-zinc-400">{roles[0]?.role.short ?? "-"}</td>
                    <td className="px-1 py-1 text-right text-zinc-400">{formatValue(Number(p.value))}</td>
                    <td className="px-1 py-1 text-center text-[9px] text-zinc-600">{shortTeam}</td>
                    <td className="px-1 py-1 text-center">
                      <button onClick={(e) => { e.stopPropagation(); toggleShortlist(p); }}
                        className={`text-[10px] ${starred ? "text-amber-400" : "text-zinc-700 hover:text-amber-400"}`}>{"\u2605"}</button>
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
          <div className="flex-1 flex flex-col overflow-hidden">
            <PlayerDetail />
            {/* Training plan card below player detail */}
            {(() => {
              const tp = trainingPlan(selectedPlayer);
              const d = playerData.get(selectedPlayer.id);
              const cayr = d?.cayr ?? 0;
              return (
                <div className="border-t border-zinc-800/60 p-3 space-y-2 shrink-0">
                  <p className="text-[10px] font-semibold text-amber-400">Training Plan</p>
                  <div className="text-[10px] space-y-1">
                    <p><span className="text-zinc-500">Phase:</span> <span className="text-zinc-200">{tp.phase}</span></p>
                    <p><span className="text-zinc-500">Focus:</span> <span className="text-zinc-200">{tp.focus}</span></p>
                    <p><span className="text-zinc-500">Individual:</span> <span className="text-zinc-200">{tp.individual}</span></p>
                    <p className="text-zinc-500 italic">{tp.notes}</p>
                  </div>
                  <div className="text-[10px] space-y-0.5 mt-1 pt-1 border-t border-zinc-800/40">
                    <p><span className="text-zinc-500">Growth:</span> <span className={`font-mono font-bold ${cayrColor(cayr)}`}>{cayr.toFixed(1)} CA/yr</span></p>
                    <p><span className="text-zinc-500">In 3 years:</span> <span className={`font-mono font-bold ${caClass(d?.ca3 ?? 0)}`}>{d?.ca3}</span></p>
                    {d?.mentor.level !== "none" && (
                      <p className="text-red-400">{d?.mentor.emoji} {d?.mentor.reason}: {d?.mentor.needs.join(", ")}</p>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {/* System Health */}
            {systemHealth && (
              <div className="bg-zinc-900/60 rounded-lg border border-zinc-800/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-amber-400 flex items-center gap-1">
                    <Shield size={10} /> Youth System Health
                  </p>
                  <span className={`text-lg font-black ${gradeColor(systemHealth.grade)}`}>{systemHealth.grade}</span>
                </div>
                <div className="text-[10px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Avg Pro</span>
                    <span className={`font-mono ${devColor(Math.round(systemHealth.avgPro))}`}>{systemHealth.avgPro.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Avg Det</span>
                    <span className={`font-mono ${devColor(Math.round(systemHealth.avgDet))}`}>{systemHealth.avgDet.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Avg Growth</span>
                    <span className={`font-mono ${cayrColor(systemHealth.avgCAYr)}`}>{systemHealth.avgCAYr.toFixed(1)} CA/yr</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Need Mentoring</span>
                    <span className={systemHealth.needMentor > 0 ? "text-red-400 font-mono" : "text-emerald-400 font-mono"}>
                      {systemHealth.needMentor}/{youthPlayers.length} ({Math.round(systemHealth.pctNeedMentor * 100)}%)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Star Prospects</span>
                    <span className="text-amber-400 font-mono">{systemHealth.stars}</span>
                  </div>
                </div>
                {effectiveTeams.map(t => {
                  const sizeOk = t.player_count >= 12 && t.player_count <= 22;
                  return (
                    <div key={t.name} className="flex justify-between text-[10px]">
                      <span className="text-zinc-500">{t.name}</span>
                      <span className={sizeOk ? "text-zinc-400" : "text-red-400"}>
                        {t.player_count} players {!sizeOk && (t.player_count < 12 ? "(too few!)" : "(too many!)")}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Best Mentors */}
            {mentors.length > 0 && (
              <div className="bg-zinc-900/60 rounded-lg border border-zinc-800/50 p-3 space-y-2">
                <p className="text-[10px] font-semibold text-amber-400">Best Mentors (First Team)</p>
                <p className="text-[9px] text-zinc-600 italic">Pair with low-Pro youth in same social group</p>
                {mentors.map(m => (
                  <div key={m.id} className="flex items-center gap-2 text-[10px]">
                    <span className="text-zinc-300">{displayName(m)}</span>
                    <span className="text-zinc-600">{m.age}y</span>
                    <span className={`font-mono ${devColor(m.hidden.professionalism)}`}>Pro {m.hidden.professionalism}</span>
                    <span className={`font-mono ${devColor(m.mental.determination)}`}>Det {m.mental.determination}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Training Phase Guide */}
            <div className="bg-zinc-900/60 rounded-lg border border-zinc-800/50 p-3 space-y-2">
              <p className="text-[10px] font-semibold text-amber-400">Training Phase Guide</p>
              <div className="text-[10px] space-y-1.5">
                <div>
                  <p className="text-emerald-400 font-semibold">15-17: Foundation</p>
                  <p className="text-zinc-500">Physical focus. Quickness (Acc/Pac). General position.</p>
                </div>
                <div>
                  <p className="text-sky-400 font-semibold">18-20: Specialization</p>
                  <p className="text-zinc-500">Technical + specific role/duty. Push for starts.</p>
                </div>
                <div>
                  <p className="text-zinc-300 font-semibold">21+: Integration</p>
                  <p className="text-zinc-500">Mental + traits. First-team integration. Matches critical.</p>
                </div>
              </div>
            </div>

            {/* Research facts */}
            <div className="text-[10px] text-zinc-600 space-y-0.5">
              <p className="font-semibold text-zinc-500 mb-1">Growth Engine Facts</p>
              <p><span className="text-zinc-300">CA/yr</span> = estimated CA gain per year (FM-Arena data)</p>
              <p><span className="text-zinc-300">+3yr</span> = projected CA in 3 years</p>
              <p><span className="text-zinc-300">Pro</span> = #1 growth driver (2x Det/Amb)</p>
              <p><span className="text-zinc-300">Det/Amb</span> = diminishing returns above 10</p>
              <p className="mt-1 text-zinc-500 italic">Matches create CA. Training distributes it.</p>
              <p className="text-zinc-500 italic">Without matches: only ~25% of growth rate.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
