# SupplyEagle

SupplyEagle watches a buyer’s suppliers and shipping lanes, then turns public evidence into alerts and a short list of actions. A user signs in, adds suppliers and air or sea routes, and a daily scan rechecks them. Identity, sanctions, weather, disasters, and news change a lane or a recommendation only when independent sources agree. Those rules live in code. Claude writes the summaries.

The app is four pages: Overview, Suppliers, Routes, and Recommendations. Accepting a recommendation records the outcome. It does not place an order.

## Architecture

```text
Browser (Vite, React, :3000)
  /api and /socket.io  →  API (NestJS, :8080)  →  Postgres 16
                              Redis pub/sub + BullMQ
                         Agents (NestJS, :8081)  →  public sources, Claude
```

| Package | Path | Role |
| --- | --- | --- |
| `@supplyeagle/web` | `apps/web` | React 19, React Router, TanStack Query, Socket.IO, Leaflet |
| `@supplyeagle/api` | `apps/api` | JWT API, websocket gateway, TypeORM migrations |
| `@supplyeagle/agents` | `apps/agents` | Analysis, route discovery, scan pipeline. No product HTTP |
| `@supplyeagle/types` | `packages/types` | Shared request, response, and event types |

Both Nest apps are ESM. `synchronize` is off. The API runs migrations on startup. Every visible row is scoped by `userId`.

Creating a supplier or route returns immediately. The API inserts a queued analysis and publishes on Redis. An agents worker fetches the sources, stores facts, scores them in code, and asks Claude for prose only when the facts hash changed. The API gateway forwards `analysis.updated` or `route.assessment.updated` to that user’s Socket.IO room, and the page refetches.

## Pipeline

One account has at most one queued or running scan. `claimScan` takes a Postgres advisory lock on `scan-{userId}`. A retried run skips stages already marked completed. The default clock is 08:30. The first authenticated page pins it to the browser time zone. `POST /pipeline/runs` starts a scan now.

| Stage | Job |
| --- | --- |
| Monitoring | Snapshot the account, then refresh every supplier and route |
| Anomaly Detector | Diff the snapshot and open alerts. The same `sourceKey` is not opened twice while one is open or acknowledged |
| Supply Risk | One account summary from the counts. A fixed sentence is stored if Claude is down |
| Supplier Finder | Look for a safer supplier already on this account |
| Decision | Write recommendations. Claude may rephrase the title and description, not the type, priority, or alternative |
| Execution | Attach a three-step plan to recommendations from this run with priority 3 or higher |

## How a score is decided

**Suppliers.** OpenSanctions, GLEIF, and Wikidata. `verified` means GLEIF and Wikidata both matched and their countries agree. `conflicting` means both matched and the countries do not. `partial` is one identity hit. `unverified` is none. A sanctions alert fires only when `sanctionsHit` becomes true. If the summary call fails, that analysis is marked failed.

**Routes.** Origin and destination must both geocode, and Open-Meteo and Nominatim must agree within 50 km. A news finding counts when Google News and ReliefWeb report the same place and hazard across three publisher domains. Weather counts when Open-Meteo and MET Norway both cross the same threshold (wind 75/103 km/h, waves 4/6 m, visibility 1000/200 m). A disaster counts when two of GDACS, EONET, USGS, and ReliefWeb report the same hazard class at the same end. A linked supplier raises the lane when they are sanctioned or their identity is not verified.

The highest rank wins. A corroborated closure or disaster marks the lane `disrupted` and `critical`. Congestion, strike, conflict, extreme weather, or a sanctioned supplier leaves it `active` and `elevated`. Severe weather or an unverified supplier is `watch`. Anything else is `stable`. Transit days are a haversine estimate for display, not an input to the rank. The route’s risk is stored even if the prose summary fails.

**Recommendations** point only at suppliers and routes already on the account:

| Type | When |
| --- | --- |
| `switch_supplier` | Sanctions hit, and another checked supplier on the account is clean |
| `diversify` | Sanctions hit, and no such supplier exists |
| `switch_route` | The lane is disrupted, elevated, or critical, and a related lane on the account is active and lower risk |
| `investigate` | Same lane problems, and no safer lane was found. A watch-only risk increase produces none |

Related means the same ends, a shared supplier, or a shared origin or destination.

## API

Authenticated routes use `Authorization: Bearer`. The SPA stores the token in `localStorage`. Passwords are bcrypt. Tokens last 7 days.

`POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `GET /overview`, `GET|POST /suppliers`, `GET /suppliers/:id`, `POST /suppliers/:id/reassess`, and the same four for `/routes`. Pipeline: `GET /pipeline/status`, `GET /pipeline/runs`, `POST /pipeline/runs`, `PUT /pipeline/clock`. Recommendations: `GET /recommendations?status=`, `GET /recommendations/:id`, `POST .../accept`, `POST .../dismiss`. `GET /health` is public on both services.

Unknown JSON fields are rejected. The socket joins `user:{userId}` and the UI listens for analysis, route, pipeline, schedule, and recommendation events.

Postgres tables follow that model: users, suppliers and their analyses and source checks, routes and their assessments and source checks, a geocode cache, one schedule per user, pipeline runs and stages, alerts, and recommendations.

## Run it

Node.js 22.12 or newer, pnpm 10.18, Docker.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/agents/.env.example apps/agents/.env
# set AGENTS_ANTHROPIC_API_KEY and AGENTS_OPENSANCTIONS_API_KEY
docker compose up -d
pnpm dev
```

Web http://localhost:3000, API health http://localhost:8080/health, agents health http://localhost:8081/health. Postgres and Redis come from `docker-compose.yml` (`pnpm db:up` is the same). Weather, news, and disaster feeds need no keys. Without the Anthropic key, supplier summaries fail after the facts are collected. Without the OpenSanctions key, that source errors and sanctions stay unknown.

```bash
pnpm check-types
pnpm lint
pnpm build
pnpm --filter @supplyeagle/web test
pnpm --filter @supplyeagle/api test
pnpm --filter @supplyeagle/agents test
```

Read these first. They are pure and tested: `apps/agents/src/analysis/confidence.ts`, `apps/agents/src/route-discovery/signals.ts`, `apps/agents/src/route-discovery/risk.ts`, `apps/agents/src/pipeline/decide.ts`, `apps/agents/src/pipeline/claim-scan.ts`.
