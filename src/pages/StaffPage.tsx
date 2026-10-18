import { useAppStore } from "@/stores/useAppStore";
import { useMemo, useState } from "react";
import type { StaffMember, CoachingAttrs } from "@/types/player";
import { hasCoachingData, facilityLabel } from "@/types/player";
import { Briefcase, Search, Building2 } from "lucide-react";

// ══════════════════════════════════════════════════════════════════════════════
// Staff Role Rating Formulas — from FM Pre-Game Editor weights (verified)
// Each role has attribute weights. Rating = weighted sum / max possible * 100
// Source: reddit.com/r/footballmanagergames HoYD weights, fmscout.com training
//         formulas, neoseeker FM22 guide, SI community manual
// ══════════════════════════════════════════════════════════════════════════════

type RoleDef = { label: string; short: string; weights: Record<string, number> };

const STAFF_ROLES: RoleDef[] = [
  {
    label: "Head Coach", short: "HC",
    weights: { attacking: 3, defending: 3, fitness: 2, tactical: 4, technical: 3,
      working_with_youngsters: 2, determination: 3, man_management: 4, motivating: 3,
      discipline: 2, judging_ability: 3, judging_potential: 2, goalkeeping: 1 },
  },
  {
    label: "Assistant Manager", short: "AM",
    weights: { attacking: 2, defending: 2, fitness: 2, tactical: 3, technical: 2,
      working_with_youngsters: 2, determination: 2, man_management: 4, motivating: 3,
      discipline: 3, judging_ability: 4, judging_potential: 4, goalkeeping: 1 },
  },
  {
    label: "Coach", short: "Co",
    weights: { attacking: 4, defending: 4, fitness: 3, tactical: 3, technical: 4,
      determination: 3, discipline: 2, motivating: 3, goalkeeping: 1,
      working_with_youngsters: 1, man_management: 1 },
  },
  {
    label: "GK Coach", short: "GK",
    weights: { goalkeeping: 8, determination: 2, discipline: 2, motivating: 2,
      attacking: 1, defending: 1, tactical: 1, technical: 1, fitness: 1 },
  },
  {
    label: "Fitness Coach", short: "Fit",
    weights: { fitness: 8, determination: 2, discipline: 2, motivating: 2,
      attacking: 1, defending: 1, tactical: 1, technical: 1, goalkeeping: 1 },
  },
  {
    label: "Scout", short: "Sc",
    weights: { judging_ability: 5, judging_potential: 5, determination: 2 },
  },
  {
    label: "Head of Youth Dev", short: "HoYD",
    weights: { working_with_youngsters: 4, judging_ability: 4, judging_potential: 4,
      attacking: 2, defending: 2, fitness: 1, tactical: 2, technical: 2,
      determination: 2, man_management: 2, motivating: 2, goalkeeping: 1 },
  },
  {
    label: "Director of Football", short: "DoF",
    weights: { judging_ability: 4, judging_potential: 4, man_management: 3,
      determination: 2, motivating: 2, discipline: 2, working_with_youngsters: 1 },
  },
  {
    label: "Physio", short: "Ph",
    weights: { determination: 1 },
  },
  {
    label: "Set Piece Coach", short: "SP",
    weights: { attacking: 3, tactical: 4, technical: 4, determination: 2,
      discipline: 2, motivating: 2, defending: 1, fitness: 1, goalkeeping: 1 },
  },
];

function computeRoleRating(c: CoachingAttrs, role: RoleDef): number {
  if (!hasCoachingData(c)) return 0;
  const attrMap: Record<string, number> = {
    attacking: c.attacking, defending: c.defending, fitness: c.fitness,
    goalkeeping: c.goalkeeping, mental: c.mental, tactical: c.tactical,
    technical: c.technical, working_with_youngsters: c.working_with_youngsters,
    determination: c.determination, discipline: c.discipline,
    man_management: c.man_management, motivating: c.motivating,
    judging_ability: c.judging_ability, judging_potential: c.judging_potential,
  };
  let weightedSum = 0;
  let maxPossible = 0;
  for (const [attr, weight] of Object.entries(role.weights)) {
    const val = attrMap[attr] ?? 0;
    weightedSum += val * weight;
    maxPossible += 20 * weight;
  }
  if (maxPossible === 0) return 0;
  return Math.round((weightedSum / maxPossible) * 1000) / 10;
}

function computeBestRole(c: CoachingAttrs): { role: RoleDef; rating: number } {
  let best = STAFF_ROLES[0];
  let bestR = 0;
  for (const r of STAFF_ROLES) {
    const v = computeRoleRating(c, r);
    if (v > bestR) { bestR = v; best = r; }
  }
  return { role: best, rating: bestR };
}

function ratingColor(r: number) {
  return r >= 80 ? "text-emerald-400" : r >= 65 ? "text-sky-400"
    : r >= 50 ? "text-amber-400" : r >= 35 ? "text-zinc-400" : "text-zinc-600";
}
function attrColor(v: number) {
  return v >= 16 ? "text-emerald-400" : v >= 12 ? "text-sky-400"
    : v >= 8 ? "text-zinc-300" : v >= 4 ? "text-amber-400" : "text-zinc-600";
}
function barColor(v: number) {
  return v >= 16 ? "bg-emerald-600" : v >= 12 ? "bg-sky-600"
    : v >= 8 ? "bg-amber-600" : v >= 4 ? "bg-red-600" : "bg-zinc-700";
}

type SortKey = "name" | "age" | "club" | "nation" | "att" | "def" | "fit" | "gk" |
  "men" | "tac" | "tec" | "wwy" | "det" | "mm" | "mot" | "jpa" | "jpp" | "best" | "hc" | "sc" | "hoyd";

export function StaffPage() {
  const { staff, clubFacilities, managerProfile, setCurrentPage } = useAppStore();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("best");
  const [sortAsc, setSortAsc] = useState(false);
  const [filterClub, setFilterClub] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [hideNoCoaching, setHideNoCoaching] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);

  const clubs = useMemo(() => {
    const s = new Set(staff.filter(s => s.team_name).map(s => s.team_name));
    return [...s].sort();
  }, [staff]);

  const staffWithRatings = useMemo(() =>
    staff.map(s => ({
      ...s,
      bestRole: computeBestRole(s.coaching),
      hc: computeRoleRating(s.coaching, STAFF_ROLES[0]),
      am: computeRoleRating(s.coaching, STAFF_ROLES[1]),
      sc: computeRoleRating(s.coaching, STAFF_ROLES[5]),
      hoyd: computeRoleRating(s.coaching, STAFF_ROLES[6]),
    })),
    [staff]
  );

  const displayStaff = useMemo(() => {
    let list = staffWithRatings;
    if (hideNoCoaching) list = list.filter(s => hasCoachingData(s.coaching));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.team_name.toLowerCase().includes(q) || s.nationality.toLowerCase().includes(q));
    }
    if (filterClub) list = list.filter(s => s.team_name === filterClub);
    if (filterRole) {
      const role = STAFF_ROLES.find(r => r.short === filterRole);
      if (role) list = list.filter(s => computeRoleRating(s.coaching, role) >= 50);
    }

    const dir = sortAsc ? 1 : -1;
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "name": return a.name.localeCompare(b.name) * dir;
        case "age": return (a.age - b.age) * dir;
        case "club": return a.team_name.localeCompare(b.team_name) * dir;
        case "nation": return a.nationality.localeCompare(b.nationality) * dir;
        case "att": return (a.coaching.attacking - b.coaching.attacking) * dir;
        case "def": return (a.coaching.defending - b.coaching.defending) * dir;
        case "fit": return (a.coaching.fitness - b.coaching.fitness) * dir;
        case "gk": return (a.coaching.goalkeeping - b.coaching.goalkeeping) * dir;
        case "men": return (a.coaching.mental - b.coaching.mental) * dir;
        case "tac": return (a.coaching.tactical - b.coaching.tactical) * dir;
        case "tec": return (a.coaching.technical - b.coaching.technical) * dir;
        case "wwy": return (a.coaching.working_with_youngsters - b.coaching.working_with_youngsters) * dir;
        case "det": return (a.coaching.determination - b.coaching.determination) * dir;
        case "mm": return (a.coaching.man_management - b.coaching.man_management) * dir;
        case "mot": return (a.coaching.motivating - b.coaching.motivating) * dir;
        case "jpa": return (a.coaching.judging_ability - b.coaching.judging_ability) * dir;
        case "jpp": return (a.coaching.judging_potential - b.coaching.judging_potential) * dir;
        case "best": return (a.bestRole.rating - b.bestRole.rating) * dir;
        case "hc": return (a.hc - b.hc) * dir;
        case "sc": return (a.sc - b.sc) * dir;
        case "hoyd": return (a.hoyd - b.hoyd) * dir;
        default: return 0;
      }
    });
    return sorted;
  }, [staffWithRatings, search, filterClub, filterRole, sortKey, sortAsc, hideNoCoaching]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };
  const si = (key: SortKey) => sortKey === key ? (sortAsc ? " \u2191" : " \u2193") : "";

  if (!managerProfile) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-zinc-500">
          <p className="text-lg mb-1">No staff data</p>
          <p className="text-sm">Connect to FM and load players first.</p>
          <button onClick={() => setCurrentPage("dashboard")}
            className="mt-4 px-4 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300">Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-zinc-800/60">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-amber-400 flex items-center gap-1.5">
              <Briefcase size={14} /> Staff Database
            </h1>
            <span className="text-xs text-zinc-500">{staff.length.toLocaleString()} staff loaded</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 px-5 py-2 border-b border-zinc-800/40 overflow-x-auto">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, club, nation..."
              className="text-[11px] bg-zinc-800 border border-zinc-700 rounded pl-6 pr-2 py-1 text-zinc-300 w-48" />
          </div>
          <select value={filterClub} onChange={e => setFilterClub(e.target.value)}
            className="text-[10px] bg-zinc-800 border border-zinc-700 rounded px-1.5 py-1 text-zinc-300">
            <option value="">All Clubs</option>
            {clubs.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
            className="text-[10px] bg-zinc-800 border border-zinc-700 rounded px-1.5 py-1 text-zinc-300">
            <option value="">All Roles</option>
            {STAFF_ROLES.map(r => <option key={r.short} value={r.short}>{r.label} (50%+)</option>)}
          </select>
          <button onClick={() => setHideNoCoaching(!hideNoCoaching)}
            className={`text-[10px] px-2 py-1 rounded border transition-colors ${hideNoCoaching ? "bg-amber-500/20 border-amber-500/50 text-amber-400" : "bg-zinc-800 border-zinc-700 text-zinc-500"}`}>
            {hideNoCoaching ? "Coaches Only" : "All Staff"}
          </button>
          <span className="text-[10px] text-zinc-600 ml-auto">{displayStaff.length} / {staff.length} shown</span>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-zinc-900 z-10">
              <tr className="text-zinc-500 border-b border-zinc-800">
                <th className="px-2 py-1.5 text-left font-medium cursor-pointer hover:text-zinc-300 min-w-[140px]" onClick={() => toggleSort("name")}>Name{si("name")}</th>
                <th className="px-1 py-1.5 text-left font-medium cursor-pointer hover:text-zinc-300 w-7" onClick={() => toggleSort("age")}>Age{si("age")}</th>
                <th className="px-1 py-1.5 text-left font-medium cursor-pointer hover:text-zinc-300 w-20" onClick={() => toggleSort("nation")}>Nation{si("nation")}</th>
                <th className="px-1 py-1.5 text-left font-medium cursor-pointer hover:text-zinc-300 min-w-[90px]" onClick={() => toggleSort("club")}>Club{si("club")}</th>
                <th className="px-1 py-1.5 text-center font-medium cursor-pointer hover:text-zinc-300 w-8" onClick={() => toggleSort("att")} title="Attacking">Att{si("att")}</th>
                <th className="px-1 py-1.5 text-center font-medium cursor-pointer hover:text-zinc-300 w-8" onClick={() => toggleSort("def")} title="Defending">Def{si("def")}</th>
                <th className="px-1 py-1.5 text-center font-medium cursor-pointer hover:text-zinc-300 w-8" onClick={() => toggleSort("fit")} title="Fitness">Fit{si("fit")}</th>
                <th className="px-1 py-1.5 text-center font-medium cursor-pointer hover:text-zinc-300 w-8" onClick={() => toggleSort("gk")} title="Goalkeeping">GK{si("gk")}</th>
                <th className="px-1 py-1.5 text-center font-medium cursor-pointer hover:text-zinc-300 w-8" onClick={() => toggleSort("tac")} title="Tactical">Tac{si("tac")}</th>
                <th className="px-1 py-1.5 text-center font-medium cursor-pointer hover:text-zinc-300 w-8" onClick={() => toggleSort("tec")} title="Technical">Tec{si("tec")}</th>
                <th className="px-1 py-1.5 text-center font-medium cursor-pointer hover:text-zinc-300 w-8" onClick={() => toggleSort("wwy")} title="Working with Youngsters">WwY{si("wwy")}</th>
                <th className="px-1 py-1.5 text-center font-medium cursor-pointer hover:text-zinc-300 w-8" onClick={() => toggleSort("det")} title="Determination">Det{si("det")}</th>
                <th className="px-1 py-1.5 text-center font-medium cursor-pointer hover:text-zinc-300 w-8" onClick={() => toggleSort("mm")} title="Man Management">MM{si("mm")}</th>
                <th className="px-1 py-1.5 text-center font-medium cursor-pointer hover:text-zinc-300 w-8" onClick={() => toggleSort("mot")} title="Motivating">Mot{si("mot")}</th>
                <th className="px-1 py-1.5 text-center font-medium cursor-pointer hover:text-zinc-300 w-8" onClick={() => toggleSort("jpa")} title="Judging Player Ability">JPA{si("jpa")}</th>
                <th className="px-1 py-1.5 text-center font-medium cursor-pointer hover:text-zinc-300 w-8" onClick={() => toggleSort("jpp")} title="Judging Player Potential">JPP{si("jpp")}</th>
                <th className="px-1 py-1.5 text-center font-medium cursor-pointer hover:text-zinc-300 w-14" onClick={() => toggleSort("best")} title="Best role fit %">Best{si("best")}</th>
                <th className="px-1 py-1.5 text-center font-medium cursor-pointer hover:text-zinc-300 w-10" onClick={() => toggleSort("hc")} title="Head Coach %">HC{si("hc")}</th>
                <th className="px-1 py-1.5 text-center font-medium cursor-pointer hover:text-zinc-300 w-10" onClick={() => toggleSort("sc")} title="Scout %">Sc{si("sc")}</th>
                <th className="px-1 py-1.5 text-center font-medium cursor-pointer hover:text-zinc-300 w-10" onClick={() => toggleSort("hoyd")} title="HoYD %">HoYD{si("hoyd")}</th>
              </tr>
            </thead>
            <tbody>
              {displayStaff.slice(0, 500).map((s, i) => {
                const c = s.coaching;
                const hd = hasCoachingData(c);
                return (
                  <tr key={`${s.name}-${i}`}
                    className="border-b border-zinc-800/30 hover:bg-zinc-800/40 cursor-pointer transition-colors"
                    onClick={() => setSelectedStaff(s)}>
                    <td className="px-2 py-1 text-zinc-200 truncate max-w-[170px]">{s.name}</td>
                    <td className="px-1 py-1 font-mono text-zinc-400">{s.age || "-"}</td>
                    <td className="px-1 py-1 text-zinc-500 truncate max-w-[80px]">{s.nationality}</td>
                    <td className="px-1 py-1 text-zinc-400 truncate max-w-[100px]">{s.team_name || "-"}</td>
                    {hd ? (<>
                      <td className={`px-1 py-1 text-center font-mono ${attrColor(c.attacking)}`}>{c.attacking}</td>
                      <td className={`px-1 py-1 text-center font-mono ${attrColor(c.defending)}`}>{c.defending}</td>
                      <td className={`px-1 py-1 text-center font-mono ${attrColor(c.fitness)}`}>{c.fitness}</td>
                      <td className={`px-1 py-1 text-center font-mono ${attrColor(c.goalkeeping)}`}>{c.goalkeeping}</td>
                      <td className={`px-1 py-1 text-center font-mono ${attrColor(c.tactical)}`}>{c.tactical}</td>
                      <td className={`px-1 py-1 text-center font-mono ${attrColor(c.technical)}`}>{c.technical}</td>
                      <td className={`px-1 py-1 text-center font-mono ${attrColor(c.working_with_youngsters)}`}>{c.working_with_youngsters}</td>
                      <td className={`px-1 py-1 text-center font-mono ${attrColor(c.determination)}`}>{c.determination || "-"}</td>
                      <td className={`px-1 py-1 text-center font-mono ${attrColor(c.man_management)}`}>{c.man_management || "-"}</td>
                      <td className={`px-1 py-1 text-center font-mono ${attrColor(c.motivating)}`}>{c.motivating || "-"}</td>
                      <td className={`px-1 py-1 text-center font-mono ${attrColor(c.judging_ability)}`}>{c.judging_ability || "-"}</td>
                      <td className={`px-1 py-1 text-center font-mono ${attrColor(c.judging_potential)}`}>{c.judging_potential || "-"}</td>
                      <td className="px-1 py-1 text-center">
                        <span className={`font-mono font-bold ${ratingColor(s.bestRole.rating)}`}>{s.bestRole.rating.toFixed(0)}%</span>
                        <span className="text-zinc-600 text-[9px] ml-0.5">{s.bestRole.role.short}</span>
                      </td>
                      <td className={`px-1 py-1 text-center font-mono text-[10px] ${ratingColor(s.hc)}`}>{s.hc.toFixed(0)}</td>
                      <td className={`px-1 py-1 text-center font-mono text-[10px] ${ratingColor(s.sc)}`}>{s.sc.toFixed(0)}</td>
                      <td className={`px-1 py-1 text-center font-mono text-[10px] ${ratingColor(s.hoyd)}`}>{s.hoyd.toFixed(0)}</td>
                    </>) : (
                      <td colSpan={16} className="px-1 py-1 text-center text-zinc-600 text-[10px]">Coaching data not available</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {displayStaff.length > 500 && (
            <p className="text-center text-[10px] text-zinc-600 py-2">Showing first 500 of {displayStaff.length}</p>
          )}
        </div>
      </div>

      {/* Right Panel — Staff Detail */}
      <div className="w-72 border-l border-zinc-800/60 bg-zinc-950/50 flex flex-col overflow-hidden">
        {selectedStaff ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-zinc-100">{selectedStaff.name}</p>
              <p className="text-[10px] text-zinc-500">{selectedStaff.age > 0 ? `${selectedStaff.age}y` : ""} {selectedStaff.nationality}</p>
              {selectedStaff.team_name && <p className="text-[10px] text-zinc-400">{selectedStaff.team_name}</p>}
            </div>

            {hasCoachingData(selectedStaff.coaching) && (<>
              {/* Coaching Attributes */}
              <div className="bg-zinc-900/60 rounded-lg border border-zinc-800/50 p-3 space-y-1.5">
                <p className="text-[10px] font-semibold text-amber-400">Coaching Attributes</p>
                {[
                  ["Attacking", selectedStaff.coaching.attacking],
                  ["Defending", selectedStaff.coaching.defending],
                  ["Fitness", selectedStaff.coaching.fitness],
                  ["Goalkeeping", selectedStaff.coaching.goalkeeping],
                  ["Mental", selectedStaff.coaching.mental],
                  ["Tactical", selectedStaff.coaching.tactical],
                  ["Technical", selectedStaff.coaching.technical],
                  ["WwY", selectedStaff.coaching.working_with_youngsters],
                ].map(([label, val]) => {
                  const v = val as number;
                  return (
                    <div key={label as string} className="flex items-center gap-1 text-[10px]">
                      <span className="text-zinc-500 w-16">{label as string}</span>
                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barColor(v)}`} style={{ width: `${(v / 20) * 100}%` }} />
                      </div>
                      <span className={`font-mono w-5 text-right ${attrColor(v)}`}>{v}</span>
                    </div>
                  );
                })}
              </div>

              {/* Mental + Knowledge */}
              <div className="bg-zinc-900/60 rounded-lg border border-zinc-800/50 p-3 space-y-1.5">
                <p className="text-[10px] font-semibold text-amber-400">Mental & Knowledge</p>
                {[
                  ["Determination", selectedStaff.coaching.determination],
                  ["Discipline", selectedStaff.coaching.discipline],
                  ["Man Mgmt", selectedStaff.coaching.man_management],
                  ["Motivating", selectedStaff.coaching.motivating],
                  ["JPA", selectedStaff.coaching.judging_ability],
                  ["JPP", selectedStaff.coaching.judging_potential],
                ].map(([label, val]) => {
                  const v = val as number;
                  if (!v) return null;
                  return (
                    <div key={label as string} className="flex items-center gap-1 text-[10px]">
                      <span className="text-zinc-500 w-16">{label as string}</span>
                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barColor(v)}`} style={{ width: `${(v / 20) * 100}%` }} />
                      </div>
                      <span className={`font-mono w-5 text-right ${attrColor(v)}`}>{v}</span>
                    </div>
                  );
                })}
              </div>

              {/* Role Ratings */}
              <div className="bg-zinc-900/60 rounded-lg border border-zinc-800/50 p-3 space-y-1.5">
                <p className="text-[10px] font-semibold text-amber-400">Role Ratings</p>
                {STAFF_ROLES.map(role => {
                  const r = computeRoleRating(selectedStaff.coaching, role);
                  return (
                    <div key={role.short} className="flex items-center gap-1 text-[10px]">
                      <span className="text-zinc-500 w-24 truncate">{role.label}</span>
                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${r >= 65 ? "bg-emerald-600" : r >= 50 ? "bg-sky-600" : r >= 35 ? "bg-amber-600" : "bg-zinc-700"}`}
                          style={{ width: `${r}%` }} />
                      </div>
                      <span className={`font-mono w-10 text-right ${ratingColor(r)}`}>{r.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </>)}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="text-[10px] text-zinc-600 space-y-1">
              <p className="font-semibold text-zinc-500">Staff Database</p>
              <p>Click a staff member to see their full profile and role ratings.</p>
              <p className="mt-2">Role ratings are calculated from FM Pre-Game Editor weights:</p>
              <p><span className="text-amber-400">4.0</span> = Critical attrs for the role</p>
              <p><span className="text-sky-400">3.0</span> = Important attrs</p>
              <p><span className="text-zinc-300">2.0</span> = Useful attrs</p>
              <p><span className="text-zinc-500">1.0</span> = Minor contribution</p>
            </div>

            {/* Club Facilities */}
            {clubFacilities && (
              <div className="bg-zinc-900/60 rounded-lg border border-zinc-800/50 p-3 space-y-1.5">
                <p className="text-[10px] font-semibold text-amber-400 flex items-center gap-1">
                  <Building2 size={10} /> Club Facilities
                </p>
                {[
                  ["Training", clubFacilities.training],
                  ["Youth Fac", clubFacilities.youth_facilities],
                  ["Jr Coaching", clubFacilities.junior_coaching],
                  ["Youth Rec", clubFacilities.youth_recruitment],
                  ["Corporate", clubFacilities.corporate],
                  ["Youth Imp", clubFacilities.youth_importance],
                ].map(([label, val]) => {
                  const v = val as number;
                  return (
                    <div key={label as string} className="flex items-center gap-1 text-[10px]">
                      <span className="text-zinc-500 w-16">{label as string}</span>
                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barColor(v)}`} style={{ width: `${(v / 20) * 100}%` }} />
                      </div>
                      <span className={`font-mono w-5 text-right ${attrColor(v)}`}>{v || "?"}</span>
                      <span className="text-zinc-600 text-[9px] w-14 text-right">{v ? facilityLabel(v) : ""}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
