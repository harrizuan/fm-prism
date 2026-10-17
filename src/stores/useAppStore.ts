import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Player, GameInfo, LoadProgress, ManagerProfile } from "@/types/player";
import { generateAIDatabase } from "@/utils/aiBrief";

type Page = "dashboard" | "players" | "squad" | "transfers" | "compare" | "shortlists" | "national" | "settings";

interface AppStore {
  connected: boolean;
  gameInfo: GameInfo | null;
  connecting: boolean;
  players: Player[];
  loading: boolean;
  loadProgress: LoadProgress | null;
  selectedPlayer: Player | null;
  searchQuery: string;
  currentPage: Page;
  compareList: Player[];
  shortlist: Player[];
  managerProfile: ManagerProfile | null;
  squadIds: Set<number>;

  // Filters
  minCA: number | null;
  maxCA: number | null;
  minPA: number | null;
  maxAge: number | null;
  minAge: number | null;
  positionFilter: string;
  maxValue: number | null;
  minValue: number | null;
  footFilter: string;
  showShortlistOnly: boolean;
  showRealisticOnly: boolean;
  leagueFilter: string;
  minFit: number | null;
  minFeas: number | null;
  formationSlotFilter: string;
  excludeOwnSquad: boolean;

  // Actions
  connectToFM: () => Promise<void>;
  disconnect: () => Promise<void>;
  loadPlayers: () => Promise<void>;
  rescan: () => Promise<void>;
  setSelectedPlayer: (p: Player | null) => void;
  setSearchQuery: (q: string) => void;
  setCurrentPage: (page: Page) => void;
  addToCompare: (p: Player) => void;
  removeFromCompare: (id: number) => void;
  clearCompare: () => void;
  toggleShortlist: (p: Player) => void;
  clearShortlist: () => void;
  setMinCA: (v: number | null) => void;
  setMaxCA: (v: number | null) => void;
  setMinPA: (v: number | null) => void;
  setMaxAge: (v: number | null) => void;
  setMinAge: (v: number | null) => void;
  setPositionFilter: (v: string) => void;
  setMaxValue: (v: number | null) => void;
  setMinValue: (v: number | null) => void;
  setFootFilter: (v: string) => void;
  setLeagueFilter: (v: string) => void;
  setShowShortlistOnly: (v: boolean) => void;
  setShowRealisticOnly: (v: boolean) => void;
  setMinFit: (v: number | null) => void;
  setMinFeas: (v: number | null) => void;
  setFormationSlotFilter: (v: string) => void;
  setExcludeOwnSquad: (v: boolean) => void;
  clearAllFilters: () => void;
  exportCSV: (path: string) => Promise<void>;
  exportJSON: (path: string) => Promise<void>;
  writeFile: (path: string, content: string) => Promise<void>;
}

async function doLoad(set: (s: Partial<AppStore>) => void, get: () => AppStore) {
  set({ loading: true, loadProgress: null });
  const unlisten = await listen<LoadProgress>("load_progress", (event) => {
    set({ loadProgress: event.payload });
  });
  try {
    await invoke<number>("scan_for_players");
    const players = await invoke<Player[]>("get_players");
    const profile = await invoke<ManagerProfile | null>("get_manager_profile");
    const squadIdArr = await invoke<number[]>("get_squad_ids");
    set({
      players,
      loading: false,
      loadProgress: null,
      managerProfile: profile,
      squadIds: new Set(squadIdArr),
    });

    // Hydrate shortlist against fresh player data — fixes stale
    // localStorage snapshots that don't reflect rescan values
    const freshMap = new Map(players.map(p => [p.id, p]));
    const oldList = get().shortlist;
    if (oldList.length > 0) {
      const hydrated = oldList
        .map(old => freshMap.get(old.id))
        .filter((p): p is Player => !!p);
      set({ shortlist: hydrated });
      try { localStorage.setItem("fm-scout-shortlist", JSON.stringify(hydrated)); } catch {}
    }
    if (get().gameInfo) {
      set({ gameInfo: { ...get().gameInfo!, player_count: players.length } });
    }

    // Auto-generate AI brief in background (non-blocking)
    if (profile) {
      const sIds = new Set(squadIdArr);
      generateAIDatabase(players, profile, sIds, get().shortlist).catch((e) =>
        console.warn("[AI DB] auto-gen failed:", e),
      );
    }
  } catch (e) {
    set({ loading: false });
    throw e;
  } finally {
    unlisten();
  }
}

export const useAppStore = create<AppStore>((set, get) => ({
  connected: false,
  gameInfo: null,
  connecting: false,
  players: [],
  loading: false,
  loadProgress: null,
  selectedPlayer: null,
  searchQuery: "",
  currentPage: "dashboard",
  compareList: [],
  shortlist: (() => {
    try {
      const saved = localStorage.getItem("fm-scout-shortlist");
      if (saved) return JSON.parse(saved) as Player[];
    } catch {}
    return [];
  })(),
  managerProfile: null,
  squadIds: new Set(),
  minCA: null,
  maxCA: null,
  minPA: null,
  maxAge: null,
  minAge: null,
  positionFilter: "",
  maxValue: null,
  minValue: null,
  footFilter: "",
  leagueFilter: "",
  showShortlistOnly: false,
  showRealisticOnly: false,
  minFit: null,
  minFeas: null,
  formationSlotFilter: "",
  excludeOwnSquad: false,

  connectToFM: async () => {
    set({ connecting: true });
    try {
      const info = await invoke<GameInfo>("connect_to_fm");
      set({ connected: true, gameInfo: info, connecting: false });
    } catch (e) {
      set({ connecting: false });
      throw e;
    }
  },

  disconnect: async () => {
    await invoke("disconnect_fm");
    set({
      connected: false, gameInfo: null, players: [], selectedPlayer: null,
      managerProfile: null, squadIds: new Set(),
    });
  },

  loadPlayers: () => doLoad(set, get),

  rescan: () => doLoad(set, get),

  setSelectedPlayer: (p) => set({ selectedPlayer: p }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setCurrentPage: (page) => set({ currentPage: page }),

  addToCompare: (p) => {
    const list = get().compareList;
    if (list.length < 5 && !list.find((x) => x.id === p.id)) {
      set({ compareList: [...list, p] });
    }
  },
  removeFromCompare: (id) => set({ compareList: get().compareList.filter((p) => p.id !== id) }),
  clearCompare: () => set({ compareList: [] }),

  toggleShortlist: (p) => {
    const list = get().shortlist;
    const exists = list.find((x) => x.id === p.id);
    let next: Player[];
    if (exists) {
      next = list.filter((x) => x.id !== p.id);
    } else {
      next = [...list, p];
    }
    set({ shortlist: next });
    try { localStorage.setItem("fm-scout-shortlist", JSON.stringify(next)); } catch {}
  },
  clearShortlist: () => {
    set({ shortlist: [] });
    try { localStorage.removeItem("fm-scout-shortlist"); } catch {}
  },

  setMinCA: (v) => set({ minCA: v }),
  setMaxCA: (v) => set({ maxCA: v }),
  setMinPA: (v) => set({ minPA: v }),
  setMaxAge: (v) => set({ maxAge: v }),
  setMinAge: (v) => set({ minAge: v }),
  setPositionFilter: (v) => set({ positionFilter: v }),
  setMaxValue: (v) => set({ maxValue: v }),
  setMinValue: (v) => set({ minValue: v }),
  setFootFilter: (v) => set({ footFilter: v }),
  setLeagueFilter: (v) => set({ leagueFilter: v }),
  setShowShortlistOnly: (v) => set({ showShortlistOnly: v }),
  setShowRealisticOnly: (v) => set({ showRealisticOnly: v }),
  setMinFit: (v) => set({ minFit: v }),
  setMinFeas: (v) => set({ minFeas: v }),
  setFormationSlotFilter: (v) => set({ formationSlotFilter: v }),
  setExcludeOwnSquad: (v) => set({ excludeOwnSquad: v }),
  clearAllFilters: () => set({
    searchQuery: "", minCA: null, maxCA: null, minPA: null, maxAge: null, minAge: null,
    positionFilter: "", maxValue: null, minValue: null, footFilter: "", leagueFilter: "",
    showShortlistOnly: false, showRealisticOnly: false, minFit: null, minFeas: null,
    formationSlotFilter: "", excludeOwnSquad: false,
  }),

  exportCSV: async (path) => { await invoke("export_csv", { path }); },
  exportJSON: async (path) => { await invoke("export_json", { path }); },
  writeFile: async (path: string, content: string) => { await invoke("write_file", { path, content }); },
}));
