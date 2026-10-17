import {
  Home,
  Users,
  Shield,
  ArrowLeftRight,
  GitCompare,
  Star,
  Settings,
  Wifi,
  WifiOff,
  Loader2,
  RefreshCw,
  Flag,
  GraduationCap,
} from "lucide-react";
import { useAppStore } from "@/stores/useAppStore";

const navItems = [
  { id: "dashboard" as const, label: "Dashboard", icon: Home },
  { id: "squad" as const, label: "My Squad", icon: Shield },
  { id: "youth" as const, label: "Youth Squad", icon: GraduationCap },
  { id: "players" as const, label: "Players", icon: Users },
  { id: "transfers" as const, label: "Transfers", icon: ArrowLeftRight },
  { id: "national" as const, label: "National Team", icon: Flag },
  { id: "compare" as const, label: "Compare", icon: GitCompare },
  { id: "shortlists" as const, label: "Shortlists", icon: Star },
  { id: "settings" as const, label: "Settings", icon: Settings },
];

export function Sidebar() {
  const { currentPage, setCurrentPage, connected, gameInfo, players, connecting, shortlist, compareList, loading, rescan, managerProfile } = useAppStore();

  return (
    <div className="w-14 hover:w-52 transition-all duration-200 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full group overflow-hidden">
      {/* Logo */}
      <div className="p-3 border-b border-zinc-800 flex items-center gap-3 min-h-[52px]">
        <div className="w-8 h-8 rounded-lg bg-fm-green flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm">FM</span>
        </div>
        <span className="text-sm font-semibold text-zinc-100 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          Prism
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2">
        {navItems.map((item) => {
          const badge =
            item.id === "shortlists" ? shortlist.length
            : item.id === "compare" ? compareList.length
            : 0;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors relative ${
                currentPage === item.id
                  ? "bg-fm-green/20 text-fm-accent border-r-2 border-fm-accent"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              <item.icon size={20} className="shrink-0 ml-0.5" />
              {badge > 0 && (
                <span className="absolute top-1.5 left-6 w-3.5 h-3.5 rounded-full bg-fm-accent text-[8px] font-bold text-white flex items-center justify-center">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
              <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Rescan Button */}
      {connected && players.length > 0 && (
        <div className="px-3 pb-2">
          <button
            onClick={() => rescan().catch(() => {})}
            disabled={loading}
            className="w-full flex items-center gap-3 px-2 py-2 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={`shrink-0 ml-0.5 ${loading ? "animate-spin" : ""}`} />
            <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
              {loading ? "Scanning..." : "Rescan"}
            </span>
          </button>
        </div>
      )}

      {/* Connection Status */}
      <div className="p-3 border-t border-zinc-800">
        <div className="flex items-center gap-3">
          {connecting ? (
            <Loader2 size={18} className="text-yellow-400 animate-spin shrink-0 ml-0.5" />
          ) : connected ? (
            <Wifi size={18} className="text-fm-accent shrink-0 ml-0.5" />
          ) : (
            <WifiOff size={18} className="text-red-400 shrink-0 ml-0.5" />
          )}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            <p className="text-xs text-zinc-400">
              {connecting ? "Connecting..." : connected ? "Connected" : "Disconnected"}
            </p>
            {connected && managerProfile && (
              <p className="text-xs text-zinc-500 truncate max-w-[140px]">
                {managerProfile.club_name}
              </p>
            )}
            {connected && (
              <p className="text-xs text-zinc-500">
                {players.length.toLocaleString()} players
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
