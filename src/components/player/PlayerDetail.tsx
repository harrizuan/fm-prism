import type { Player } from "@/types/player";
import { displayName, attrColor, formatValue, formatWage, bestRoles, calculateFeasibility, feasibilityColor, feasibilityBg, feasibilityLabel, playerAthletics, playerHiddenMentals, developmentTrajectory, bigGameRating, injuryRiskIndex, pressingIntensity, consistencyIndex, valueEfficiency, leadershipScore } from "@/types/player";
import { useAppStore } from "@/stores/useAppStore";
import { X, GitCompare, TrendingUp, Shield, Zap, Brain, Eye, Star, Goal, Award, Target } from "lucide-react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer,
} from "recharts";

function AttributeRow({ label, value }: { label: string; value: number }) {
  if (value === 0) return null;
  const pct = (value / 20) * 100;
  const bg = value >= 17 ? "bg-green-500" : value >= 13 ? "bg-emerald-500" : value >= 9 ? "bg-yellow-500" : value >= 5 ? "bg-orange-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-1.5 py-px">
      <span className="text-[10px] text-zinc-400 w-20 truncate">{label}</span>
      <div className="flex-1 h-3.5 bg-zinc-800/80 rounded-sm overflow-hidden relative">
        <div className={`h-full rounded-sm ${bg} transition-all`} style={{ width: `${pct}%` }} />
        <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-bold ${attrColor(value)}`}>{value}</span>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  if (!value || value === 0) return null;
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-[10px] text-zinc-500">{label}</span>
      <span className="text-[10px] text-zinc-300 font-medium">{value}</span>
    </div>
  );
}

export function PlayerDetail() {
  const { selectedPlayer, setSelectedPlayer, addToCompare, toggleShortlist, shortlist, managerProfile, squadIds } = useAppStore();

  if (!selectedPlayer) {
    return (
      <div className="w-72 border-l border-zinc-800 bg-zinc-900/50 flex items-center justify-center">
        <div className="text-center text-zinc-600">
          <Eye size={32} className="mx-auto mb-2 opacity-20" />
          <p className="text-xs">Click a player to view</p>
          <p className="text-[10px] mt-0.5 text-zinc-700">Double-click to compare</p>
        </div>
      </div>
    );
  }

  const p = selectedPlayer;
  const isStarred = shortlist.some((x) => x.id === p.id);
  const isGK = p.natural_position === "GK";

  const radarData = isGK ? [
    { attr: "Handling", value: p.goalkeeping.handling },
    { attr: "Reflexes", value: p.goalkeeping.reflexes },
    { attr: "Command", value: p.goalkeeping.command_of_area },
    { attr: "1v1", value: p.goalkeeping.one_on_ones },
    { attr: "Kicking", value: p.goalkeeping.kicking },
    { attr: "Aerial", value: p.goalkeeping.aerial_reach },
  ] : [
    { attr: "Tech", value: Math.round((p.technical.finishing + p.technical.passing + p.technical.dribbling + p.technical.first_touch + p.technical.technique) / 5) },
    { attr: "Mental", value: Math.round((p.mental.composure + p.mental.decisions + p.mental.vision + p.mental.anticipation + p.mental.off_the_ball) / 5) },
    { attr: "Physical", value: Math.round((p.physical.pace + p.physical.acceleration + p.physical.strength + p.physical.stamina + p.physical.agility) / 5) },
    { attr: "Attack", value: Math.round((p.technical.finishing + p.technical.dribbling + p.mental.off_the_ball + p.mental.composure) / 4) },
    { attr: "Defend", value: Math.round((p.technical.tackling + p.technical.marking + p.mental.positioning + p.mental.concentration) / 4) },
    { attr: "Create", value: Math.round((p.technical.passing + p.mental.vision + p.mental.flair + p.technical.crossing) / 4) },
  ];

  const caColor = p.current_ability >= 170 ? "text-purple-400" : p.current_ability >= 150 ? "text-blue-400" : p.current_ability >= 130 ? "text-fm-accent" : "text-green-400";
  const paColor = p.potential_ability >= 180 ? "text-purple-400" : p.potential_ability >= 160 ? "text-blue-400" : p.potential_ability >= 140 ? "text-fm-accent" : "text-green-400";

  return (
    <div className="w-72 border-l border-zinc-800 bg-zinc-900/50 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-3 bg-gradient-to-r from-fm-green/20 to-zinc-900 border-b border-zinc-800">
        <div className="flex justify-between items-start">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-zinc-100 truncate">{displayName(p)}</h2>
            <p className="text-xs text-zinc-400 truncate">{p.club_name || "Free Agent"}</p>
            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-zinc-500">
              <span>{p.nationality}</span>
              <span>•</span>
              <span>{p.natural_position}</span>
              <span>•</span>
              <span>Age {p.age}</span>
              {p.height > 0 && <><span>•</span><span>{p.height}cm</span></>}
            </div>
          </div>
          <div className="flex gap-0.5 shrink-0">
            <button onClick={() => toggleShortlist(p)} className={`p-1 rounded hover:bg-zinc-800 ${isStarred ? "text-yellow-400" : "text-zinc-500 hover:text-yellow-400"}`}>
              <Star size={14} fill={isStarred ? "currentColor" : "none"} />
            </button>
            <button onClick={() => addToCompare(p)} className="p-1 text-zinc-500 hover:text-fm-accent rounded hover:bg-zinc-800" title="Compare">
              <GitCompare size={14} />
            </button>
            <button onClick={() => setSelectedPlayer(null)} className="p-1 text-zinc-500 hover:text-zinc-200 rounded hover:bg-zinc-800">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Ability + Finance */}
        <div className="grid grid-cols-4 gap-2 mt-2">
          <div className="text-center">
            <div className="text-[9px] text-zinc-500 uppercase">CA</div>
            <div className={`text-xl font-black ${caColor}`}>{p.current_ability}</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-zinc-500 uppercase">PA</div>
            <div className={`text-xl font-black ${paColor}`}>{p.potential_ability}</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-zinc-500 uppercase">Value</div>
            <div className="text-xs font-semibold text-zinc-200 mt-1">{p.value > 0 ? formatValue(p.value) : "-"}</div>
          </div>
          <div className="text-center">
            <div className="text-[9px] text-zinc-500 uppercase">Wage</div>
            <div className="text-xs font-semibold text-zinc-300 mt-1">{p.wage > 0 ? formatWage(p.wage) : "-"}</div>
          </div>
        </div>

        {/* Extra info */}
        <div className="mt-2 border-t border-zinc-800/50 pt-1.5 space-y-0">
          <InfoRow label="Preferred Foot" value={p.preferred_foot} />
          <InfoRow label="Contract" value={p.contract_expiry ? p.contract_expiry.slice(0, 7) : ""} />
          <InfoRow label="Transfer" value={p.transfer_status} />
          <InfoRow label="World Rep" value={p.world_reputation > 0 ? p.world_reputation : 0} />
        </div>

        {/* Research-based meta indicators */}
        {(() => {
          const athScore = playerAthletics(p);
          const hiddenScore = playerHiddenMentals(p);
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

      {/* Radar */}
      <div className="h-40 px-2 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="65%">
            <PolarGrid stroke="#333" />
            <PolarAngleAxis dataKey="attr" tick={{ fill: "#a1a1aa", fontSize: 9 }} />
            <PolarRadiusAxis angle={30} domain={[0, 20]} tick={false} axisLine={false} />
            <Radar name="Player" dataKey="value" stroke={isGK ? "#f59e0b" : "#4ade80"} fill={isGK ? "#f59e0b" : "#4ade80"} fillOpacity={0.15} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Attributes */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
        {/* Transfer Feasibility */}
        {managerProfile && !squadIds.has(p.id) && (
          <section>
            <div className="flex items-center gap-1 mb-1">
              <Target size={11} className="text-cyan-400" />
              <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Transfer Feasibility</h3>
            </div>
            {(() => {
              const f = calculateFeasibility(p, managerProfile.club_reputation, managerProfile.squad_highest_wage, managerProfile.squad_total_value, managerProfile.game_year);
              const pRep = Math.max(p.world_reputation, p.current_reputation);
              const gap = pRep - managerProfile.club_reputation;
              const gapColor = gap <= -1000 ? "text-green-400" : gap <= 0 ? "text-emerald-400" : gap <= 1000 ? "text-yellow-400" : gap <= 2500 ? "text-orange-400" : "text-red-400";
              return (
                <div className={`rounded-lg border px-2 py-1.5 ${feasibilityBg(f.level)}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${feasibilityColor(f.level)}`}>{feasibilityLabel(f.level)}</span>
                    <span className={`text-xs font-mono ${feasibilityColor(f.level)}`}>{f.score}/100</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-1.5">
                    <div className={`h-full rounded-full transition-all ${f.score >= 65 ? "bg-green-500" : f.score >= 50 ? "bg-yellow-500" : f.score >= 35 ? "bg-orange-500" : "bg-red-500"}`}
                      style={{ width: `${f.score}%` }} />
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] text-zinc-500">Rep Gap:</span>
                    <span className={`text-[10px] font-mono font-bold ${gapColor}`}>{gap > 0 ? "+" : ""}{gap}</span>
                    <span className="text-[9px] text-zinc-600">({pRep} vs {managerProfile.squad_avg_world_rep})</span>
                  </div>
                  <div className="space-y-0.5">
                    {f.reasons.slice(0, 5).map((r, i) => (
                      <p key={i} className="text-[9px] text-zinc-400">• {r}</p>
                    ))}
                  </div>
                </div>
              );
            })()}
          </section>
        )}

        {/* In My Squad indicator */}
        {squadIds.has(p.id) && (
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-2 py-1.5 text-center">
            <span className="text-xs text-blue-400 font-medium">✓ In Your Squad</span>
          </div>
        )}

        {/* Scouting Intelligence — Research-backed composite scores */}
        <section>
          <div className="flex items-center gap-1 mb-1">
            <Zap size={11} className="text-cyan-400" />
            <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Scouting Intelligence</h3>
          </div>
          {(() => {
            const dev = developmentTrajectory(p);
            const bgr = bigGameRating(p);
            const inj = injuryRiskIndex(p);
            const prs = pressingIntensity(p);
            const con = consistencyIndex(p);
            const vfm = valueEfficiency(p);
            const ldr = leadershipScore(p);
            const scores: { label: string; value: number; tip: string; invert?: boolean }[] = [
              { label: "Development", value: dev, tip: "Growth trajectory based on age, PA gap, professionalism" },
              { label: "Big Game", value: bgr, tip: "Performance in high-pressure matches (derbies, finals)" },
              { label: "Consistency", value: con, tip: "Match-to-match reliability and rating variance" },
              { label: "Pressing", value: prs, tip: "Suitability for high-press/gegenpress systems" },
              { label: "Leadership", value: ldr, tip: "Captaincy material, dressing room influence" },
              { label: "Value/Money", value: vfm, tip: "CA per monetary unit adjusted for age" },
              { label: "Injury Risk", value: inj, tip: "Higher = more risky (injury proneness, fitness)", invert: true },
            ];
            return (
              <div className="space-y-0.5">
                {scores.map(s => {
                  const pct = Math.min(100, s.value);
                  const color = s.invert
                    ? (pct >= 60 ? "bg-red-500" : pct >= 35 ? "bg-orange-500" : pct >= 15 ? "bg-yellow-500" : "bg-green-500")
                    : (pct >= 70 ? "bg-green-500" : pct >= 50 ? "bg-emerald-500" : pct >= 30 ? "bg-yellow-500" : "bg-orange-500");
                  const textColor = s.invert
                    ? (pct >= 60 ? "text-red-400" : pct >= 35 ? "text-orange-400" : "text-green-400")
                    : (pct >= 70 ? "text-green-400" : pct >= 50 ? "text-emerald-300" : pct >= 30 ? "text-yellow-400" : "text-orange-400");
                  return (
                    <div key={s.label} className="flex items-center gap-1.5 py-px" title={s.tip}>
                      <span className="text-[10px] text-zinc-400 w-20 truncate">{s.label}</span>
                      <div className="flex-1 h-3.5 bg-zinc-800/80 rounded-sm overflow-hidden relative">
                        <div className={`h-full rounded-sm ${color} transition-all`} style={{ width: `${pct}%` }} />
                        <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-bold ${textColor}`}>
                          {s.value > 0 ? s.value.toFixed(0) : "—"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </section>

        {/* Role Ratings */}
        <section>
          <div className="flex items-center gap-1 mb-1">
            <Award size={11} className="text-amber-400" />
            <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Best Roles</h3>
          </div>
          {bestRoles(p, 5).map((r) => {
            const scorePct = r.score;
            const bg = scorePct >= 75 ? "bg-green-500" : scorePct >= 60 ? "bg-emerald-500" : scorePct >= 45 ? "bg-yellow-500" : "bg-orange-500";
            return (
              <div key={r.role.short} className="flex items-center gap-1.5 py-px">
                <span className="text-[10px] text-zinc-400 w-20 truncate" title={r.role.name}>{r.role.short} {r.role.name}</span>
                <div className="flex-1 h-3.5 bg-zinc-800/80 rounded-sm overflow-hidden relative">
                  <div className={`h-full rounded-sm ${bg} transition-all`} style={{ width: `${scorePct}%` }} />
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-zinc-100">{r.score.toFixed(0)}</span>
                </div>
              </div>
            );
          })}
        </section>

        {/* Technical */}
        <section>
          <div className="flex items-center gap-1 mb-1">
            <Zap size={11} className="text-blue-400" />
            <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Technical</h3>
          </div>
          <AttributeRow label="Corners" value={p.technical.corners} />
          <AttributeRow label="Crossing" value={p.technical.crossing} />
          <AttributeRow label="Dribbling" value={p.technical.dribbling} />
          <AttributeRow label="Finishing" value={p.technical.finishing} />
          <AttributeRow label="First Touch" value={p.technical.first_touch} />
          <AttributeRow label="Free Kick" value={p.technical.free_kick} />
          <AttributeRow label="Heading" value={p.technical.heading} />
          <AttributeRow label="Long Shots" value={p.technical.long_shots} />
          <AttributeRow label="Marking" value={p.technical.marking} />
          <AttributeRow label="Passing" value={p.technical.passing} />
          <AttributeRow label="Penalty" value={p.technical.penalty} />
          <AttributeRow label="Tackling" value={p.technical.tackling} />
          <AttributeRow label="Technique" value={p.technical.technique} />
        </section>

        {/* Mental */}
        <section>
          <div className="flex items-center gap-1 mb-1">
            <Brain size={11} className="text-purple-400" />
            <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Mental</h3>
          </div>
          <AttributeRow label="Aggression" value={p.mental.aggression} />
          <AttributeRow label="Anticipation" value={p.mental.anticipation} />
          <AttributeRow label="Bravery" value={p.mental.bravery} />
          <AttributeRow label="Composure" value={p.mental.composure} />
          <AttributeRow label="Concentration" value={p.mental.concentration} />
          <AttributeRow label="Decisions" value={p.mental.decisions} />
          <AttributeRow label="Determination" value={p.mental.determination} />
          <AttributeRow label="Flair" value={p.mental.flair} />
          <AttributeRow label="Leadership" value={p.mental.leadership} />
          <AttributeRow label="Off The Ball" value={p.mental.off_the_ball} />
          <AttributeRow label="Positioning" value={p.mental.positioning} />
          <AttributeRow label="Teamwork" value={p.mental.teamwork} />
          <AttributeRow label="Vision" value={p.mental.vision} />
          <AttributeRow label="Work Rate" value={p.mental.work_rate} />
        </section>

        {/* Physical */}
        <section>
          <div className="flex items-center gap-1 mb-1">
            <TrendingUp size={11} className="text-green-400" />
            <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Physical</h3>
          </div>
          <AttributeRow label="Acceleration" value={p.physical.acceleration} />
          <AttributeRow label="Agility" value={p.physical.agility} />
          <AttributeRow label="Balance" value={p.physical.balance} />
          <AttributeRow label="Jumping" value={p.physical.jumping} />
          <AttributeRow label="Nat. Fitness" value={p.physical.natural_fitness} />
          <AttributeRow label="Pace" value={p.physical.pace} />
          <AttributeRow label="Stamina" value={p.physical.stamina} />
          <AttributeRow label="Strength" value={p.physical.strength} />
        </section>

        {/* Goalkeeping */}
        {(isGK || p.goalkeeping.handling > 3) && (
          <section>
            <div className="flex items-center gap-1 mb-1">
              <Goal size={11} className="text-amber-400" />
              <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Goalkeeping</h3>
            </div>
            <AttributeRow label="Handling" value={p.goalkeeping.handling} />
            <AttributeRow label="Aerial Reach" value={p.goalkeeping.aerial_reach} />
            <AttributeRow label="Command" value={p.goalkeeping.command_of_area} />
            <AttributeRow label="Communication" value={p.goalkeeping.communication} />
            <AttributeRow label="Kicking" value={p.goalkeeping.kicking} />
            <AttributeRow label="Throwing" value={p.goalkeeping.throwing} />
            <AttributeRow label="One on Ones" value={p.goalkeeping.one_on_ones} />
            <AttributeRow label="Reflexes" value={p.goalkeeping.reflexes} />
            <AttributeRow label="Eccentricity" value={p.goalkeeping.eccentricity} />
            <AttributeRow label="Rushing Out" value={p.goalkeeping.rushing_out} />
            <AttributeRow label="Punching" value={p.goalkeeping.punching} />
          </section>
        )}

        {/* Hidden */}
        <section>
          <div className="flex items-center gap-1 mb-1">
            <Shield size={11} className="text-red-400" />
            <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Hidden</h3>
          </div>
          <AttributeRow label="Consistency" value={p.hidden.consistency} />
          <AttributeRow label="Imp. Matches" value={p.hidden.important_matches} />
          <AttributeRow label="Inj. Prone" value={p.hidden.injury_proneness} />
          <AttributeRow label="Versatility" value={p.hidden.versatility} />
          <AttributeRow label="Dirtiness" value={p.hidden.dirtiness} />
          <AttributeRow label="Adaptability" value={p.hidden.adaptability} />
          <AttributeRow label="Ambition" value={p.hidden.ambition} />
          <AttributeRow label="Loyalty" value={p.hidden.loyalty} />
          <AttributeRow label="Pressure" value={p.hidden.pressure} />
          <AttributeRow label="Professional" value={p.hidden.professionalism} />
          <AttributeRow label="Sportsmanship" value={p.hidden.sportsmanship} />
          <AttributeRow label="Temperament" value={p.hidden.temperament} />
          <AttributeRow label="Controversy" value={p.hidden.controversy} />
        </section>
      </div>
    </div>
  );
}
