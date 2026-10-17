# FM Scout Pro — Test Plan & Feature Audit

> Generated: 2026-10-18 | Version: 0.4.5 — Feasibility v2 (actual club rep + league tier)  
> Audit every feature one-by-one after each build.

---

## Architecture

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Backend** | Rust (Tauri 2) | FM26 memory reading, process attach, data parsing |
| **Frontend** | React 19 + Zustand + Tailwind | UI, state management, derived calculations |
| **Export** | TSV/CSV/JSON + AI Brief | Data export for external analysis |

---

## Bugs Fixed in v0.4.1–v0.4.3

| # | Bug | Root Cause | Fix | Version |
|---|-----|-----------|-----|---------|
| B7 | 45 key/preferable misclassifications | Role attrs based on FM25 or incorrect sources | Rewritten against sortitoutsi FM26 complete guide | v0.4.1 |
| B8 | Winger Technique wrongly demoted to green | FM Dossier incorrectly called it blue/preferable | Reversed: Technique is KEY per sortitoutsi + fm26tactics | v0.4.1 |
| B9 | Inside Forward missing work_rate + stamina | Code had 8/10 green attrs, sortitoutsi says 10 | Added work_rate, stamina | v0.4.3 |
| B10 | Inside Winger missing stamina | Code had 10/11 green attrs | Added stamina | v0.4.3 |
| B11 | BBM missing 5 greenAttrs | Code had 9/14 green attrs (finishing, long_shots, aggression, balance, pace missing) | Added all 5 — was causing major false pos/neg | v0.4.3 |
| B12 | Wing-Back missing concentration + balance | Code had 9/11 green attrs | Added concentration, balance | v0.4.3 |
| B13 | NationalTeamPage 50/50 IP/OOP weighting | slotScore() used (ip+oop)/2, SquadPage uses ip*0.6+oop*0.4 | Fixed to ip*0.6+oop*0.4 — consistent everywhere | v0.4.3 |
| B14 | creativity field misleading | FM26 renamed Creativity→Vision; parser maps both creativity and flair to raw[26] | Added documentation warning | v0.4.3 |
| B15 | Transfer position dropdown all "0 in squad" | squadPosStrength counted by bestFormationFit slot label (DCL/DCR/DML/DMR) which never matched dropdown keys (DC/DM). MC/ML/MR/WBL/WBR not in BEST_LLM_SLOTS at all. | Count by actual position familiarity ≥15 (Accomplished+) | v0.4.3 |
| B16 | Feasibility rep gap used raw squad avg world rep | clubAvgWorldRep (~2500) ≈ player WorldRep for mid-tier players, so gap appeared ~0 even when FM refuses. Club rep is much lower than player avg rep for lower-league clubs. | Use estimated club rep (65% of avg player world rep) | v0.4.4 |
| B17 | Ambition penalty too weak (-8) | FM gives absolute refusal ("under any circumstances") when ambition ≥16 and rep gap >1000, but engine only penalised -8 | -25 for amb≥16 + gap>1000; -15 for amb≥12 + gap>1500; -12 for amb≥16 + gap>500 | v0.4.4 |
| B18 | Feasibility used squad_avg_world_rep (~2500) for all reputation checks | FM uses CLUB reputation for signing willingness, not average player world rep. For Notts Co (League Two), club rep is much lower than squad avg world rep, masking the real gap. | Changed to use `club_reputation` from ManagerProfile directly. All 6 call sites updated. | v0.4.5 |
| B19 | No league tier awareness in feasibility | FM has a minimum league tier threshold — players at National rep+ tier refuse Local tier (League Two) clubs regardless of other factors | Added tier classification (local/regional/national/continental/world) with -12 to -45 penalty for tier mismatches | v0.4.5 |

## Bugs Fixed in v0.3.0

| # | Bug | Root Cause | Fix |
|---|-----|-----------|-----|
| B1 | Playmaker roles double-counting flair | Rust parser maps both `creativity` and `flair` to `raw[26]` (same offset). ROLES referenced `creativity` for AM/TQ/DLP/AP/MEZ. | Replaced all `creativity` → `vision` (raw[10]) in ROLES definitions |
| B2 | National team all subs show "DL" | `r.short` instead of `r.role.short` in `slotScore()` — ALL role scores = 0 | Rewrote with `roleScore()` helper using correct `r.role.short` path |
| B3 | DM players assigned to DR | Greedy slot-order filling: GK→DL→DCL→DCR→DR stole DM-natural players before DM slots | Two-pass `buildOptimalXI()`: Pass 1 natural-only (posR ≥ 14) + scarcity ordering |
| B4 | Shortlist lost on reload | Zustand store had no persistence | localStorage save/load pattern |
| B5 | Shortlist stale after rescan | localStorage stores old Player snapshots; after rescan, CA/PA/value are outdated | Hydrate shortlist IDs against fresh `players[]` after every scan |
| B6 | Youth players invisible | Players at same club but in U21/U18 not shown | Filter all-players by `club_name` match but NOT in `squadIds` |

---

## 1. Dashboard Page

| # | Feature | Test Case | Status |
|---|---------|-----------|--------|
| 1.1 | FM connection | Click "Connect to FM" → shows PID, window title | ✅ |
| 1.2 | Load/Rescan | Click "Load Players" → progress bar → player count | ✅ |
| 1.3 | Manager profile card | Shows club, manager, league, nationality, squad value | ✅ |
| 1.4 | Stat cards (6) | Total Players / Wonderkids / Elite / Listed / Bargains / Free Agents | ✅ |
| 1.5 | Stat card click | Each card sets filters and navigates to Players page | ✅ |
| 1.6 | Top 15 by CA | Sorted desc, shows name + position + role + club + CA | ✅ |
| 1.7 | League overview | Top 10 leagues by avg CA, correct player counts | ✅ |
| 1.8 | Wonderkid def | PA ≥ 150 AND age ≤ 21 | ✅ |
| 1.9 | Bargain def | CA ≥ 120 AND value < £10M | ✅ |
| 1.10 | Role display | `roles[0].role.short` (not `r.short`) | ✅ Fixed B2 |

## 2. Players Page

| # | Feature | Test Case | Status |
|---|---------|-----------|--------|
| 2.1 | Search | Type name/club/nation → live filter | ✅ |
| 2.2 | Position filter | Dropdown 14 positions | ✅ |
| 2.3 | CA/PA range | Min CA, Max CA, Min PA sliders work | ✅ |
| 2.4 | Age range | Min Age, Max Age | ✅ |
| 2.5 | Foot filter | Right/Left/Either | ✅ |
| 2.6 | League filter | Top 80 leagues by player count | ✅ |
| 2.7 | Value range | Min/Max value filters | ✅ |
| 2.8 | Formation slot | Best LLM quick-pick (GK,DL,DC,DR,DM,AML,AMC,AMR,ST) | ✅ |
| 2.9 | Fit ≥ filter | Minimum formation fit score | ✅ |
| 2.10 | Feasibility ≥ | Minimum transfer feasibility score | ✅ |
| 2.11 | Shortlist only | Toggle ★ filter | ✅ |
| 2.12 | Realistic only | Toggle 🎯 (feas ≥ 45) | ✅ |
| 2.13 | Exclude squad | Hide own players | ✅ |
| 2.14 | Active filter chips | Each filter shows removable chip | ✅ |
| 2.15 | Clear all filters | Resets everything | ✅ |
| 2.16 | CSV export | Save dialog → .csv file | ✅ |
| 2.17 | JSON export | Save dialog → .json file | ✅ |
| 2.18 | Player detail | Click row → right panel with full attributes | ✅ |
| 2.19 | Column picker | Toggle visible columns with presets | ✅ |
| 2.20 | Sort columns | Click header → asc/desc toggle | ✅ |
| 2.21 | Wonderkid preset | Sets PA≥150, Age≤21 | ✅ |
| 2.22 | Elite preset | Sets CA≥150 | ✅ |
| 2.23 | Scouting preset | Shows all 14 scouting intelligence columns | ✅ New |
| 2.24 | Virtualized scroll | 98K rows with 60fps scroll (tanstack-virtual) | ✅ |

## 3. My Squad Page

| # | Feature | Test Case | Status |
|---|---------|-----------|--------|
| 3.1 | Formation pitch | 11 starters on visual pitch | ✅ |
| 3.2 | Formation tabs | best-llm / 4-3-3 / 4-4-2 / 3-5-2 / 4-1-2-3 with fit% | ✅ |
| 3.3 | Two-pass assignment | Natural-first: DMs go to DM, not DR | ✅ Fixed B3 |
| 3.4 | Starters + Subs | 11 starters + 11 subs per formation | ✅ |
| 3.5 | Bench section | Remaining players | ✅ |
| 3.6 | U21/U18 section | Club players NOT in first team, collapsible | ✅ Added |
| 3.7 | Youth "Ready" | CA ≥ 80 highlighted in youth section | ✅ |
| 3.8 | Hierarchy badges | C (captain), VC, ★ (star), ↑ (prospect) | ✅ |
| 3.9 | Position depth | Right sidebar shows depth per slot | ✅ |
| 3.10 | Player detail panel | Click any player → full detail sidebar | ✅ |
| 3.11 | Fit % display | Combined IP/OOP fit per slot | ✅ |
| 3.12 | Condition bar | Player condition percentage | ✅ |
| 3.13 | Insights strip | Weakest/Strongest slot, age profile, growth, dirty, pressure | ✅ |
| 3.14 | League ranking | Our rank among league clubs | ✅ |
| 3.15 | AI Brief export | Generates 3 files in fm-db/ | ✅ |
| 3.16 | Radar chart | Tech/Mental/Physical/Attack/Defend/Create (GK: own radar) | ✅ |

## 4. Transfers Page

| # | Feature | Test Case | Status |
|---|---------|-----------|--------|
| 4.1 | Listed tab | Players with is_listed or "Listed"/"Release" status | ✅ |
| 4.2 | Free Agents tab | No club_name or "Free Agent" | ✅ |
| 4.3 | Expiring tab | Contract expires within 18 months | ✅ |
| 4.4 | On Loan tab | is_on_loan flag | ✅ |
| 4.5 | Sort by column | CA/PA/Age/Value/Wage/Fit/Feas/Name | ✅ |
| 4.6 | Feasibility score | Color-coded score per player | ✅ |
| 4.7 | Own-squad dimmed | squadIds players shown at 50% opacity | ✅ |
| 4.8 | Shortlist toggle | ★ per row | ✅ |
| 4.9 | Compare add | Add to compare from row | ✅ |
| 4.10 | Player sidebar | Click row → sidebar with full detail (no page nav) | ✅ Added v0.4.3 |
| 4.11 | Position counts | Dropdown shows squad count by position familiarity ≥15 | ✅ Fixed B15 v0.4.3 |

## 5. National Team Page

| # | Feature | Test Case | Status |
|---|---------|-----------|--------|
| 5.1 | Nation detection | Uses manager nationality from profile | ✅ |
| 5.2 | 1st nationality | Filter all players by nationality match | ✅ |
| 5.3 | Role scoring | `r.role.short` NOT `r.short` | ✅ Fixed B2 |
| 5.4 | Best XI | Two-pass natural-first, GK gate | ✅ Fixed |
| 5.5 | 23-man squad | XI→2 GK backup→slot backups→fill to 23 | ✅ Rewritten |
| 5.6 | Position groups | GK/DEF/MID/ATT by natural position | ✅ |
| 5.7 | XI badge | Green "XI" for starters | ✅ |
| 5.8 | Slot labels | Each player shows correct formation slot | ✅ Fixed (was all "DL") |
| 5.9 | Fit % per player | Role score × position familiarity | ✅ |
| 5.10 | Formation switch | 4-2-3-1 / 4-3-3 / 4-4-2 / 3-5-2 | ✅ |
| 5.11 | Formation depth | Top 4 per unique slot in formation | ✅ |
| 5.12 | Persuasion targets | 2nd nationality filter | ⚠️ Offset calibration needed |
| 5.13 | 2nd nat display | Amber "2nd" badge | ✅ |
| 5.14 | Pitch visualization | XI on formation pitch with CA + position fit | ✅ |
| 5.15 | Average XI CA | Header shows XI avg CA | ✅ |
| 5.16 | IP/OOP weighting | slotScore uses 60% IP + 40% OOP (same as SquadPage) | ✅ Fixed B13 v0.4.3 |

## 6. Compare Page

| # | Feature | Test Case | Status |
|---|---------|-----------|--------|
| 6.1 | Up to 5 players | Max compare list enforced | ✅ |
| 6.2 | Radar chart | 12-axis overlay with colors | ✅ |
| 6.3 | Attribute sections | Technical + Mental + Physical + Hidden | ✅ |
| 6.4 | Best highlight | Green underline for highest per attr | ✅ |
| 6.5 | Value/Wage/Height | Compared in header cards | ✅ |
| 6.6 | Remove player | X button per card | ✅ |
| 6.7 | Clear all | Trash button | ✅ |

## 7. Shortlists Page

| # | Feature | Test Case | Status |
|---|---------|-----------|--------|
| 7.1 | List all starred | Shows all shortlisted players | ✅ |
| 7.2 | Remove individual | Un-star per player (X button) | ✅ |
| 7.3 | Clear all | Trash button | ✅ |
| 7.4 | Navigate to detail | Click → Players page with detail | ✅ |
| 7.5 | Feasibility shown | Score per player | ✅ |
| 7.6 | Add to compare | GitCompare button | ✅ |
| 7.7 | Persistence | Survives page reload via localStorage | ✅ Fixed B4 |
| 7.8 | Hydration | Updated after rescan — no stale data | ✅ Fixed B5 |

## 8. Sidebar Navigation

| # | Feature | Test Case | Status |
|---|---------|-----------|--------|
| 8.1 | 8 nav items | Dashboard/Squad/Players/Transfers/National/Compare/Shortlists/Settings | ✅ |
| 8.2 | Hover expand | Width 14→52 on hover | ✅ |
| 8.3 | Active highlight | Green bg + accent border | ✅ |
| 8.4 | Badge counts | Shortlist + Compare counts | ✅ |
| 8.5 | Rescan button | Spins while loading | ✅ |
| 8.6 | Connection status | Green/Yellow/Red indicator | ✅ |
| 8.7 | Player count | Shows total after connection | ✅ |

## 9. AI Brief Export

| # | Feature | Test Case | Status |
|---|---------|-----------|--------|
| 9.1 | profile.md | Manager, squad stats, needs, league | ✅ |
| 9.2 | squad.tsv | 26 cols, full attributes for squad | ✅ |
| 9.3 | all-players.tsv | 76K players, all fields | ✅ |
| 9.4 | Auto-gen on scan | Triggers after every load/rescan | ✅ |
| 9.5 | Squad needs | 14 positions with critical/thin/ok/deep | ✅ |

## 10. Role Ratings Engine (27 Roles)

All role key/preferable classifications verified against [sortitoutsi FM26](https://sortitoutsi.net/content/75078/fm26-important-attributes-for-every-role). Five legacy roles (marked ⚠️) have no exact FM26 IP match and use approximated attributes.

| # | Role | Short | Positions | Key + Green | Source |
|---|------|-------|-----------|-------------|--------|
| 10.1 | Advanced Forward | AF | ST | 7 + 4 | ⚠️ Legacy approximation |
| 10.2 | Poacher | P | ST | 7 + 4 | sortitoutsi FM26 ✅ |
| 10.3 | Target Man | TM | ST | 9 + 4 | sortitoutsi FM26 ✅ |
| 10.4 | Deep-Lying Forward | DLF | ST | 6 + 7 | sortitoutsi FM26 ✅ |
| 10.5 | Pressing Forward | PF | ST | 8 + 4 | ⚠️ Legacy approximation |
| 10.6 | Complete Forward | CF | ST | 8 + 8 | sortitoutsi FM26 ✅ |
| 10.7 | False Nine | F9 | ST | 10 + 5 | sortitoutsi FM26 ✅ |
| 10.8 | Channel Forward | ChF | ST | 8 + 9 | sortitoutsi FM26 ✅ |
| 10.9 | Attacking Midfielder | AM | AMC | 7 + 8 | sortitoutsi FM26 ✅ |
| 10.10 | Trequartista | TQ | AMC | 8 + 5 | ⚠️ Legacy approximation |
| 10.11 | Second Striker | SS | AMC | 6 + 10 | sortitoutsi FM26 ✅ |
| 10.12 | Inside Forward | IF | AML/AMR | 8 + 10 | sortitoutsi FM26 ✅ |
| 10.13 | Wide Forward | WF | AML/AMR | 8 + 8 | sortitoutsi FM26 ✅ |
| 10.14 | Winger | W | AML/AMR/ML/MR | 7 + 8 | sortitoutsi FM26 ✅ |
| 10.15 | Inside Winger | IW | AML/AMR/ML/MR | 7 + 11 | sortitoutsi FM26 ✅ |
| 10.16 | Wide Midfielder | WM | ML/MR | 7 + 8 | sortitoutsi FM26 ✅ |
| 10.17 | Box-to-Box Midfielder | BBM | MC | 6 + 14 | sortitoutsi FM26 ✅ |
| 10.18 | Deep-Lying Playmaker | DLP | MC/DM | 8 + 8 | sortitoutsi FM26 ✅ |
| 10.19 | Advanced Playmaker | AP | MC/AMC | 8 + 6 | sortitoutsi FM26 ✅ |
| 10.20 | Mezzala | MEZ | MC | 7 + 5 | ⚠️ Legacy approximation |
| 10.21 | Ball-Winning Midfielder | BWM | MC/DM | 7 + 5 | ⚠️ Legacy approximation |
| 10.22 | Defensive Midfielder | DM(d) | DM | 5 + 9 | sortitoutsi FM26 ✅ |
| 10.23 | Half-Back | HB | DM | 9 + 8 | sortitoutsi FM26 ✅ |
| 10.24 | Wing-Back | WB | WBL/WBR | 8 + 11 | sortitoutsi FM26 ✅ |
| 10.25 | Full-Back | FB | DL/DR | 7 + 9 | sortitoutsi FM26 ✅ |
| 10.26 | Ball-Playing Defender | BPD | DC | 9 + 8 | sortitoutsi FM26 ✅ |
| 10.27 | Central Defender | CD | DC | 7 + 6 | sortitoutsi FM26 ✅ |
| 10.28 | Goalkeeper | GK | GK | 8 + 5 | sortitoutsi FM26 ✅ |

**v0.4.1 fix**: 45 attribute misclassifications fixed across 15 roles.
**v0.4.2**: 7 new FM26 roles added (F9, ChF, SS, WF, IW, WM, HB).
**v0.4.3 fix**: 4 roles had missing green attrs (IF+2, IW+1, BBM+5, WB+2). NationalTeamPage IP/OOP weighting fixed to 60/40.

## 11. Transfer Feasibility Engine

| Factor | Weight | Range | Research Basis |
|--------|--------|-------|---------------|
| Reputation gap | 35pts | club vs player world_rep | Primary willingness factor |
| Wage affordability | 15pts | ratio vs highest squad wage | Wage structure impact |
| Transfer fee | 12pts | price vs total squad value | Budget constraint |
| Contract status | 12pts | listed/release/expiry/NFS | Availability signal |
| Personality | 12pts | ambition + loyalty + temperament | Hidden attr impact |
| Age modifier | 8pts | young=development, old=step-down | Career stage heuristic |
| Dirtiness penalty | 3pts | dirtiness ≥ 16 | Card/suspension risk |
| **Hard caps** | — | repGap>4000→max 8, >3000→max 20 | Prevents false positives |

## 12. Scouting Intelligence Engine (NEW v0.3.0)

Research-backed composite scores that distill complex multi-attribute interactions.

| # | Score | Range | Formula Summary | Research Basis |
|---|-------|-------|----------------|---------------|
| 12.1 | Development Trajectory | 0-100 | (PA-CA) × age_factor × professionalism × ambition × determination | FM community regression: pro is #1 dev predictor (~35%) |
| 12.2 | Big Game Rating | 0-100 | pressure×.25 + imp_matches×.25 + composure×.20 + concentration×.15 + consistency×.15 | ~25% of matches are "important"; low-pressure players drop 15-30% |
| 12.3 | Injury Risk Index | 0-100 | inj_prone×5 - nat_fitness×1.2 - pro×0.4 + excess_aggression | Injury proneness is primary; natural fitness = recovery speed |
| 12.4 | Pressing Intensity | 0-100 | work_rate×.22 + stamina×.18 + aggression×.13 + det×.10 + teamwork×.10 + pace×.09 + acc×.09 + ant×.09 | For gegenpress systems; work_rate < 12 = system breaks |
| 12.5 | Consistency Index | 0-100 | consistency×.40 + imp_matches×.20 + pressure×.15 + temperament×.10 + pro×.15 | Consistency hidden attr is THE primary factor |
| 12.6 | Set Piece Threat | 0-100 | free_kick×.20 + corners×.15 + crossing×.15 + heading×.15 + technique×.10 + composure×.10 + long_shots×.10 + flair×.05 | Set pieces = ~30% of professional goals |
| 12.7 | Value Efficiency | 0-100 | CA_per_million × age_multiplier (young=premium, peak=1.0, old=discount) | FM overvalues youth by ~40%, undervalues 28-31 peak |
| 12.8 | Leadership Score | 0-100 | leadership×.30 + determination×.20 + teamwork×.15 + composure×.12 + bravery×.08 + pro×.08 + temperament×.07 | Identifies captains and dressing room influence |

### Hidden Attribute Bonus (Role Ratings)

Applied to ALL 19 role ratings as "free CA" bonus:
| Attribute | Impact | Bonus Range | Research |
|-----------|--------|-------------|---------|
| Consistency | 15% of performances | 0-3 pts | Zealand's match engine analysis |
| Pressure | 12% of performances | 0-2.5 pts | High-stakes match regression |
| Important Matches | 10% of performances | 0-2 pts | Cup/derby correlation data |
| Professionalism | 8% (training gain) | 0-1.5 pts | Development speed multiplier |
| **Total max bonus** | | **9 pts** | |

---

## Known Limitations

1. **2nd Nationality** — Memory offset (0x78/0x80/0x90) not calibrated for FM26; 0 persuasion targets
2. **U21/U18 tier** — Cannot distinguish U21 from U18 (same club_name in memory)
3. **Keyboard shortcuts** — Listed in Settings but not actually wired
4. **Settings page** — No user-configurable options yet
5. **Scatter plot explorer** — Planned but not implemented
6. **.fmf export** — Shortlist file export not implemented
7. **Creativity field** — Rust parser sends `creativity` as duplicate of `flair` (raw[26]); frontend now correctly uses `vision` for all playmaker roles
