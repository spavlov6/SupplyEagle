---
name: supplyeagle-monorepo
description: Guides pnpm + Turborepo workspace layout, package naming, and task commands for SupplyEagle. Use when adding apps or packages, changing turbo/pnpm config, installing dependencies, or deciding where new code belongs.
---

# SupplyEagle monorepo

## Layout

- Apps live in `apps/` and are deployable: `@supplyeagle/web`, `@supplyeagle/api`, `@supplyeagle/agents`.
- Shared code lives in `packages/`: `@supplyeagle/types`, `@supplyeagle/typescript-config`.
- Orchestration is pnpm workspaces + Turborepo. Do **not** convert the Nest apps into Nest CLI monorepo mode (`nest generate app` at the repo root). That shares one `package.json` and fights Vite.

## Commands

Run from the repo root:

```bash
pnpm install
pnpm dev
pnpm dev:web
pnpm dev:api
pnpm dev:agents
pnpm check-types
pnpm build
pnpm lint
```

Filter a package: `pnpm --filter @supplyeagle/api add <dep>` or `turbo run test --filter=@supplyeagle/api`.

## Adding code

- New deployable process → new `apps/<name>` package named `@supplyeagle/<name>`.
- Types or contracts used by more than one app → `@supplyeagle/types` (types-only, export from source; no runtime values unless you add a compile step).
- Shared TS compiler flags → `packages/typescript-config`.
- Depend on workspace packages with `workspace:*`.
- Keep `.npmrc` `node-linker=hoisted` so Nest `reflect-metadata` stays a single instance.

## Task graph

- `build` depends on `^build`.
- `dev` is persistent and uncached; it still waits for dependency builds.
- `check-types` uses the `topo` transit task.
- Each package owns its `tsconfig.json`. Do not add TypeScript project references or a root tsconfig that includes all apps.
