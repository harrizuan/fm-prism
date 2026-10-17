<p align="center">
  <img src="https://img.shields.io/badge/FM_Prism-v0.4.0-00ff88?style=for-the-badge&labelColor=18181b" />
  <img src="https://img.shields.io/badge/FM26-Windows-0ea5e9?style=for-the-badge&labelColor=18181b" />
  <img src="https://img.shields.io/badge/Tauri_2-Rust_+_React-f97316?style=for-the-badge&labelColor=18181b" />
  <img src="https://img.shields.io/badge/License-MIT-a855f7?style=for-the-badge&labelColor=18181b" />
</p>

<h1 align="center">FM Prism</h1>

<p align="center">
  A scouting and analysis tool for Football Manager 2026, built on real community research.<br />
  Reads live process memory. Scores 20 tactical roles. Rates transfer feasibility. Analyzes your squad.<br />
  Tauri 2 (Rust + React). 13 MB. Read only. Open source.
</p>

<p align="center">
  <a href="#installation">Install</a> · <a href="#features">Features</a> · <a href="#the-research-behind-it">Research</a> · <a href="#building-from-source">Build</a>
</p>

---

## What this is

FM Prism hooks into a running Football Manager 2026 process and pulls player data straight out of memory. You get the actual CA and PA values, all 54 visible attributes, 13 hidden personality traits, wages, transfer values, contract details, and full position familiarity maps.

What makes it different from a plain data viewer is what happens next. The scoring engine is not guesswork. Every weight and multiplier traces back to published community research: the FM Arena data mining thread (15,951 full engine matches), CAE's role ability work on FM Scout, and the FM Arena position testing table. The README below walks through exactly where each number comes from.

No HTML exports, no file imports, no internet connection needed. You connect, scan, and go.

---

## Features

**Reading from memory**

The Rust backend reads real CA, PA, all 54 attributes (technical, mental, physical, goalkeeping, hidden), wages, values, asking prices, release clauses, contract expiry, transfer status flags, morale, condition, reputation, height, and position familiarity for every position in the game. On a medium database this takes about 8 seconds and pulls in over 76,000 players.

**20 tactical role ratings**

Every player gets scored for 20 FM roles (Advanced Forward, Poacher, Target Man, DLF, Pressing Forward, Complete Forward, AM, Trequartista, Inside Forward, Winger, BBM, DLP, AP, Mezzala, BWM, DM, Wing Back, Full Back, BPD, CD, and GK). Each role score uses a weighted average of key (green) and preferable (blue) attributes, following the same classification the game uses. A small bonus is added for hidden personality traits like consistency and pressure handling, since FM Arena's research shows those are free in terms of CA cost but significant in match output.

**Squad analysis**

The squad page builds your Best XI using an optimal assignment algorithm that considers both role fit and position familiarity together. It does not iterate through slots in formation order (which can steal players from their best position). Instead, it evaluates every possible player/slot combination and assigns the highest scoring pairs first. You get a position depth chart that shows natural count plus cover for every slot, flags critical gaps, and recommends where you need signings.

**Transfer intelligence**

The transfer market page has five tabs. The Smart Picks tab ranks available players using a composite of feasibility score, role fit, whether they fill a weak position in your squad, how much CA they add over your team average, and development potential for young players. Each player gets a transfer feasibility score from 0 to 100 based on seven factors: reputation gap between your club and the player, wage affordability relative to your wage structure, transfer fee relative to your squad value, contract situation, personality (ambition and loyalty), age, and dirtiness risk. You can filter by position (with your current squad counts shown), minimum CA, maximum age, and a "realistic only" toggle that hides anyone below 35 feasibility.

**National team selection**

If you manage a national team, FM Prism builds a 23 man squad. It uses a composite of role score and CA (weighted 50/50 because national teams should pick their best overall players, not just the best role fits). Backup selection uses the same optimal assignment approach so that, for example, a natural AMR does not get pulled into an AML slot just because that slot is processed first.

**Eight scouting scores**

Development trajectory, big game rating, injury risk, pressing intensity, consistency index, set piece threat, value for money, and leadership score. Each one is a composite of the attributes that research shows matter most for that quality. The formulas and their sources are documented in the code.

**Player grid**

Over 60 columns organized into preset views (Overview, Technical, Mental, Physical, Hidden, Scouting, Transfer). TanStack Virtual handles scrolling for 100k+ rows. Filters for CA, PA, age, value, position, foot, league, fit score, feasibility, and formation slot. Wonderkid and Elite quick filters with live counts.

**Everything else**

Side by side comparison for up to 5 players with radar chart overlays. Shortlist manager with star toggle and its own page. League analysis showing every club ranked by average CA. CSV, JSON, and TSV export through native file dialogs. Dark theme.

---

## The Research Behind It

This section documents every source. If you want to verify or improve the numbers, start here.

### Position familiarity

The game rates each player's comfort at every position on a 0 to 20 scale. The official bands, confirmed across sortitoutsi, FM Addict, and FMInside, are:

| Tier | Range | Our multiplier |
|------|:-----:|:--------------:|
| Natural | 18 to 20 | 1.00 |
| Accomplished | 15 to 17 | 0.90 |
| Competent | 12 to 14 | 0.75 |
| Unconvincing | 9 to 11 | 0.60 |
| Awkward | 5 to 8 | 0.40 |

The multiplier values come from FM Arena's [position testing table](https://fm-arena.com/table/19-playing-position-testing/) for FM23 (2,880 matches per tier). Natural scored 52.8 points, Accomplished 45.0 (85%), Competent 39.6 (75%), Unconvincing 31.2 (59%). Our multipliers are rounded to these proportions.

### Role scoring

FM calculates role scores as a weighted average: `sum(attribute * weight) / sum(weights)`. Key (green highlighted) attributes carry more weight than preferable (blue) ones. CAE discovered the exact formula through the pre game editor: `Total Weight = Position Weight + Role Weight * 5`, where green attributes get a role weight of 2 and blue attributes get 1. Full writeup on [FM Scout](https://www.fmscout.com/a-guide-to-player-role-abilities-in-football-manager.html).

We approximate this with a 70/30 split between key and green groups. The effective ratio is about 2.3 to 1, close to the observed 2 to 1 in the game.

### Hidden attribute impact

[FM Arena's FM26 data mining thread](https://fm-arena.com/thread/20264-more-attribute-weight-findings-through-data-mining-fm26/) randomized all 60 attributes across a 20 club league and ran 15,951 full engine matches. Key findings:

- Hidden and personality attributes cost zero CA. They are genuinely free.
- Pressure alone is worth 14.9 points per season at zero cost.
- Work Rate is the best value attribute: 0.33 CA per point, nearly as effective as Pace at a third of the cost.
- Pace and Acceleration are roughly 3x more impactful than anything else.
- Decisions is the worst investment in the game. Second most expensive attribute, negative coefficient.
- No thresholds were found. Attributes pay linearly from 1 to 20.

### Positional attribute weights

From [FM Arena's FM24 experiment](https://fm-arena.com/thread/14201-fm24-experiment-update-new-match-engines-most-important-attributes-for-each-respecitve-positions-with-their-coefficients/) testing each attribute in isolation:

| Position | Top attributes (by coefficient) |
|----------|------|
| AML/AMR | Pace (.023), Acceleration (.021), Anticipation (.015), Dribbling (.014) |
| Striker | Pace (.021), Anticipation (.015), Acceleration (.015), Jumping (.015) |
| Central Mid | Pace (.016), Acceleration (.013), Dribbling (.011), Composure (.011) |
| Centre Back | Jumping (.020), Acceleration (.014), Concentration (.013), Anticipation (.013) |
| Full Back | Acceleration (.014), Jumping (.013), Pace (.012), Anticipation (.012) |
| Goalkeeper | Agility (.013), Aerial Reach (.011), Reflexes (.011), Command (.007) |

---

## Installation

Download from the [Releases](../../releases) page:

- `fm-prism_0.4.0_x64-setup.exe` (NSIS installer, about 3 MB)
- `fm-prism.exe` (standalone portable, about 13 MB)

You need Windows 10 or 11 and Football Manager 2026 running. Launch FM Prism as the same Windows user that is running FM26. No admin privileges required.

**To use it:**

1. Open FM26 and load your save
2. Open FM Prism
3. Hit Connect (it finds the FM26 process on its own)
4. Hit Scan (loads all players in about 8 seconds)
5. Browse, filter, compare, shortlist

---

## How it works

```
FM Prism (Tauri 2)
├── React 19 frontend (WebView2)
│   ├── 8 pages: Dashboard, Squad, Players, Transfers,
│   │           National Team, Compare, Shortlists, Settings
│   ├── TanStack Table + Virtual (60+ columns, 100k rows)
│   ├── Recharts (radar charts, visualizations)
│   └── Zustand (state management)
│
├── Rust backend (14 IPC commands)
│   ├── memory/   Win32 ReadProcessMemory
│   ├── parser/   FM26 offset reader (FMSuperScout verified)
│   ├── commands/ IPC handlers, manager detection
│   └── export/   CSV, JSON, TSV
│
└── Reads from: fm.exe (FM 2026, build 26.3.x)
    via PROCESS_VM_READ (read only, no writes)
```

**On safety:** FM Prism only opens the FM process with `PROCESS_VM_READ`. It never writes to memory, never injects code, never hooks anything. `ReadProcessMemory` cannot crash the target process. Your save files are never touched. This is the same level of access that Task Manager uses. Nothing goes to the internet.

---

## Building from source

You need [Rust](https://rustup.rs/) (stable), [Node.js](https://nodejs.org/) 18 or later with [pnpm](https://pnpm.io/), and the Windows 10/11 SDK.

```bash
git clone https://github.com/harrizuan/fm-prism.git
cd fm-prism

pnpm install
pnpm tauri dev       # development with hot reload
pnpm tauri build     # production build
```

### Project layout

| Path | What is in there |
|------|-----------------|
| `src/` | React frontend: pages, components, stores, type definitions |
| `src/types/player.ts` | Role definitions, scoring engine, scouting composites, transfer feasibility |
| `src/pages/` | Dashboard, Squad, Players, Transfers, NationalTeam, Compare, Shortlists, Settings |
| `src-tauri/src/` | Rust backend: memory access, binary parser, IPC commands, export |
| `src-tauri/src/parser/` | FM26 offset constants and data extraction |
| `src-tauri/src/memory/` | Win32 process memory layer |

### Tech

| | |
|-|-|
| Desktop framework | Tauri 2.12 (Rust, WebView2) |
| Frontend | React 19, TypeScript 5.9, Vite 6, Tailwind CSS 3.4 |
| Data grid | TanStack Table 8 with TanStack Virtual 3 |
| Charts | Recharts 2.15 |
| State | Zustand 5 |
| Icons | Lucide React |
| Win32 | windows crate 0.58 |

---

## Verified offsets (FM 26.3.x)

These are the memory offsets used to read player data. All verified against [FMSuperScout](https://github.com/mavarobli/FMSuperScout).

| Field | Offset | Type |
|-------|--------|------|
| Current Ability | `player + 0x264` | u16 |
| Potential Ability | `player + 0x266` | u16 |
| Positions (15 slots) | `player + 0x150` | 15 x u8 |
| Attributes (54) | `player + 0x15F` | 55 x u8 (stored as value times 5) |
| Guide Value | `player + 0x234` | u32 |
| Height | `player + 0x22E` | u16 |
| Reputation (home/current/world) | `player + 0x25E` | 3 x u16 |
| Wage | `contract + 0x20` | u32 |
| Contract Expiry | `contract + 0x48` | u32 |

---

## Where this fits

FM26 already has good tools. Here is what each one does best:

| Tool | Strength |
|------|----------|
| Genie Scout | Quick lookups, mature interface, supports 20+ languages |
| FMSuperScout | Fast, BepInEx based, development tracking, player cards |
| GlassScout | Detailed squad workspace, tactical board integration |
| FMRTE | Save editing, direct attribute modification |
| FM Prism | Research backed scoring, transfer feasibility, squad optimization, national teams |

If you want scores built on published data mining research rather than star ratings, and you want to see exactly how every number is calculated, this is the one.

---

## Acknowledgments

This project would not exist without the work of these people and communities:

- [FMSuperScout](https://github.com/mavarobli/FMSuperScout) for the verified FM26 offset data
- [GlassScout](https://github.com/TobiasTest22/GlassScout) for early offset reference
- [FM Arena](https://fm-arena.com/) for the attribute testing, position familiarity research, and data mining threads
- [CAE and FM Scout](https://www.fmscout.com/) for the role ability calculator and CA weight research
- [FM Dossier](https://fmdossier.dev/) for the FM26 key vs preferable attribute documentation
- [FM Arena Calculator](https://fmarenacalc.com/) for the FM26 weight normalization methodology

---

## Contributing

Contributions are welcome. If you find a bug or want to improve something, open an issue or send a pull request.

The codebase is straightforward: the Rust side reads memory and serves data over Tauri IPC, and the React side does all the scoring and display logic. The scoring engine lives entirely in `src/types/player.ts` so you can read, verify, or adjust every weight and formula without touching anything else.

If you have FM Arena test data or other research that could improve the weights, that is especially useful.

---

## License

[MIT](LICENSE)
