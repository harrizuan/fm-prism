import { useAppStore } from "@/stores/useAppStore";
import { displayName, attrColor, formatValue, formatWage } from "@/types/player";
import { X, Trash2 } from "lucide-react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ResponsiveContainer, Legend,
} from "recharts";

const COLORS = ["#4ade80", "#3b82f6", "#a855f7", "#f97316", "#ef4444"];

type AttrSection = { title: string; attrs: [string, (p: any) => number][] };

const sections: AttrSection[] = [
  {
    title: "Technical",
    attrs: [
      ["Corners", (p) => p.technical.corners], ["Crossing", (p) => p.technical.crossing],
      ["Dribbling", (p) => p.technical.dribbling], ["Finishing", (p) => p.technical.finishing],
      ["First Touch", (p) => p.technical.first_touch], ["Free Kick", (p) => p.technical.free_kick],
      ["Heading", (p) => p.technical.heading], ["Long Shots", (p) => p.technical.long_shots],
      ["Marking", (p) => p.technical.marking], ["Passing", (p) => p.technical.passing],
      ["Penalty", (p) => p.technical.penalty], ["Tackling", (p) => p.technical.tackling],
      ["Technique", (p) => p.technical.technique],
    ],
  },
  {
    title: "Mental",
    attrs: [
      ["Aggression", (p) => p.mental.aggression], ["Anticipation", (p) => p.mental.anticipation],
      ["Bravery", (p) => p.mental.bravery], ["Composure", (p) => p.mental.composure],
      ["Concentration", (p) => p.mental.concentration], ["Decisions", (p) => p.mental.decisions],
      ["Determination", (p) => p.mental.determination], ["Flair", (p) => p.mental.flair],
      ["Leadership", (p) => p.mental.leadership], ["Off The Ball", (p) => p.mental.off_the_ball],
      ["Positioning", (p) => p.mental.positioning], ["Teamwork", (p) => p.mental.teamwork],
      ["Vision", (p) => p.mental.vision], ["Work Rate", (p) => p.mental.work_rate],
    ],
  },
  {
    title: "Physical",
    attrs: [
      ["Acceleration", (p) => p.physical.acceleration], ["Agility", (p) => p.physical.agility],
      ["Balance", (p) => p.physical.balance], ["Jumping", (p) => p.physical.jumping],
      ["Nat. Fitness", (p) => p.physical.natural_fitness], ["Pace", (p) => p.physical.pace],
      ["Stamina", (p) => p.physical.stamina], ["Strength", (p) => p.physical.strength],
    ],
  },
  {
    title: "Hidden",
    attrs: [
      ["Consistency", (p) => p.hidden.consistency], ["Imp. Matches", (p) => p.hidden.important_matches],
      ["Inj. Prone", (p) => p.hidden.injury_proneness], ["Versatility", (p) => p.hidden.versatility],
      ["Adaptability", (p) => p.hidden.adaptability], ["Ambition", (p) => p.hidden.ambition],
      ["Loyalty", (p) => p.hidden.loyalty], ["Professionalism", (p) => p.hidden.professionalism],
      ["Pressure", (p) => p.hidden.pressure], ["Temperament", (p) => p.hidden.temperament],
      ["Dirtiness", (p) => p.hidden.dirtiness], ["Sportsmanship", (p) => p.hidden.sportsmanship],
      ["Controversy", (p) => p.hidden.controversy],
    ],
  },
];

export function ComparePage() {
  const { compareList, removeFromCompare, clearCompare } = useAppStore();

  if (compareList.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-zinc-500">
          <p className="text-lg mb-2">No players to compare</p>
          <p className="text-sm">Double-click players in the grid to add them (up to 5)</p>
        </div>
      </div>
    );
  }

  const radarAttrs = [
    ["Finishing", (p: any) => p.technical.finishing], ["Passing", (p: any) => p.technical.passing],
    ["Dribbling", (p: any) => p.technical.dribbling], ["Tackling", (p: any) => p.technical.tackling],
    ["Composure", (p: any) => p.mental.composure], ["Vision", (p: any) => p.mental.vision],
    ["Decisions", (p: any) => p.mental.decisions], ["Off The Ball", (p: any) => p.mental.off_the_ball],
    ["Pace", (p: any) => p.physical.pace], ["Acceleration", (p: any) => p.physical.acceleration],
    ["Strength", (p: any) => p.physical.strength], ["Stamina", (p: any) => p.physical.stamina],
  ] as [string, (p: any) => number][];

  const radarData = radarAttrs.map(([attr, fn]) => {
    const obj: any = { attr };
    compareList.forEach((p, i) => { obj[`p${i}`] = fn(p); });
    return obj;
  });

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-zinc-100">Player Comparison</h1>
        <button onClick={clearCompare} className="px-3 py-1.5 bg-zinc-800 text-zinc-400 hover:text-red-400 rounded-lg text-xs flex items-center gap-1.5 border border-zinc-700">
          <Trash2 size={12} /> Clear
        </button>
      </div>

      {/* Player cards */}
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: `repeat(${compareList.length}, 1fr)` }}>
        {compareList.map((p, i) => {
          const caColor = p.current_ability >= 170 ? "text-purple-400" : p.current_ability >= 150 ? "text-blue-400" : p.current_ability >= 130 ? "text-fm-accent" : "text-green-400";
          const paColor = p.potential_ability >= 180 ? "text-purple-400" : p.potential_ability >= 160 ? "text-blue-400" : p.potential_ability >= 140 ? "text-fm-accent" : "text-green-400";
          return (
            <div key={p.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 relative" style={{ borderTopColor: COLORS[i], borderTopWidth: 3 }}>
              <button onClick={() => removeFromCompare(p.id)} className="absolute top-2 right-2 p-1 text-zinc-500 hover:text-red-400 rounded">
                <X size={12} />
              </button>
              <h3 className="font-semibold text-zinc-100 text-sm truncate">{displayName(p)}</h3>
              <p className="text-[10px] text-zinc-400">{p.club_name} • {p.natural_position} • {p.age}y{p.height > 0 ? ` • ${p.height}cm` : ""}</p>
              <div className="grid grid-cols-4 gap-1 mt-2">
                <div className="text-center"><div className="text-[9px] text-zinc-500">CA</div><div className={`text-lg font-black ${caColor}`}>{p.current_ability}</div></div>
                <div className="text-center"><div className="text-[9px] text-zinc-500">PA</div><div className={`text-lg font-black ${paColor}`}>{p.potential_ability}</div></div>
                <div className="text-center"><div className="text-[9px] text-zinc-500">Value</div><div className="text-xs text-zinc-200 mt-1">{p.value > 0 ? formatValue(p.value) : "-"}</div></div>
                <div className="text-center"><div className="text-[9px] text-zinc-500">Wage</div><div className="text-xs text-zinc-300 mt-1">{p.wage > 0 ? formatWage(p.wage) : "-"}</div></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Radar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-4">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="#333" />
              <PolarAngleAxis dataKey="attr" tick={{ fill: "#a1a1aa", fontSize: 10 }} />
              <PolarRadiusAxis angle={30} domain={[0, 20]} tick={false} axisLine={false} />
              {compareList.map((p, i) => (
                <Radar key={p.id} name={displayName(p)} dataKey={`p${i}`} stroke={COLORS[i]} fill={COLORS[i]} fillOpacity={0.08} strokeWidth={2} />
              ))}
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Full attribute comparison */}
      {sections.map((section) => (
        <div key={section.title} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-3">
          <div className="px-3 py-1.5 border-b border-zinc-800 bg-zinc-800/30">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{section.title}</h3>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {section.attrs.map(([attr, fn]) => {
                const values = compareList.map((p) => fn(p));
                const maxVal = Math.max(...values.filter((v) => v > 0));
                return (
                  <tr key={attr} className="border-b border-zinc-800/30 hover:bg-zinc-800/20">
                    <td className="px-3 py-1 text-xs text-zinc-400 w-28">{attr}</td>
                    {values.map((v, i) => (
                      <td key={i} className="px-3 py-1 text-center">
                        <span className={`font-mono text-xs font-bold ${v === maxVal && compareList.length > 1 ? "underline decoration-fm-accent" : ""} ${v > 0 ? attrColor(v) : "text-zinc-700"}`}>
                          {v > 0 ? v : "-"}
                        </span>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
