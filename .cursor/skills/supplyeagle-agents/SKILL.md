---
name: supplyeagle-agents
description: Conventions for the empty SupplyEagle agents NestJS service and how to add the first agent module later. Use when working in apps/agents, adding agent jobs, tools, or workers, or deciding whether work belongs in api vs agents.
---

# SupplyEagle agents

`apps/agents` is a NestJS 12 service that matches `@supplyeagle/api` conventions and is reserved for agents. It is empty beyond health, config, CORS, and ValidationPipe.

## Boundaries

- `apps/api` — HTTP for the web app and other clients.
- `apps/agents` — long-running or internal agent work. The browser does not call it.
- Later, `apps/api` may call agents over HTTP using `AGENTS_URL` (`http://localhost:3001` in `.env.example`). Do not add that client until there is a real agents endpoint.

## Adding the first agent

1. Create `apps/agents/src/<name>/` as a Nest module (module, service, optional controller).
2. Import the module from `AppModule`.
3. Keep `GET /health` working.
4. Prefix new env vars with `AGENTS_`.
5. Share request/response types through `@supplyeagle/types`.
6. Follow the same ESM `.js` import style as the API.

Do not move product CRUD or web-facing REST into this app.
