# Darts Tournament Live

Multi-device darts tournament scoring, projector broadcast stage and guest companion.
React + TypeScript + Vite + Tailwind, synced over Supabase Realtime (GitHub Pages friendly) or an optional LAN relay.
Full specification: [SPEC.md](SPEC.md).

## Routes (HashRouter)

| Route | Device | Purpose |
| --- | --- | --- |
| `/#/` | Guest phones | Read-only companion |
| `/#/scorer` | 16:9 tablet at the board | PIN-protected live scoring |
| `/#/stage` | Projector | Button-free broadcast display |
| `/#/admin` | Laptop / phone | Setup and live operations |
| `/#/print-cards` | Printer | A4 Power Card deck |
| `/#/board-map` | Second projector | Dartboard projection mapping |

## Development

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL + anon key
npm run dev                  # http://localhost:5173/#/admin
npm test                     # engine + transport unit tests
npm run build                # type-check + production bundle
```

Without Supabase credentials the app falls back to a **loopback** transport (tabs of the same browser sync via `BroadcastChannel`).

## Supabase setup

1. Create a project at supabase.com.
2. SQL Editor -> paste and run [`supabase/schema.sql`](supabase/schema.sql) (safe to re-run; upgrades older versions).
3. Project Settings -> API Keys: copy the Project URL (without `/rest/v1/`) and the publishable / `anon` key into `.env.local` and into the GitHub repo secrets `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
4. `npm run verify:supabase` runs an end-to-end check of every RPC (uses a temporary host account and cleans up after itself while no host is claimed yet).

## Accounts, tournaments & roles

- **Host account** (one per app): claimed on the first visit to `/#/admin`, then username + password. Manages every tournament. "Lock Session" ends it.
- **Tournaments**: create as many as you like (test runs, real events, unfinished ones). Mark one as **Live** — stage, scorer tablet and guest phones follow it automatically. Archive or delete old ones. `?t=<id>` on any display route pins a specific tournament.
- **Scorer PIN**: 4 digits per tournament. "Rotate PIN & Kick All" instantly locks every scorer tablet.

## Deployment (GitHub Pages)

`.github/workflows/deploy.yml` runs tests, builds with the repo secrets, and deploys `dist/` on every push to `main`.
Enable it once under **Settings -> Pages -> Source: GitHub Actions**.

## Optional LAN relay (offline / local Wi-Fi)

```bash
VITE_TRANSPORT_MODE=local npm run build
npm run server               # Express + Socket.io on 0.0.0.0:3000, serves dist/
```

Open `http://<laptop-ip>:3000/#/scorer` on devices on the same network. State is persisted atomically to `server/data/` (git-ignored).

## Architecture

- `src/engine/` — pure TypeScript game rules and reducer (no React).
- `src/services/transport/` — `TournamentTransport` interface with `SupabaseTransport`, `LocalSocketTransport` and `LoopbackTransport`, each lazy-loaded.
- `src/pages/`, `src/components/` — presentational React only.
- `src/index.css` — the single source of theme tokens for every route.
