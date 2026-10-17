import { useAppStore } from "@/stores/useAppStore";
import { displayName, attrColor, formatValue, formatWage, caColor, paColor, ageColor, bestFormationFit, fitColorClass, calculateFeasibility, feasibilityScoreColor } from "@/types/player";
import { Star, Trash2, X, GitCompare } from "lucide-react";

export function ShortlistsPage() {
  const { shortlist, toggleShortlist, clearShortlist, addToCompare, setSelectedPlayer, setCurrentPage, managerProfile, squadIds } = useAppStore();

  const getFeas = (p: any) => {
    if (!managerProfile || squadIds.has(p.id)) return -1;
    return calculateFeasibility(p, managerProfile.club_reputation, managerProfile.squad_highest_wage, managerProfile.squad_total_value, managerProfile.game_year).score;
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-zinc-100">Shortlist</h1>
          <span className="text-sm text-zinc-500">({shortlist.length} players)</span>
        </div>
        {shortlist.length > 0 && (
          <button onClick={clearShortlist} className="px-3 py-1.5 bg-zinc-800 text-zinc-400 hover:text-red-400 rounded-lg text-sm flex items-center gap-1.5 border border-zinc-700">
            <Trash2 size={14} /> Clear All
          </button>
        )}
      </div>

      {shortlist.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <Star size={40} className="mx-auto mb-3 text-zinc-700" />
          <p className="text-zinc-400 text-sm">No players shortlisted yet</p>
          <p className="text-zinc-600 text-xs mt-1">Click the ★ icon on any player in the grid to add them here</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700 bg-zinc-900/80">
                <th className="px-3 py-2 text-left text-xs text-zinc-400 w-8" />
                <th className="px-3 py-2 text-left text-xs text-zinc-400">Name</th>
                <th className="px-3 py-2 text-center text-xs text-zinc-400">Age</th>
                <th className="px-3 py-2 text-center text-xs text-zinc-400">Pos</th>
                <th className="px-3 py-2 text-left text-xs text-zinc-400">Club</th>
                <th className="px-3 py-2 text-center text-xs text-fm-accent">CA</th>
                <th className="px-3 py-2 text-center text-xs text-purple-400">PA</th>
                <th className="px-3 py-2 text-center text-xs text-cyan-400">Fit</th>
                <th className="px-3 py-2 text-center text-xs text-cyan-400">Slot</th>
                <th className="px-3 py-2 text-center text-xs text-cyan-400">Feas%</th>
                <th className="px-3 py-2 text-right text-xs text-zinc-400">Value</th>
                <th className="px-3 py-2 text-right text-xs text-zinc-400">Wage</th>
                <th className="px-3 py-2 w-20" />
              </tr>
            </thead>
            <tbody>
              {[...shortlist]
                .sort((a, b) => b.current_ability - a.current_ability)
                .map((p) => {
                  const fm = bestFormationFit(p);
                  const feasScore = getFeas(p);
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/40 cursor-pointer transition-colors"
                      onClick={() => { setSelectedPlayer(p); setCurrentPage("players"); }}
                    >
                      <td className="px-3 py-2">
                        <Star size={14} className="text-yellow-400" fill="currentColor" />
                      </td>
                      <td className="px-3 py-2 font-medium text-zinc-100">{displayName(p)}</td>
                      <td className={`px-3 py-2 text-center text-xs ${ageColor(p.age)}`}>{p.age}</td>
                      <td className="px-3 py-2 text-center text-sky-400 font-mono text-xs">{p.natural_position}</td>
                      <td className="px-3 py-2 text-zinc-300 truncate max-w-[150px]">{p.club_name}</td>
                      <td className={`px-3 py-2 text-center font-mono font-bold text-xs ${caColor(p.current_ability)}`}>{p.current_ability}</td>
                      <td className={`px-3 py-2 text-center font-mono font-bold text-xs ${paColor(p.potential_ability)}`}>{p.potential_ability}</td>
                      <td className={`px-3 py-2 text-center font-mono font-bold text-xs ${fitColorClass(fm.fit)}`}>{fm.fit || "—"}</td>
                      <td className="px-3 py-2 text-center text-cyan-300 font-mono text-xs">{fm.slot}</td>
                      <td className={`px-3 py-2 text-center font-mono font-bold text-xs ${feasScore >= 0 ? feasibilityScoreColor(feasScore) : "text-zinc-600"}`}>{feasScore >= 0 ? feasScore : "—"}</td>
                      <td className="px-3 py-2 text-right text-xs text-zinc-300">{p.value > 0 ? formatValue(p.value) : "—"}</td>
                      <td className="px-3 py-2 text-right text-xs text-zinc-400">{p.wage > 0 ? formatWage(p.wage) : "—"}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1 justify-end">
                          <button onClick={(e) => { e.stopPropagation(); addToCompare(p); }} className="p-1 text-zinc-500 hover:text-fm-accent rounded">
                            <GitCompare size={12} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); toggleShortlist(p); }} className="p-1 text-zinc-500 hover:text-red-400 rounded">
                            <X size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
