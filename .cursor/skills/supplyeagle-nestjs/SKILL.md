---
name: supplyeagle-nestjs
description: NestJS 12 conventions for the SupplyEagle API and agents services, including ESM imports, health, config, CORS, and ValidationPipe. Use when editing apps/api or apps/agents, adding Nest modules, or aligning the two services.
---

# SupplyEagle NestJS

Both `@supplyeagle/api` (port 3000) and `@supplyeagle/agents` (port 3001) are independent Nest 12 ESM apps (`"type": "module"`, `module`/`moduleResolution`: `nodenext`).

## Imports

Use explicit `.js` specifiers for local files:

```ts
import { HealthService } from './health.service.js';
```

Use `import type` for `@supplyeagle/types`. Do not import runtime values from that package until it has a compile step.

## App bootstrap

Keep this stack in `main.ts`:

- `ConfigModule.forRoot({ isGlobal: true })` in `AppModule`
- `enableCors` from `CORS_ORIGIN` (default `http://localhost:5173`)
- global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, `transform`
- listen on `PORT` from env (api 3000, agents 3001)

Copy new env keys into `.env.example`. Prefix agents-only keys with `AGENTS_`.

## Modules

Add features as Nest modules (`*.module.ts`, controller, service). Import them from `AppModule`. Do not dump product routes on `AppController`.

Health stays at `GET /health` and returns `HealthResponse` from `@supplyeagle/types`.

## Alignment

When you change bootstrap, health, lint, or tsconfig in one Nest app, apply the same change to the other unless the difference is the service name or port.

Product HTTP for the web app belongs in `apps/api`. Long-running agent work belongs in `apps/agents`.
