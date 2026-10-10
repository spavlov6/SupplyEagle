# SupplyEagle

TypeScript monorepo for the SupplyEagle web app, API, and agents service.

## Stack

- **web** — Vite, React, React Router, TanStack Query
- **api** — NestJS 12 HTTP API on port 3000
- **agents** — NestJS 12 service on port 3001 (empty besides health)
- **tooling** — pnpm workspaces, Turborepo, shared `@supplyeagle/types`

## Requirements

- Node.js 22.12 or newer
- pnpm 10 (via Corepack or a local install)

## Setup

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/agents/.env.example apps/agents/.env
pnpm dev
```

- Web: http://localhost:5173
- API health: http://localhost:3000/health
- Agents health: http://localhost:3001/health

The web status page loads API health through TanStack Query and the Vite `/api` proxy.
