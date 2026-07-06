# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Smart Agro — a farm management system (orchard + field crops) for a Moldovan cherry/fruit orchard operation. Single Node.js/Express server, PostgreSQL persistence, and a server-rendered multi-page-app frontend with no build step (plain `<script>` tags, no bundler/framework). Deployed on Railway.

## Commands

```bash
npm start        # node server.js — run the server
npm run dev       # node --watch server.js — auto-restart on change
```

No test suite, linter, or build step exists in this repo. There is no `npm install`-time compilation — `public/` is served as-is by Express.

Requires `DATABASE_URL` (Postgres) to persist data; without it the app still boots (falls back to in-memory/no-op DB warnings) and the frontend falls back to `localStorage`.

## Architecture

### Backend (`server.js`, single file, ~1100 lines)

- Express app with hand-rolled static file serving (not `express.static`) so it can set custom `Cache-Control`/MIME headers — see the two middleware blocks near the top and the catch-all `app.get('*', ...)` at the bottom. When adding new static assets under `public/`, no route registration is needed; when adding new HTML *entry pages*, add an explicit `app.get('/route', ...)` before the catch-all.
- Auth is PIN-based, not username/password: `PINS` maps a 4-digit PIN (env vars `PIN_OWNER`, `PIN_AGRONOMIST`, `PIN_DIRECTOR`, `PIN_OPERATOR`) to a role. `POST /api/auth/login` issues a hand-rolled HMAC-SHA256 JWT-like token (`signToken`/`verifyToken`, not a JWT library). The `auth`/`authOpt` middlewares are **effectively disabled in dev**: if no valid token is present they inject a default `req.user` (`owner`/`dev` or `agronomist`/`dev`) rather than rejecting the request. Don't assume `auth` actually blocks unauthenticated requests.
- `/api/auth/users` only supports GET (list hardcoded 4 role accounts) and a no-op DELETE. There is **no** POST/PUT for creating/editing users server-side — the multi-user role-management UI in `public/js/init.js` (`loadRolesUsers`, `changeUserRole`, `openAddUserRoleModal`) calls endpoints (`POST/PUT /api/auth/users`, `x-tenant-id` header, multi-tenant login) that don't exist in `server.js`. Treat that UI code as aspirational/dead until the backend catches up — don't assume it works.
- Persistence model is intentionally simple, not fully normalized:
  - `public.state` (key/JSONB blob) is the main sync mechanism — the entire client `S` app-state object (varieties, cells, warehouse, irrigation config, gddDb, etc.) is dumped as one JSON blob per app (`orchard` / `vegetable`) via `GET/POST /api/state/:key`. This is the primary source of truth the frontend reloads on init.
  - A handful of domain tables (`treatments`, `analyses`, `analysis_pdfs`, `catalog`, `staff`, `tasks`, `equipment`, `attachments`, `weather`, `gps_tracks`, `settings`) exist in parallel and are written to separately for querying/filtering — so some data is duplicated between the blob and normalized tables. When changing a domain object's shape, check both the `S`-blob save path (`save()` in `app.js`) and the corresponding table/route in `server.js`.
  - `crudRoutes(route, table, middleware)` is a generic CRUD factory used for `equipment`/`attachments` (id/name/type/data columns). `staff` and `tasks` have hand-written routes instead because their schema differs (role vs type, status field).
- External integrations, all proxied server-side to avoid browser CORS/secret exposure:
  - **FieldClimate** (weather station, HMAC-signed requests via `fcHeaders()`) — used for both historical (`/api/weather`, `/api/sync-weather`) and forecast (`/api/weather/forecast`) data, with **Open-Meteo as an automatic fallback** if FieldClimate isn't configured or fails.
  - **Wialon** (GPS/fleet tracking) — session-based (`wialonLogin`/`wialonEnsureSession`, session id cached with a 4-min expiry). `/api/wialon/live`, `/api/wialon/track/:unit_id`.
  - A separate, simpler first-party GPS pipeline also exists (`public.gps_tracks` table, `/api/gps`, `/api/gps/live`, `/api/gps/track/:session_id`, `/api/gps/stops`) — this is independent of Wialon and used by `public/gpsmap.js`. Don't conflate the two GPS systems.
  - **Anthropic (Claude) API** — proxied through `callClaude()` for `/api/ai/parse-pdf` (extracting soil/leaf analysis data from uploaded PDFs) and `/api/ai/advisor` (agronomy advice chat).
- `/vegetable` route serves `public/smart-vegetable.html`, which **does not currently exist** in `public/` — that entry point is a known gap, not a bug you introduced.

### Frontend (`public/`, no build step)

- Two (intended) top-level apps sharing the same backend: the orchard app (`cherry-orchard-passport.html`, the default `/` route) and a vegetable-crop app (`smart-vegetable.html`, referenced but not yet built).
- All state lives in one big global object `S` (defined at the top of `public/js/app.js`), covering varieties/rootstocks, spray catalog, treatments, warehouse, irrigation config + readings, weather, GDD/chill data, tasks, AI advisor log, etc. Every module (`catalog.js`, `treatments.js`, `analysis.js`, `irrigation.js`, `warehouse.js`, `weather.js`, `map.js`, `dashboard.js`, `gdd.js`, `fuel.js`, `import.js`, `tasks.js`) mutates this shared `S` directly — there's no module isolation, so cross-file greps for a field name (e.g. `S.irrigation`) are the way to find everywhere it's read/written.
- Load order matters and is fixed by the `<script>` tags at the bottom of `cherry-orchard-passport.html`: `app.js` (state + `API`/`save`/`load` + tabs) loads first, then feature modules, then `init.js` last (kicks off `init()` which populates `S` from the server and renders).
- Persistence is dual-mode, defined in `app.js`: `save()`/`load()` always write/read `localStorage` (`cherry_v5` key) as an instant, offline-first cache, and additionally sync the full state to `POST /api/state/orchard` plus push individual `treatments`/`analyses`/`catalog` rows through the `API` helper object when the server is reachable (`_serverAvailable`, probed by `checkServer()`). When debugging "why didn't my change save," check both paths.
- Multiple crop types (cherry, sour cherry, apricot, apple, …) coexist in the same `S.varieties`/catalog structures, disambiguated by a `cropId` field (e.g. `crop_cherry`, `crop_sour_cherry`, `crop_apple`) rather than separate tables — GDD/chill-portion targets per crop are in the `cropId`-keyed config near `S.crops` in `app.js`.
- Role-based UI gating happens client-side only, in `init.js`: `ROLE_ACCESS` (which tabs a role can see), `ROLE_READONLY` (hides edit/delete buttons via injected CSS), and `applyRoleAccess()` (called from `init()` and again on tab switch). This is presentation-layer only — the backend does not enforce role permissions on API routes beyond the disabled `auth` middleware described above.
- `switchTab(tab, el)` in `app.js` is the router: it toggles `.panel`/`.tab` visibility and calls each panel's `render*()` function on activation (e.g. `renderTreatments()`, `renderIrrigation()`, `renderGdd()`). New tabs need an entry here plus a matching `ROLE_ACCESS` allowlist entry to be visible to non-owner roles.
- `public/gpsmap.js` and `public/js/map.js` both deal with mapping (Leaflet, bundled locally in `public/lib/`) but serve different purposes — `map.js` is the orchard grid/parcel map, `gpsmap.js` is live equipment GPS tracking fed by the `/api/gps/*` endpoints.

## Encoding note

`README.md` is saved as UTF-16LE — reading it with plain UTF-8 tools shows garbled/spaced-out text. Use `iconv -f UTF-16LE -t UTF-8` or an equivalent when reading it directly instead of through the file-read tool.

## Language

Application UI strings, DB content, comments, and commit messages in this repo are predominantly in Russian. Match existing language when editing UI-facing strings.
