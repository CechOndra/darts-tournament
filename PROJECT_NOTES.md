# Project notes: Darts Tournament Live

Handover notes for continuing this project on another machine or in a new Claude session.
Read this first, then `SPEC.md` (the original specification). Last updated 2026-11-23.

## Status

- Milestones 1-5 of `SPEC.md` are done and deployed. Milestone 6: theme presets done;
  **dartboard projection mapping (`/#/board-map`) is deliberately postponed** until the
  owner has a projector to calibrate with.
- Lots of extra features came from the owner's feedback after test nights (listed below).
- Next step planned: a real test night on all devices (tablet, PC stage, phones over Supabase),
  then one batch of fixes from the owner's notes.

## Links

- Live site: https://cechondra.github.io/darts-tournament/ (guest), `#/stage`, `#/scorer`,
  `#/admin`, `#/print-cards`, `#/board-map` (placeholder).
- Repo: https://github.com/CechOndra/darts-tournament (public; GitHub Pages deploys from `main`).
- Restore point: git tag **`look-v1`** = the approved look before theme presets.

## Run, test, deploy

- `npm install`, then `npm run dev` (local), `npm test` (Vitest, ~90 tests), `npm run build`.
- `.env.local` (not in git) holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Without it
  the app falls back to a same-browser "loopback" mode (good for testing; data in localStorage).
  `VITE_TRANSPORT_MODE=loopback npx vite` forces loopback for browser tests.
- Deploy = push to `main`. GitHub Actions (`.github/workflows/deploy.yml`): `npm ci`, tests, build
  with repo secrets, publish to Pages. Verify the run without `gh` CLI:
  `curl -s "https://api.github.com/repos/CechOndra/darts-tournament/actions/runs?per_page=1"`.
- Every build writes `version.json`; open screens show "new version, tap to reload" within a
  minute. All devices should run the same version (old cached tablets broke the next-leg hold once).
- **Gotcha:** `npm install <pkg>` on Windows strips the `@emnapi/*` optional entries from
  `package-lock.json` and CI `npm ci` then fails in seconds. After adding a dependency, diff the
  lockfile and restore those entries (or verify with `npm ci` in a temp copy).

## Supabase

- `supabase/schema.sql` is idempotent: re-run the whole file in Supabase Dashboard, SQL Editor,
  New query, paste, Run. It was last extended for the **Admin PIN** (columns on `app_host`,
  `via_pin` on sessions, RPCs `set_admin_pin`, `host_pin_login`). If the owner has not re-run it
  yet, the Admin PIN fails but everything else works.
- Security model: browser holds only the publishable key; all writes go through SECURITY DEFINER
  RPCs with session tokens. One host account; per-tournament 4-digit scorer PIN with
  `pin_version` kickout; optional 6-digit Admin PIN (5 tries, 10 min lock, 4 h sessions).
  pg-safeupdate is on: every DELETE needs a WHERE.
- `npm run verify:supabase` exercises the RPCs.

## Architecture (rules from SPEC section 0, keep them)

- React 19 + TS + Vite (base `./`, HashRouter) + Tailwind v4. Routes are lazy-loaded.
- **Logic only in `src/engine` (pure) and `src/services`**; pages/components are presentational.
- **All colors are tokens in `src/index.css`**; themes are `html[data-theme=...]` token blocks.
- No emojis anywhere. Icons: `lucide-react`.
- State is event-sourced: matches are replayed from `state.throws`; card effects come from
  `state.cards.plays` via `cardEffects.ts`. Undo is strict last-in-first-out across darts and card
  plays. Random choices (draws, Random Power) carry their roll in the action so devices agree.
- Sync: pluggable transport (`SupabaseTransport`, `LocalSocketTransport` + `server/index.js` LAN
  relay, `LoopbackTransport`), delta actions with version gating and snapshot persistence.
- State schema **v6** (`STATE_SCHEMA_VERSION` in `src/engine/state.ts`) with migrations from v2.
  Newer optional fields are read with defaults instead of bumping the version.

## Decisions made with the owner

- Multiple tournaments; one is "live" and stage/scorer/guests follow it (`?t=<id>` pins one).
- Matches freeze the rules they started with; rule changes apply from the next match and never
  rescore finished matches.
- Format/rules, card settings, scorer-tablet settings and FUT stats are edited as drafts with a
  "Review & apply" popup (live-match warning). Visibility / Live Switches apply instantly.
- Double-Edged Sword: a boosted dart that would finish busts (admin toggle can allow it).
- All or Nothing bonus is skipped if it would leave an unfinishable score.
- FIRST_THROW counts toward the per-match card limit, not the per-leg limit.
- One card per targeted visit (mulligans exempt). Played cards go back to the pool.
- Per-card organizer config: on/off, rarity (re-tier), pool, copies or odds, playoffs on/off,
  playoff odds. Printed deck vs unlimited fixed odds.
- Scorer tablet: player order swap is free; admin-only actions (pause, restart, start over) ask
  for the Admin PIN once per action and keep no admin session. "Call admin" banner + ring.
- BO3+: after each leg the tablet must press "Start Leg N"; the stage holds the finished leg.
  After the match-winning dart the stage holds the final leg 12 s, then the summary.
- Pausing a match keeps darts and cards and moves it behind the next match; restarting returns
  played cards to the hands.
- Default keypad: singles / doubles / triples rows (4 layouts, per-tablet override, practice mode).
- Scorer duty rules: loser (default) / winner / team on deck / admin; admin override wins.
- Ultimate Team: one spot per card stat in the order of the 6 card stats, best remaining player.
- Theme presets: Classic (default, unchanged), Pub, TV Broadcast, Daylight, High Contrast, Pop
  (owner's reference look), plus optional main color. Theme block sits at the bottom of Settings.
- Projection mapping postponed (needs a projector to calibrate).

## Feature map (where to look)

- Engine: `match.ts` (replay), `matchReducer.ts` (match flow incl. pause/next leg/order swap),
  `cards*.ts` (Power Cards), `stats.ts` / `awards.ts` (FUT, awards, Ultimate Team), `pace.ts`
  (ETAs), `memes.ts`, `caller.ts` (score caller lines), `soundboard.ts`, `themes.ts`.
- Admin tabs (`src/pages/admin/`): Live (switches, screens + QR, player order, live ops, admin
  PIN, schedule), Results & Standings, Teams, Power Cards, Awards & FUT, Settings.
- Stage extras: `src/pages/stage/` (card animations, memes, score caller, QR, award spotlight).
- Drop-in folders (public, all files downloadable from the site): `public/memes/` (9 placeholder
  .svg; same-name png/jpg/gif/webp replaces; optional mp3), `public/sounds/` (crowd mp3s),
  `public/custom-cards/` (Canva FUT frames and card faces), `public/audio/game-win.mp3`.

## Open follow-ups (owner flagged, not urgent)

- Win song keeps playing during the loser card draw (maybe fade it when a draw starts).
- Shot Clock card needs a remake.
- FUT cards "not perfect yet" (owner likes them; details to come).
- Owner will supply meme images, crowd-sound mp3s, Canva designs, photos and logos.
- Visual tweaks per theme after seeing them on the projector.
- Projection mapping (`/#/board-map`) when a projector is available.

## Working style the owner likes

- Give click-by-click steps for dashboards (Supabase, GitHub): exact buttons and fields.
- Build and tests must pass before every commit; commit and push each finished change; then
  confirm the deploy run is green before saying it is live.
- Test UI changes in a browser at: admin desktop, scorer 1280x720, stage 1920x1080,
  guest 393x852; no console errors, no horizontal overflow.
- End a milestone with an "ACTION NEEDED FROM USER" block when something is required of them.
- Ask before risky or destructive changes; settings that affect a live match need confirmation.
