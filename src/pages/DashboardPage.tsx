import { useAppStore } from "@/stores/useAppStore";
import { displayName, formatValue, formatWage, bestRoles } from "@/types/player";
import { Wifi, WifiOff, Download, Users, TrendingUp, Star, Loader2, Zap, Shield, DollarSign, RefreshCw, ArrowLeftRight, Trophy } from "lucide-react";

export function DashboardPage() {
  const { connected, connecting, gameInfo, players, connectToFM, loadPlayers, loading, loadProgress, setCurrentPage, managerProfile, rescan, squadIds } = useAppStore();

  const wonderkids = players.filter((p) => p.age <= 21 && p.potential_ability >= 150);
  const topPlayers = players.filter((p) => p.current_ability >= 160);
  const bargains = players.filter((p) => p.current_ability >= 120 && p.value > 0 && p.value < 10_000_000);
  const freeAgents = players.filter((p) => !p.club_name || p.club_name === "Free Agent");
  const listed = players.filter((p) => p.is_listed || p.transfer_status.includes("Listed"));
  const squadPlayers = players.filter((p) => squadIds.has(p.id));

  // Top leagues by player count
  const leagueCounts: Record<string, { count: number; avgCA: number; totalCA: number }> = {};
  for (const p of players) {
    const league = p.league_name || "Unknown";
    if (!leagueCounts[league]) leagueCounts[league] = { count: 0, avgCA: 0, totalCA: 0 };
    leagueCounts[league].count++;
    leagueCounts[league].totalCA += p.current_ability;
  }
  const topLeagues = Object.entries(leagueCounts)
    .filter(([name]) => name !== "Unknown" && name.length >= 3)
    .map(([name, data]) => ({ name, count: data.count, avgCA: data.totalCA / data.count }))
    .sort((a, b) => b.avgCA - a.avgCA)
    .slice(0, 10);

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <h1 className="text-2xl font-bold text-zinc-100 mb-6">FM Prism</h1>

      {/* Connection Card */}
      <div className={`rounded-xl p-6 mb-6 border ${connected ? "bg-fm-green/10 border-fm-green/30" : "bg-zinc-900 border-zinc-800"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {connected ? (
              <div className="w-12 h-12 rounded-full bg-fm-green/20 flex items-center justify-center">
                <Wifi size={24} className="text-fm-accent" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
                <WifiOff size={24} className="text-zinc-500" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">
                {connected ? `Connected to ${gameInfo?.window_title}` : "Not Connected"}
              </h2>
              <p className="text-sm text-zinc-400">
                {connected
                  ? `PID: ${gameInfo?.process_id} • ${players.length.toLocaleString()} players loaded`
                  : "Connect to Football Manager 26 to start scouting"}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            {!connected ? (
              <button
                onClick={() => connectToFM().catch((e) => alert(e))}
                disabled={connecting}
                className="px-6 py-2.5 bg-fm-green hover:bg-fm-green-light text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {connecting ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                {connecting ? "Connecting..." : "Connect to FM"}
              </button>
            ) : (
              <>
                <button
                  onClick={() => (players.length > 0 ? rescan() : loadPlayers()).catch((e) => alert(e))}
                  disabled={loading}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : players.length > 0 ? <RefreshCw size={16} /> : <Download size={16} />}
                  {loading ? "Loading..." : players.length > 0 ? "Rescan" : "Load Players"}
                </button>
              </>
            )}
          </div>
        </div>

        {loading && loadProgress && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-zinc-400 mb-1">
              <span>{loadProgress.message}</span>
              {loadProgress.total > 0 && <span>{loadProgress.current} / {loadProgress.total}</span>}
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-fm-accent rounded-full transition-all duration-300"
                style={{
                  width: loadProgress.total > 0 ? `${(loadProgress.current / loadProgress.total) * 100}%` : "100%",
                  animation: loadProgress.total === 0 ? "pulse 2s infinite" : undefined,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Manager Profile Card */}
      {managerProfile && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-6 cursor-pointer hover:border-zinc-700" onClick={() => setCurrentPage("squad")}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Shield size={24} className="text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-zinc-100">{managerProfile.club_name}</h3>
              <div className="flex items-center gap-3 text-sm text-zinc-400">
                <span>{managerProfile.name}</span>
                {managerProfile.nationality && <span>• {managerProfile.nationality}</span>}
                {managerProfile.league_name && <span>• {managerProfile.league_name}</span>}
              </div>
            </div>
            <div className="text-right text-sm">
              <p className="text-zinc-300 font-mono">{squadPlayers.length} players</p>
              <p className="text-zinc-500">{formatValue(managerProfile.squad_total_value)} squad value</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {players.length > 0 && (
        <div className="grid grid-cols-6 gap-3 mb-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 cursor-pointer hover:border-zinc-700" onClick={() => setCurrentPage("players")}>
            <div className="flex items-center gap-3">
              <Users size={18} className="text-blue-400" />
              <div>
                <p className="text-xl font-bold text-zinc-100">{players.length.toLocaleString()}</p>
                <p className="text-xs text-zinc-500">Total Players</p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 cursor-pointer hover:border-zinc-700"
            onClick={() => { useAppStore.getState().setMaxAge(21); useAppStore.getState().setMinPA(150); setCurrentPage("players"); }}>
            <div className="flex items-center gap-3">
              <Star size={18} className="text-purple-400" />
              <div>
                <p className="text-xl font-bold text-zinc-100">{wonderkids.length}</p>
                <p className="text-xs text-zinc-500">Wonderkids</p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 cursor-pointer hover:border-zinc-700"
            onClick={() => { useAppStore.getState().setMinCA(160); setCurrentPage("players"); }}>
            <div className="flex items-center gap-3">
              <TrendingUp size={18} className="text-green-400" />
              <div>
                <p className="text-xl font-bold text-zinc-100">{topPlayers.length}</p>
                <p className="text-xs text-zinc-500">Elite (CA 160+)</p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 cursor-pointer hover:border-zinc-700"
            onClick={() => setCurrentPage("transfers")}>
            <div className="flex items-center gap-3">
              <ArrowLeftRight size={18} className="text-amber-400" />
              <div>
                <p className="text-xl font-bold text-zinc-100">{listed.length}</p>
                <p className="text-xs text-zinc-500">Listed</p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 cursor-pointer hover:border-zinc-700"
            onClick={() => setCurrentPage("transfers")}>
            <div className="flex items-center gap-3">
              <DollarSign size={18} className="text-emerald-400" />
              <div>
                <p className="text-xl font-bold text-zinc-100">{bargains.length}</p>
                <p className="text-xs text-zinc-500">Bargains</p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 cursor-pointer hover:border-zinc-700"
            onClick={() => setCurrentPage("transfers")}>
            <div className="flex items-center gap-3">
              <Zap size={18} className="text-rose-400" />
              <div>
                <p className="text-xl font-bold text-zinc-100">{freeAgents.length}</p>
                <p className="text-xs text-zinc-500">Free Agents</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Two-column: Top Players + League Overview */}
      {players.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {/* Top Players */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-zinc-300 mb-3">Top 15 Players by CA</h3>
            <div className="space-y-1">
              {[...players]
                .sort((a, b) => b.current_ability - a.current_ability)
                .slice(0, 15)
                .map((p, idx) => {
                  const roles = bestRoles(p, 1);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-800/30 hover:bg-zinc-800 cursor-pointer text-sm"
                      onClick={() => { useAppStore.getState().setSelectedPlayer(p); setCurrentPage("players"); }}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-xs text-zinc-600 w-4">{idx + 1}</span>
                        <span className="text-zinc-100 font-medium truncate">{displayName(p)}</span>
                        <span className="text-xs text-sky-400">{p.natural_position}</span>
                        {roles[0] && <span className="text-xs text-zinc-600">{roles[0].role.short}</span>}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-zinc-500">{p.club_name}</span>
                        <span className="font-mono font-bold text-fm-accent text-xs w-8 text-right">{p.current_ability}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* League Overview */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
              <Trophy size={16} className="text-amber-400" />
              League Overview (by avg CA)
            </h3>
            {topLeagues.length > 0 ? (
              <div className="space-y-1">
                {topLeagues.map((league, idx) => (
                  <div key={league.name} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-800/30 text-sm">
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-xs text-zinc-600 w-4">{idx + 1}</span>
                      <span className="text-zinc-200 truncate">{league.name}</span>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="text-xs text-zinc-500">{league.count} players</span>
                      <span className="font-mono text-fm-accent text-xs w-10 text-right">{league.avgCA.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 text-sm">League data available after loading players.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
