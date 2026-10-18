import { Sidebar } from "@/components/layout/Sidebar";
import { DashboardPage } from "@/pages/DashboardPage";
import { PlayersPage } from "@/pages/PlayersPage";
import { SquadPage } from "@/pages/SquadPage";
import { YouthPage } from "@/pages/YouthPage";
import { StaffPage } from "@/pages/StaffPage";
import { TransfersPage } from "@/pages/TransfersPage";
import { ComparePage } from "@/pages/ComparePage";
import { ShortlistsPage } from "@/pages/ShortlistsPage";
import { NationalTeamPage } from "@/pages/NationalTeamPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { useAppStore } from "@/stores/useAppStore";

function App() {
  const currentPage = useAppStore((s) => s.currentPage);

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {currentPage === "dashboard" && <DashboardPage />}
        {currentPage === "players" && <PlayersPage />}
        {currentPage === "squad" && <SquadPage />}
        {currentPage === "youth" && <YouthPage />}
        {currentPage === "staff" && <StaffPage />}
        {currentPage === "transfers" && <TransfersPage />}
        {currentPage === "compare" && <ComparePage />}
        {currentPage === "shortlists" && <ShortlistsPage />}
        {currentPage === "national" && <NationalTeamPage />}
        {currentPage === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}

export default App;
