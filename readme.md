# SupplyEagle

TypeScript monorepo for the SupplyEagle web app, API, and agents service.

## Stack

- **web** — Vite, React, React Router, TanStack Query
- **api** — NestJS 12 HTTP API on port 8080
- **agents** — NestJS 12 service on port 8081 (empty besides health)
- **tooling** — pnpm workspaces, Turborepo, shared `@supplyeagle/types`

## Requirements

- Node.js 22.12 or newer
- pnpm 10 (via Corepack or a local install)
- Docker, for the local Postgres container

## Setup

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/agents/.env.example apps/agents/.env
docker compose up -d
pnpm dev
```

Postgres runs locally from [docker-compose.yml](docker-compose.yml) (`postgres:16` on port 5432, database `supplyeagle`). `pnpm db:up` starts the same container.

- Web: http://localhost:3000
- API health: http://localhost:8080/health
- Agents health: http://localhost:8081/health

Open the web app and sign up. The status page loads API health through TanStack Query and the Vite `/api` proxy.
