export function SettingsPage() {
  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <h1 className="text-2xl font-bold text-zinc-100 mb-6">Settings</h1>
      <div className="max-w-lg space-y-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">About</h3>
          <p className="text-sm text-zinc-400">
            <strong className="text-zinc-200">FM Prism</strong> v0.4.0
          </p>
          <p className="text-sm text-zinc-500 mt-1">
            A modern scouting tool for Football Manager 2026.
            Reads live game memory to display all player data including hidden attributes.
          </p>
          <p className="text-xs text-zinc-600 mt-3">
            Built with Tauri (Rust) + React + TypeScript + Tailwind CSS
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Keyboard Shortcuts</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-zinc-400">
              <span>Search players</span>
              <kbd className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-300">Ctrl + K</kbd>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Toggle filters</span>
              <kbd className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-300">Ctrl + F</kbd>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Compare mode</span>
              <kbd className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-300">Double-click row</kbd>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Data</h3>
          <p className="text-xs text-zinc-500">
            This tool reads Football Manager's process memory in <strong>read-only</strong> mode.
            It never writes to FM's memory — your save game is always safe.
          </p>
        </div>
      </div>
    </div>
  );
}
