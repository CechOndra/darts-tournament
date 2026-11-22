# MASTER TECHNICAL SPECIFICATION (`SPEC.md`): MULTI-DEVICE DARTS TOURNAMENT & POWER-CARD ENGINE

Build a production-grade, multi-device Darts Tournament & Live Broadcast web application using **React + TypeScript + Vite + Tailwind CSS** on the frontend, backed by **Supabase (Realtime Broadcast + Presence + Postgres)** for zero-Wi-Fi-password GitHub Pages hosting, with a pluggable transport adapter supporting an optional local Node.js/Socket.io LAN relay.

---

## 0. GIT, GITHUB PAGES CI/CD & HUMAN-IN-THE-LOOP WORKFLOW

- **Repository Hygiene & Secrets:**
  - Initialize `.gitignore` excluding `node_modules/`, `dist/`, `.env`, `.env.local`, and local server data files. Provide a `.env.example` documenting `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_TRANSPORT_MODE`. Never commit real API keys.
- **Automated GitHub Pages Deployment (`.github/workflows/deploy.yml`):**
  - Include a GitHub Actions workflow triggered on push to `main` that installs dependencies, runs `npm run build` (injecting `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from GitHub Secrets), and deploys `dist/` to GitHub Pages.
- **Milestone Commit & Push Protocol:**
  - Work iteratively through clean milestones:
    1. **Milestone 1:** Project scaffold, centralized theme tokens, GitHub Pages CI/CD workflow, `supabase/schema.sql`, and `TournamentTransport` adapter (`SupabaseTransport` + `LocalSocketTransport`).
    2. **Milestone 2:** Immutable data model, 4-tier role auth (`Admin` user/pass, editable `Scorer` PIN + `pinVersion` kickout, Presence multi-scorer alert), and `/#/admin` setup + CSV roster + photo compressor.
    3. **Milestone 3:** Core scoring engine, Dual-Path Checkout Solver, `UP_NEXT` -> `PRE_MATCH` (with manual order override) -> `IN_PROGRESS` -> `POST_MATCH` (with undo) lifecycle on `/#/scorer` and `/#/stage`, and dynamic "Loser Scores Next" duty.
    4. **Milestone 4:** All 17 Power Cards, CS2 Case Opening & Spinning Wheel animations, overflow Keep/Discard swap, and Admin minigame card transfers.
    5. **Milestone 5:** Guest Companion (`/#/`), Crowd Soundboard, Pace/ETA predictor with scheduled breaks, Awards Ceremony view, Printable A4 Deck (`/#/print-cards`), and customizable 6-stat FUT Cards + Canva template overlay.
    6. **Milestone 6:** Optional `/#/board-map` 4-point homography projection mapping, followed by optional visual theme presets/branches (`theme-*`) in `src/index.css` and `src/pages/` without modifying `src/engine/` or `src/services/`.
  - Before every `git commit` and `git push`, run `npm run build` (and engine unit tests) to verify zero TypeScript or bundle errors.
- **Pre-Commit Build & Playwright Multi-Viewport Verification:**
    - Starting from Milestone 2 onward (and whenever UI components or themes are modified), launch the local Vite dev server and use **Playwright MCP** to test `/#/admin`, `/#/scorer` (`1280×720` 16:9 tablet landscape), `/#/stage` (`1920×1080`), and `/#/` (`393×852` iPhone 15 portrait), verifying zero console/runtime errors, zero horizontal overflow, and full interactive flow before stopping the dev server and committing.
- **Human-in-the-Loop Check-In & Asset Request Protocol:**
  - Never stall silently or invent fake credentials/rules. Whenever you need external inputs, repository setup, or design decisions, pause at the end of the current milestone and output a clearly formatted **`ACTION NEEDED FROM USER`** block listing:
    1. **What was just completed & pushed** (commit hash + summary).
    2. **Exact items needed to proceed** (e.g., GitHub remote URL, Supabase URL/Anon Key, running `supabase/schema.sql`, GitHub Pages settings confirmation, or optional transparent PNG drops into `/public/custom-cards/`).
    3. **Any specific clarifying questions** (numbered, with your recommended default noted so the user can simply reply "use defaults").
  - Do not block core development waiting for optional visual assets (such as Canva PNGs or custom memes)—always build with the self-contained SVG/CSS fallbacks first and notify the user when the drop-in folders are ready.

---

## UI DESIGN SYSTEM, THEME TOKENS & ZERO-EMOJI ICONOGRAPHY RULE

- **Device-Specific Responsive Layouts & Fullscreen PWA Support:**
  - **PWA & Browser Fullscreen (`public/manifest.json` + Fullscreen API):** Include a web app manifest (`display: "standalone"`, `apple-mobile-web-app-capable: "yes"`) so Chrome/Brave on tablets and Safari/Chrome on iPhones can launch chromeless via "Add to Home Screen", plus a 1-tap **Fullscreen Toggle button** (`document.documentElement.requestFullscreen()`) in `/#/scorer` and `/#/stage` to hide browser toolbars on 16:9 tablets and projectors. Disable accidental double-tap zoom and pull-to-refresh (`touch-action: manipulation`, `overscroll-behavior: none`) on touch routes.
  - **Table Scorer (`/#/scorer` — 16:9 Landscape Tablet):** Optimize specifically for `16:9` landscape tablets (`1280×720` / `1920×1080`) with a zero-scroll split-screen grid (scoreboard & owned Power Cards on the left, large `>= 48px` 1-tap dart keypad on the right) so operators never have to scroll mid-turn.
  - **Guest Companion (`/#/` — iPhone 13/14/15+ Portrait Reference `390×844pt` to `393×852pt`):** Design mobile-first around iPhone 13–15+ portrait viewports (`390px–430px` width) with `env(safe-area-inset-top)` / `env(safe-area-inset-bottom)` Dynamic Island and home-indicator padding, `16px` minimum input font size (preventing Safari auto-zoom), thumb-friendly bottom navigation tabs (`Live / My Team`, `Schedule`, `Standings`, `Cards / Stats`, `Soundboard`), and zero horizontal overflow.
  - **Admin Panel (`/#/admin` — Desktop Notebook Setup + iPhone Live Ops):** Render a dense multi-column workspace on desktop notebooks (`>= 1024px`) for fast initial tournament setup, collapsing cleanly on iPhones (`390px–430px`) into single-column collapsible accordions with a sticky quick-actions bar (Visibility Toggles, Next Match Override, Card Transfers, PIN Rotation, Scheduled Breaks) for effortless mid-tournament edits from your phone.

- **Strict Logic / UI Separation (For Effortless Whole-App Reskins Later):**
  - Keep all scoring rules, checkout solvers, card eligibility, stat/FUT percentile calculations, pace predictions, and transport sync inside pure TypeScript modules (`src/engine/` and `src/services/`).
  - React pages and components (`src/pages/`, `src/components/`) must remain purely presentational—consuming typed state/hooks and calling `dispatch()` actions without embedding business rules inside JSX.
- **Centralized Whole-App Theme Tokens (`src/index.css`):**
  - Define semantic CSS custom properties (`--bg-primary`, `--bg-surface`, `--bg-elevated`, `--text-primary`, `--text-muted`, `--accent-primary`, `--accent-gold`, `--border-subtle`, `--rarity-common`, `--rarity-silver`, `--rarity-rare`, `--rarity-legendary`) used consistently across **all routes** (`/#/`, `/#/scorer`, `/#/stage`, `/#/admin`, `/#/print-cards`, `/#/board-map`) so swapping colors, flat matte surfaces vs. gradients, or visual themes across the entire app later requires editing only theme tokens and layout classes.
- **Strictly No Emojis:** Do NOT use Unicode emojis (`🎯`, `🏆`, `⚠️`, `🔥`, `📋`, etc.) anywhere in the UI, headings, buttons, badges, card descriptions, or projector overlays.
- **Lightweight Tree-Shaken SVG Icons (`lucide-react`):** Use `lucide-react` (and custom crisp inline SVGs for dartboards, card emblems, and radar charts) across all views. Import only specific named icons so Vite tree-shakes unused icons (~15 KB bundle impact, zero runtime performance cost).

---

## 1. PLUGGABLE REALTIME TRANSPORT & GITHUB PAGES DEPLOYMENT

### 1.1 Static GitHub Pages Routing & Transport Adapter (`src/services/transport/`)
- Configure Vite with `base: './'` and React `HashRouter` (`/#/`, `/#/scorer`, `/#/stage`, `/#/admin`, `/#/print-cards`, `/#/board-map`) so all routes and refreshes work cleanly on **GitHub Pages**.
- Abstract all state synchronization, presence tracking, and live event broadcasting behind a single `TournamentTransport` interface (`connect()`, `dispatch(action)`, `onStateSync(cb)`, `onLiveEvent(cb)`, `onPresenceChange(cb)`, `measureLatency()`):
  1. **`SupabaseTransport` (Primary Default):**
     - Uses `@supabase/supabase-js` Realtime Broadcast (`self: true`) for instant sub-100ms transmission of dart inputs, card-slam animations, spinning wheels / case openings, visibility toggles, and soundboard events.
     - Uses Supabase Realtime Presence to track active `/#/scorer` sessions in real time.
     - Persists full tournament state snapshots and `dart_throws` logs to a Supabase Postgres `tournaments` table (debounced on every visit/match completion) so any browser refresh immediately hydrates the exact live state.
     - Uses UTC epoch timestamps (`shotClockEndsAt`) for the `10s` Shot Clock so `/#/stage` and `/#/board-map` render a smooth 60fps local countdown regardless of network jitter.
  2. **`LocalSocketTransport` (Optional `<10ms` LAN Relay):**
     - Include a lightweight `/server/index.js` (Express + Socket.io bound to `0.0.0.0:3000` with atomic JSON file persistence) implementing the exact same protocol for offline/local-Wi-Fi fallback via `VITE_TRANSPORT_MODE=local`.
- Display a live **Round-Trip Ping Indicator** (`Ping: XX ms`) in `/#/scorer` and `/#/admin`.
- Include **Export Backup (`.json`)** and **Import Backup (`.json`)** buttons in `/#/admin` as an offline safety net.

---

## 2. FOUR-TIER ROLE & SECURITY ARCHITECTURE (NO `localhost` BYPASS)

Enforce strict role separation so guests cannot tamper with data, scorers cannot alter tournament rules, and stepping away from the host laptop exposes zero admin controls:

1. **Admin (`/#/admin` — Accessible from Your Phone or Laptop):**
   - Protected by **Admin Username + Password** configured during tournament creation (verified server-side / via Supabase RPC or hashed credentials, stored in `sessionStorage` with a 1-tap **"Lock Session"** button and **no `localhost` auto-bypass** so nobody can touch settings if you step away from your laptop).
   - **Full Permissions:** Create/reset tournaments, edit match formats per round (`QF`, `SF`, `3rd Place`, `Final`), reorder/skip/force any unplayed match as `"Up Next"`, rename teams/players & upload player photos mid-tournament, modify card weights/counts/rules, switch card draw animation style, transfer/grant Power Cards for side-minigames, rotate the Scorer PIN, control Guest Visibility switches, preview secret Awards & FUT cards, project awards to `/#/stage`, and optionally input/override match scores.
2. **Table Scorer (`/#/scorer` — Dedicated Tablet at the Dartboard):**
   - Protected by a **4-digit Scorer PIN** (editable anytime in `/#/admin`).
   - **Editable PIN & Instant Kickout (`pinVersion`):** Changing the PIN in `/#/admin` increments `pinVersion` and broadcasts a lock event, immediately invalidating all existing `/#/scorer` sessions (`clientPinVersion !== currentPinVersion`) so any unauthorized phone that shoulder-surfed the old PIN is instantly locked out.
   - **Multi-Scorer Intrusion Alert:** Track unlocked `/#/scorer` clients via Realtime Presence. Whenever `activeScorerCount > 1`, display a **large, high-contrast flashing red warning banner** across `/#/scorer` (`"WARNING: MULTIPLE SCORER DEVICES CONNECTED — ROTATE PIN IN ADMIN"`) and an alert badge in `/#/admin` with a 1-tap `"Rotate PIN & Kick All"` action.
   - **Scoped Permissions:** Can **only** operate live matches (start next match, skip/defer unready match, run pre-match starting order + manual override, input/undo darts, activate Power Cards, and trigger post-match card draws). **Cannot** access `/#/admin`, edit tournament rules, rename rosters, or view hidden awards.
3. **Broadcast Stage (`/#/stage` — Host Laptop Extended to Main Projector & Speakers):**
   - Pure kiosk audiovisual display with **zero interactive admin or scoring buttons** on screen. Mirrors the exact match lifecycle (`UP_NEXT` -> `PRE_MATCH` -> `IN_PROGRESS` -> `POST_MATCH`), live checkout routes, card-slam/wheel/case-opening animations, memes, and soundboard audio, plus a scannable QR code pointing to `/#/` so guests join via 4G/5G mobile data without needing the host's Wi-Fi password.
4. **Guests / Players (`/#/` — Player Smartphones):**
   - Zero-login open companion (with optional Team/Player selector saved in `localStorage` purely to highlight their team's matches, table scorer shifts, and Power Cards, while allowing open browsing across all teams' public hands, schedule, and standings).
   - Strictly read-only for tournament state + rate-limited Crowd Soundboard. What stats/awards/FUT cards/ETAs render on `/#/` is governed by the Admin's **Guest Visibility Toggles**.

---

## 3. IMMUTABLE DATA MODEL & CLIENT-SIDE PLAYER PHOTOS

Reference all entities by immutable IDs (`team_01`, `player_01a`, `match_01`, `card_inst_001`)—never by string names—so mid-tournament renaming never corrupts schedules, stats, or standings:

- **`Team`**: `{ id, name, isPlaceholderName: boolean, groupIndex: number, playerIds: string[], hand: CardInstance[] }`
- **`Player`**: `{ id, teamId, name, isPlaceholderName: boolean, avatarDataUrl: string | null }`
  - **Built-In Photo Uploader & Auto-Compressor:** In `/#/admin` (Teams & Roster), each player has an **"Upload / Snap Photo"** button. On file selection, automatically center-crop and resize the image via HTML5 `<canvas>` to `256x256px` JPEG/WebP (`quality: 0.8`, `~20 KB`) and save directly in `avatarDataUrl` so photos sync seamlessly across all devices with zero external storage buckets (falling back to stylized initials if `null`). Display player photos on the **Next-Match Face-Off screen**, **Live Match HUD**, and **FIFA / FUT Player Cards**.
- **`DartThrow`**:
  ```ts
  {
    id: string;
    matchId: string;
    legIndex: number;
    visitIndex: number;
    dartIndex: 1 | 2 | 3 | 4;
    teamId: string;
    playerId: string;
    segment: number; // 0 (Miss), 1..20, 25 (Outer Bull), 50 (Bullseye)
    multiplier: 0 | 1 | 2 | 3; // 0 for Miss, 1 for Single/25/50, 2 for Double, 3 for Triple
    rawPoints: number; // Physical board value (e.g., T20 = 60)
    effectivePoints: number; // Points after card modifiers
    mulliganed: boolean; // True if voided by a Mulligan card (excluded from all stats)
    isCheckoutDart: boolean;
    checkoutType: 'NONE' | 'SINGLE' | 'DOUBLE' | 'TRIPLE' | 'BULL';
    activeCardId: string | null; // Non-null if any score-altering card modified this dart/visit
    timestamp: number;
  }
  ```
- **`CardInstance`**: `{ instanceId: string, cardTypeId: string, pool: 'LOSER' | 'WINNER', ownerTeamId: string | null, status: 'IN_POOL' | 'IN_HAND' | 'DISCARDED' }`

---

## 4. TOURNAMENT SETUP & MOBILE-FRIENDLY ADMIN CONTROL PANEL (`/#/admin`)

Design `/#/admin` to work smoothly on both a **smartphone screen** (single-column accordion cards with big touch targets) and a laptop:

### 4.1 Guest Visibility & Stats Scope Controls (Live Switches)
1. **`showBasicStats` (Default `ON`):** Shows basic player/team stats on `/#/` (3-Dart Average, High Visit, Checkouts Hit).
2. **`showMatchEtas` (Default `ON` once Round 1 completes):** Shows estimated start times (`~HH:MM`) on `/#/` for the user's own next match and the next 4–5 upcoming matches (automatically paused/hidden for any match after an upcoming Scheduled Break).
3. **`showAwardsPreview` (Default `OFF`):** Hides the Awards Leaderboard on `/#/` so award winners stay secret until projected to `/#/stage` during the ceremony (always visible inside `/#/admin`).
4. **`showPlayerFutCards` (Default `OFF` during play -> Admin flips `ON` for reveal):** Hides the FIFA-style FUT Player Cards and 6-axis radar charts on `/#/` until unlocked post-groups or post-tournament (always previewable inside `/#/admin`).
5. **`statsScope` (`"ALL_MATCHES"` vs. `"GROUP_STAGE_ONLY"`, default `"ALL_MATCHES"`):** Applies uniformly to all Team Awards, Individual Awards, and FUT Player Card percentile calculations. When set to `"GROUP_STAGE_ONLY"`, filters `DartThrow` logs to `match.stage === 'GROUP'` so every player is evaluated on an identical number of group-stage matches without extra playoff volume skewing cumulative or streak metrics.
6. **`includeCardAffectedThrows` (Default `OFF`):** When `OFF`, performance awards and FUT stats compute from `rawPoints` on visits where `activeCardId === null` (excluding `mulliganed` darts; physical throws from `EXTRA_DART` and `STEAL_DART` still count normally). When `ON`, recalculates using `effectivePoints` across all non-mulliganed throws.

### 4.2 Teams, CSV Roster Import, Granular Round Formats & Dynamic Scorer Duty
- **Team & Roster Sizing:** `teamCount` (`4`–`16`), `playersPerTeam` (`1`, `2`, or `3`).
- **CSV Bulk Roster Importer:** Multi-line paste box accepting CSV/TSV rows (`teamname, playername 1, playername 2`), auto-skipping headers, stripping leading Google Forms timestamp columns, and auto-adjusting `teamCount`.
- **Placeholder Names & Mid-Tournament Roster Editor:** Blank team names default to `Team A`, `Team B`... (`isPlaceholderName: true`); blank player names default to `Player 1`, `Player 2` (`isPlaceholderName: true`). Amber-highlighted inputs in `/#/admin` let the Admin rename teams, add player names, or upload player photos anytime.
- **Structure & Per-Round Formats:**
  - Mode: `"GROUPS_AND_PLAYOFFS"`, `"GROUPS_ONLY"`, or `"PLAYOFFS_ONLY"`.
  - **Group Stage:** `1`–`4` groups, circle-method round-robin generator avoiding back-to-back games, format (`BO1` / `BO3` / `BO5` / `BO7`).
  - **Playoffs (Per-Round Format Selectors):** Bracket size (`Top 2`, `Top 4`, `Top 8`), toggle for **3rd Place Match**, and **independent format dropdowns per round** (`Quarterfinals`, `Semifinals`, `3rd Place Match`, `Grand Final` — each individually settable to `BO1` / `BO3` / `BO5` / `BO7` and editable live mid-tournament for unplayed matches).
- **Dynamic "Loser Scores Next" Table Duty:**
  - **Match 1:** Assigned automatically to **`Admin (Host)`**.
  - **Match 2 through Final:** Automatically assigned to the **losing team of the just-completed match**, displaying a prominent duty banner on `/#/stage`, `/#/scorer`, and the losing team's phones (`TABLE DUTY: [Losing Team] — 1 on Tablet • 1 gather [Next Team A] & [Next Team B]`). Include a manual scorer-team override selector in `/#/admin` (and automatic fallback to Admin/resting team if a playoff bracket ever requires a team to play back-to-back).
- **Schedule Queue & Match Override:** Admin can reorder upcoming matches or click **"Set as Next Match"** on any unplayed match if a team is delayed.

### 4.3 Game Rules, Starting Order & Modular Special Rules
- **Starting Score:** `301` or `501`.
- **Checkout Mode:** `"STRAIGHT_OUT"`, `"DOUBLE_OUT"`, `"MASTER_OUT"`, or `"HYBRID_SUB_50"`.
- **"Who Throws First" Rule:** `"LOWER_SEED_FIRST"` (with configurable tie-breaker fallback dropdown: `"VIRTUAL_COIN_TOSS"`, `"CLOSEST_TO_BULL_1P"`, `"CLOSEST_TO_BULL_2P"`, `"HIGH_SCORE_2DART_SHOOTOUT"`, `"SCHEDULE_HOME_TEAM"`), `"CLOSEST_TO_BULL_1P"`, `"CLOSEST_TO_BULL_2P"`, `"HIGH_SCORE_2DART_SHOOTOUT"`, `"VIRTUAL_COIN_TOSS"`, or `"MANUAL_CHOICE"`. (Alternates each leg in `BO3+`, re-applying on the deciding leg.)
- **Modular Special Rules (0, 1, or multiple):**
  1. `DOUBLE_CHECKOUT_BONUS` (`+1` configurable tiebreaker point for finishing on `D1–D20` or `Bull 50`).
  2. `TRIPLE_CHECKOUT_BONUS` (`+1` configurable tiebreaker point for finishing on `T1–T20`).
  3. `VISIT_CAP` (optional max visits per team, default `OFF`).
- **Standings Tiebreakers:** `1. Match Wins` -> `2. Special Bonus Points` -> `3. Head-to-Head` -> `4. Leg Differential` -> `5. Pure 3-Dart Average`.

### 4.4 Two-Tier Power Card Economy (17 Cards), Dual Draw Animations & Admin Transfers
- **Master Toggle:** `"OFF"`, `"GROUP_STAGE_ONLY"`, or `"ALL_STAGES"`.
- **Selectable Draw Animation Mode (`cardDrawAnimationStyle` — Editable in Setup & Live Admin):**
  - **`"CS2_CASE_OPENING"`:** Horizontal unboxing viewport on `/#/stage` with a center gold indicator line and a `50`-tile strip generated from active pool weights, placing the deterministically rolled winning card at tile `#42` with seeded near-miss `Legendary Gold` decoy tiles adjacent to `#42`. Each tile displays the card's `lucide-react` icon, title, and a thick CS2-style bottom rarity bar (`Common Grey #9CA3AF`, `Silver Tactical #E2E8F0`, `Rare Blue #3B82F6`, `Legendary Gold #F59E0B`), decelerating over `5.5s` with Web Audio metallic tick clicks per tile crossing and a rarity-tiered reveal fanfare.
  - **`"SPIN_WHEEL"`:** Multi-slice circular prize wheel on `/#/stage` with physics deceleration and Web Audio peg ticks.
- **Circulation Controls:** `startingHandSize` (`0–2`), `loserSpinsPerMatch` (`0–2`), `winnerSpinsPerMatch` (`0–1`), `maxHandSize` (`1–4`), `maxCardsPlayedPerMatch` (`1–3`), `maxCardsPlayedPerLeg` (`1–2`), `expireHandsBeforePlayoffs` toggle, plus a live **Circulation Estimator Pill** showing average cards drawn per team per match.
- **Hand Limit Overflow ("Draw First, Keep or Swap"):**
  - Teams may still draw/spin when `hand.length >= maxHandSize`. When a new card is rolled while at max capacity, display a **"Hand Full — Choose 1 Card to Discard"** modal on `/#/scorer` (mirrored on `/#/stage`) letting the team discard either the newly rolled card or one of their existing cards (returning the discarded card to the physical pool).
- **Pool Structure Toggle:** `"SHARED_POOL"` vs. `"TIERED_POOLS"`:
  - **Loser Pool (Full-Visit / High-Impact Cards):**
    1. `ALL_OR_NOTHING` *(Legendary Gold)*: Play before your turn (`score > 85`); hit `>= quota` (`50`) raw points to subtract extra `bonus` (`25`), else visit scores `0`. Live progress meter on `/#/stage`.
    2. `FIRST_THROW` *(Legendary Gold)*: Play pre-match before Dart 1 to steal first throw in Leg 1 (and Legs 1 & 3 in `BO3`).
    3. `DOUBLE_EDGED_SWORD` *(Legendary Gold)*: Play before your turn; your 3 darts score `2x` (`allowCheckoutOnBoostedDart: false` default), AND opponent gets `2x` on **Dart 1 only** next turn.
    4. `EXTRA_DART` *(Legendary Gold)*: Play before your turn (`dartsThrownInTurn === 0`); you throw **4 darts** instead of 3 on this visit (`maxDartsInTurn = 4`, HUD renders 4 dart slots). Standard checkout/bust rules apply; individual throws count normally toward averages and leg dart counts.
    5. `STEAL_DART` *(Legendary Gold)*: Play before opponent's turn (`dartsThrownInTurn === 0`); opponent only throws **2 darts** instead of 3 on their upcoming visit (`maxDartsInTurn = 2`, HUD renders 2 dart slots and advances after Dart 2).
    6. `PARITY_LOCK_FULL` *(Rare Blue)*: Play before opponent's turn (`opponentScore > 60`); pick `EVEN_ONLY` or `ODD_ONLY` for all 3 darts (`Outer Bull 25` = Odd, `Bull 50` = Even; wrong parity scores `0`).
    7. `BOTTOM_HALF_FULL` *(Rare Blue)*: Play before opponent's turn (`opponentScore > 60`); only segments `1–10` score points for all 3 darts.
    8. `MULLIGAN_ANY` *(Rare Blue)*: Play after Dart 1, 2, or 3 to void that dart (`mulliganed: true`) and rethrow (blocked on bust or `scoreBeforeDart <= 70`).
    9. `RANDOM_POWER` *(Rare Blue — Wildcard Roulette)*: Play at the **start of a visit** (`dartsThrownInTurn === 0`, before own or opponent turn). Dynamically builds a filtered draw containing **only full-visit cards currently legal for the exact board state** (excluding `FIRST_THROW`, `MULLIGAN` cards, `ALL_OR_NOTHING` if active team `score <= 85`, and `PARITY_LOCK` / `BOTTOM_HALF` if opponent `score <= 60`). Disabled if `0` cards are eligible. Animates on `/#/stage` and immediately activates the landed card.
    10. `TEAMMATE_SWAP` *(Common Grey)*: Force opponent team to swap throwers for this visit.
    11. `SHOT_CLOCK` *(Common Grey)*: `10s` (editable) visual/audio countdown on `/#/stage` and `/#/board-map`.
  - **Winner Pool (1-Dart Tactical Cards — Silver Border):**
    12. `PARITY_LOCK_1DART` *(Silver)*: Opponent's **Dart 1 only** must hit `EVEN` or `ODD` or score `0`.
    13. `BOTTOM_HALF_1DART` *(Silver)*: Opponent's **Dart 1 only** only scores if in segments `1–10`.
    14. `WEAK_HAND_1DART` *(Silver)*: Opponent throws **Dart 1** with non-dominant hand.
    15. `STEP_BACK_1DART` *(Silver)*: Opponent throws **Dart 1** from one step behind the oche.
    16. `MULLIGAN_DART1` *(Silver)*: Void and rethrow **Dart 1 only** (`mulliganed: true`, blocked on bust or `score <= 70`).
    17. `SHOWBOAT_DOUBLE` *(Silver)*: Play before your turn; hitting any Double during this visit awards `+0.5` (editable) tiebreaker bonus points even without finishing.
- **Supply Mode Toggle:** `"FINITE_PHYSICAL_POOL"` (synced with printed copy counts; pool odds shrink as copies are held and refill when played) vs. `"FIXED_PROBABILITIES"` (constant `%` weights summing to `100%`).
- **Admin Card Inventory & Side-Game Transfer Tool (`/#/admin`):**
  - Allows the Admin to: (1) **Transfer / Steal a Card** from one team to another (for side-minigames played during downtime), (2) **Grant a Card or Bonus Draw** to any team (triggering the Keep/Discard swap prompt if at `maxHandSize`), and (3) **Return / Void a Card** back to the pool.
- **Protected Mid-Tournament Edits:** Offer retroactive recalculation from saved dart logs if scoring/bonus rules change after matches start; show destructive warning modal if team/group counts change.

### 4.5 Live Match Pace Tracker, Scheduled Breaks & ETA Predictor
- **Automatic Pace Telemetry:** Once **Round 1** (first full rotation of teams) completes, compute `avgSecondsPerLeg` (from `lastDartTimestamp - firstDartTimestamp`, scaled by expected legs per format: `BO1=1.0`, `BO3=2.5`, `BO5=4.0`, `BO7=5.5`) and `avgTurnaroundGapSeconds` between matches (excluding scheduled breaks and clamping outliers `> 12 min`).
- **Scheduled Breaks & Forward Simulation:** Admin can insert named breaks after any match index (e.g., `"Pizza & Minigame Break"` after Match 12, with optional estimated duration in minutes). Continuously project the **Estimated Start Time** (`HH:MM`) for every unplayed match and the **Projected Tournament Finish Time**.
- **Admin vs. Guest Visibility:** `/#/admin` always displays all projected start times (pre- and post-break) plus Projected Tournament Finish Time. `/#/` (when `showMatchEtas` is `ON` after Round 1) shows the user's own next match ETA and the next 4–5 matches, **automatically hiding clock ETAs for any match after an uncompleted Scheduled Break** (showing `"After [Break Name]"` instead).

---

## 5. MATCH-TO-MATCH FLOW ON TABLET (`/#/scorer`) & STAGE (`/#/stage`)

Both `/#/scorer` (with interactive controls) and `/#/stage` (clean button-free broadcast mirror) follow a unified 4-phase match state machine:

1. **Phase 1 — `UP_NEXT` (Next Match Face-Off Lobby):**
   - Displays **Next Match: Team A vs. Team B** with **player photos and nicknames rendered directly beneath each team name**, match round label, and the **Loser-Assigned Table Scorer** duty callout.
   - **On `/#/scorer`:** Displays a large **`[ EVERYONE READY — START MATCH ]`** button, plus a **"Skip / Defer Match"** button (pushing this match down the queue and pulling the next available match so the tournament never stalls if a team isn't ready).
   - **On `/#/stage`:** Mirrors the exact same Face-Off matchup graphic (without buttons), alternating smoothly with Group Standings.
2. **Phase 2 — `PRE_MATCH` (Starting Team, Player Order & Manual Override):**
   - Displays the auto-resolved starting team from the tournament rule (or `"Flip Coin on Stage"` / `"Bull-Up / Shootout Winner"` controls), plus `[ PLAY CARD: FIRST THROW ]` if held by either team.
   - **Manual Pre-Leg Order Override (Available anytime `dartsThrownInLeg === 0`, before or after the rule runs):**
     - Allow the tablet operator to manually toggle **which Team throws first** (`Team A` vs. `Team B`) and **which Player on each team throws first** (`P1` vs. `P2`) before Dart 1 of any leg.
     - Whenever the operator overrides the rule-decided team or player order, display a clear **amber warning notice** on `/#/scorer` (`"Manual Override: Starting order changed from tournament rule — ensure both teams agree before Dart 1"`).
     - Pressing **`Undo Last Dart`** until `dartsThrownInLeg === 0` immediately unlocks the pre-leg team and player order toggles again.
3. **Phase 3 — `IN_PROGRESS` (Live Per-Dart Scoring):**
   - Fast 1-tap per-dart input (`S1–S20`, `D1–D20`, `T1–T20`, `25`, `50`, `Miss 0`, `Undo Last Dart`), real-time Bust validation, tactile buttons for verified owned Power Cards, and live Dual-Path Checkout routes on `/#/stage`.
4. **Phase 4 — `POST_MATCH` (Match Complete, Safety Undo & Power Card Draws):**
   - Displays the final match winner, leg score, match averages, and the **next match's assigned Table Scorer (the losing team)** on both `/#/scorer` and `/#/stage`.
   - **Accidental Finish Undo:** Includes a prominent **`[ UNDO LAST DART (REOPEN MATCH) ]`** button on `/#/scorer` so if the scorer accidentally clicked the wrong winning dart, one tap reverses the checkout, reverts any post-match state, and resumes the leg cleanly.
   - **Post-Match Power Card Draws:** Displays the exact draw buttons defined in settings (e.g., `"Draw Loser Card"` / `"Draw Winner Card"`), triggering the configured CS2 Case Opening or Spinning Wheel animation on `/#/stage` (and the Keep/Discard swap prompt if a hand reaches `maxHandSize`).
   - Tapping **`[ CONTINUE TO NEXT MATCH ]`** advances the state machine directly to Phase 1 (`UP_NEXT`) for the next match in the queue.

---

## 6. ADMIN CEREMONY DASHBOARD, PROJECTOR STAGE & GUEST COMPANION

- **Admin Awards & Ceremony View (Inside `/#/admin`):**
  - **Team Awards:** *Best Team Avg*, *Highest Visit*, *Double Assassins (Most Double Checkouts)*, *Highest Checkout*, *Fastest Leg (Shortest Win — fewest darts)*, *Marathon Leg (Longest Win — most darts)*, *Most Efficient Closer (Best Avg Leg Length — min 2 legs won)*, *The "26" Club (Most 26s)*, *Card Shark (Most Cards Played)*.
  - **Individual Player Awards:** *Tournament MVP (Highest Individual Avg)*, *Triple Hunter (Most Triples)*, *First-Dart Sniper (Highest Dart-1 Avg)*, *Clutch Closer (Most Winning Checkout Darts)*, *Unlucky Legend (Most Busts + Most Times Targeted by Cards)*.
  - Respects `statsScope` (`ALL_MATCHES` vs. `GROUP_STAGE_ONLY`) and `includeCardAffectedThrows` (`OFF` default), and includes a **`Project to Stage`** button on every award card.
- **Projector Stage (`/#/stage`):**
  - High-contrast broadcast HUD, live Dual-Path Checkout Solver (`Gold: DOUBLE BONUS +1 PT` vs. `White: SAFE STRAIGHT-OUT`, updating after every single dart when `score <= 180`), `All or Nothing` live quota bar, animated CS2 Case Opening / Spinning Wheels, Card-Slam overlays, meme overlays (`/public/memes/<category>/` + Web Speech/Audio SFX), and Join QR Code.
- **Guest Companion (`/#/`):**
  - Zero-login open view with optional Team/Player filter (`localStorage`) to highlight their team's matches, table scorer shifts, and Power Card hand while letting anyone browse all teams' public hands, standings, schedule, and allowed stats.
  - Respects Admin `showBasicStats`, `showMatchEtas`, `showAwardsPreview`, and `showPlayerFutCards` switches in real time.
  - 6-button Crowd Soundboard routed to `/#/stage` speakers with Throw-Window Lock (`dartsThrownInTurn > 0` or Shot Clock active), `20s` per-phone cooldown, `4s` global cooldown, and Admin/Scorer Master Mute.

---

## 7. PRINTABLE A4 DECK (`/print-cards`), CUSTOMIZABLE FUT CARDS & CANVA TEMPLATE OVERRIDES

- **Printable A4 Cards (`/#/print-cards`):** `@media print` 3×3 grid (`63mm × 88mm` poker cards with cut lines) synced to configured copy counts.
- **Customizable 6-Attribute FUT Player Cards & 6-Axis Radar Charts (`55–99` Mid-Rank Percentile Scale):**
  - Store an ordered array `futCardAttributes: [StatCode, StatCode, StatCode, StatCode, StatCode, StatCode]` (defaulting to `['AVG', 'PWR', 'STR', 'ACC', 'CON', 'FIN']`) editable in `/#/admin` Setup & Mid-Tournament:
    1. **`AVG` (Scoring Average):** `(Total points scored / Total darts thrown) × 3`.
    2. **`PWR` (Heavy Scoring):** `((Count of 60+ visits) + 2 × (Count of 80+ visits) + 3 × (Count of Trebles hit)) / Total visits`.
    3. **`STR` (Hot Streaks):** Longest consecutive run of quality darts (`S20`, `D20`, `T20`, `25`, `50`, or any `Double`/`Triple`) + `0.05 × (Count of back-to-back 40+ visits)`.
    4. **`ACC` (20s Accuracy):** Percentage of non-checkout setup darts (`scoreBeforeDart > 60`) landing in the `20` wedge (`S20`, `D20`, or `T20`).
    5. **`CON` (Consistency):** Percentage of visits with `0` busts and a turn score `>= 20`.
    6. **`FIN` (Finishing):** `(Checkout Conversion % × 100) + (0.25 × Highest Checkout) + (5 × Double/Triple Checkouts)` (where checkout conversion is `winningCheckoutDarts / dartsThrownWhenScoreBeforeDart <= 60`).
    7. **`DBL` (Double Sniper — Optional):** Total Doubles (`D1–D20`) + Bullseyes (`50`) hit per leg played.
    8. **`OPN` (First-Dart Opener — Optional):** Average points scored on `dartIndex === 1`.
    9. **`CLU` (Clutch Closer — Optional):** 3-dart average on visits starting at `remainingScore <= 120`.
  - Map mid-rank percentiles (`0.0–1.0`) onto `55–99` (`round(55 + 44 * p)`), compute `OVR`, assign `Bronze / Silver / Gold / Icon` frames + player avatar photo + dynamic `Playstyle+` badge, render an interactive **6-Axis SVG Radar Chart** with **"Compare With" overlay defaulting to the player's doubles teammate**, and provide 1-tap **"Download Card as PNG"**.
- **Built-In + Canva PNG Overrides (`/public/custom-cards/`) & Exact Overlay Coordinate Map:**
  - Ships with self-contained HTML/CSS/SVG templates for all Power Cards and FUT cards, automatically swapping in transparent-background Canva PNGs (`fut-bronze.png`, `fut-silver.png`, `fut-gold.png`, `fut-icon.png`, `<card_id>.png`) if placed in `/public/custom-cards/`.
  - When rendering custom Canva FUT card backgrounds (`aspect-ratio: 816 / 1000` portrait shield), position all dynamic layers using condensed bold sports display typography (`Oswald` / `DIN Condensed` in `#3E3114` on Bronze/Silver/Gold frames and `#F8FAFC` on Icon frames) at these exact percentage coordinates:
    - **Top-Left Info Column (`left: 24%` to `34%`, centered on `x = 29%`):** `OVR` rating at `top: 20.5%` (`font-size: ~9.5%` of card height); role tag (`DARTS` / `P1` / `P2`) at `top: 30.2%`; flag/emblem slot at `top: 36.2%` (`width: 9.5%`, `height: 4.8%`); group/team crest slot at `top: 43.0%` (`width: 9.0%`, `height: 6.5%`).
    - **Player Portrait Cutout:** `top: 19.5%`, `left: 38%`, `width: 44%`, `height: 33.5%`, bottom-aligned flush against the diagonal horizon line (`top: 53%`) with `object-fit: cover` and a subtle bottom fade mask.
    - **Player Name Banner:** `top: 55.2%`, `left: 18%`, `width: 64%`, centered uppercase (`font-size: ~5.2%`, auto-scaling for long names).
    - **6-Stat Two-Column Grid (`top: 63.0%` to `82.5%`):** Left column (`left: 23%` to `47%`) rows at `top: 63.5%`, `69.8%`, `76.1%`; Right column (`left: 53%` to `77%`) rows at `top: 63.5%`, `69.8%`, `76.1%`.
    - **Bottom Playstyle+ Badge:** `top: 83.5%`, centered at `x = 50%`.

---

## 8. OPTIONAL STRETCH FEATURE: DARTBOARD PROJECTION MAPPING (`/#/board-map`)

- **Standalone Display Route (`/#/board-map`):** A pure `#000000` black canvas rendering a precision SVG replica of a standard dartboard (all 20 wedges split into Outer Single, Triple, Inner Single, Double, Outer Bull `25`, and Bullseye `50`), subscribed to the same `TournamentTransport` live events.
- **4-Point Homography Calibration Mode (Toggle via `C` key):**
  - Displays a high-contrast calibration wireframe with 4 draggable control handles (`Top`, `Right`, `Bottom`, `Left` outer double-ring anchors) and computes a CSS `matrix3d` perspective transform so the projected SVG aligns accurately with the physical dartboard wires even when a secondary projector is mounted off-axis. Include an **Ambient Board Glow Slider (`0%–50%`)** for dark rooms and persist settings in `localStorage`.
- **Reactive Board Projections:**
  1. **Dart Hit Pulse:** Briefly illuminates the exact hit bed (`segment` + `multiplier`) for `1.2s` upon `DART_THROWN` (with a full-board shockwave ring on `T20`, `Bull 50`, or winning checkout).
  2. **Active Power Card Masks:** Highlights only valid wedges during `PARITY_LOCK` (`EVEN` vs. `ODD` segments) and `BOTTOM_HALF` (`1–10` segments), and renders a shrinking circular ring around the double wire during `SHOT_CLOCK`.
  3. **Subtle Checkout Target Hint (Toggleable):** Softly pulses the primary target segment(s) recommended by the live Checkout Solver when `remainingScore <= 180`.