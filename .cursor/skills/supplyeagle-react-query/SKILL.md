---
name: supplyeagle-react-query
description: TanStack Query, React Router, and Vite API client conventions for the SupplyEagle web app. Use when fetching data in apps/web, adding queries or mutations, changing the API client, or wiring new pages.
---

# SupplyEagle React Query

`apps/web` is a Vite SPA. The browser never talks to `apps/agents` directly.

## Data flow

`component` → feature hook → `apiClient` → Vite `/api` proxy → `@supplyeagle/api`

```ts
queryFn: () => apiClient<HealthResponse>('/health')
```

`VITE_API_URL` defaults to `/api`. The Vite proxy strips that prefix and forwards to `http://localhost:8080`.

## Rules

- Create `QueryClient` once at module scope (`src/lib/query-client.ts`). Never construct it inside a component.
- Keep `QueryClientProvider` and `ReactQueryDevtools` in `main.tsx`.
- Add query keys to `src/lib/query-keys.ts` as a factory. Do not inline string keys in components.
- Put `useQuery` / `useMutation` hooks next to the feature, not in route components.
- Type responses with `@supplyeagle/types`. Add the contract there first when the API shape changes.
- Use `fetch` via `apiClient`. Do not add axios.
- New screens are React Router routes in `App.tsx`. Fetching stays in hooks, not in route loaders.

## Example

```ts
export function useHealthQuery() {
  return useQuery({
    queryKey: queryKeys.health.api(),
    queryFn: () => apiClient<HealthResponse>('/health'),
  });
}
```
