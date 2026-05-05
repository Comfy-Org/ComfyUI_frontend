# Master Plan — RemoteCombo / RichComboWidget Refactor

> **Status: DRAFT BOARD v3.** Persistent plan-of-record across iterations and agent sessions. Edit in place; don't fork into new comments.
>
> **v3 changes:** §8 (deprecation warning + outreach) removed — audit found impact too small to warrant a process. Audit rationale retained in §9.

## 0. Goal

Land a single PR that delivers the rich remote-populated combo widget, **converts the legacy `useRemoteWidget` to the same foundation**, and aligns both with codebase principles: TanStack Query for fetch state, atomized component family, existing API clients for auth, design-system-aligned UI, clear domain-layer placement. No fast-followups.

Scope is intentionally large because we have explicitly accepted (a) breaking the existing `remote=` API contract for custom-node authors silently (audit shows the blast radius is one external repo, see §9), (b) shipping it all in one PR, (c) prioritizing alignment with codebase principles over PR size.

## 1. Locked-in decisions

1. **TanStack Query** owns all reactive fetch state (loading, error, data, refetch, invalidate, dedupe). In-memory cache with bounded size and key-factory scoping. No hand-rolled cache logic. No Cache API / disk cache. No `useCachedRequest` for this widget.
2. **No persistent disk cache.** Server-side cache headers are unreliable when proxying upstream (comfy-api proxies many third-party APIs with divergent cache policies — predictable headers across all routes is not realistic). TanStack Query's in-memory cache is the floor; we don't try to persist beyond a session.
3. **No new auth abstraction.** Use the existing per-service API clients. They already inject auth headers — RichComboWidget will go through the same path. The `fetchRemoteRoute.ts` helper added by the PR is dropped in favor of the canonical client(s).
4. **App teardown on auth change** — CONFIRMED, free cache eviction. See §8 for mechanism. No manual `queryClient.clear()` needed.
5. **Atomize `RichComboWidget.vue`** in this PR. Replace the 345-line monolith with a reka/shadcn-style atom family. Slot-based composition. CVA variants. No `show*` prop forest.
6. **One unified data source.** Both `remote=` (legacy flat) and `remote_combo=` (new rich) flow through the same TanStack Query hook with a request descriptor. Convert `useRemoteWidget` in this PR (Option 1 from prior iteration).
7. **Single PR, no fast-followups.** All phases ship together.
8. **No deprecation warning, no developer outreach.** Per §9, the audit found 0 HIGH-risk external consumers and 1 MEDIUM-risk repo. Process overhead exceeds the value. We ship the breaking change silently; if the one affected repo (`jtydhr88/comfyui-custom-node-skills`) breaks, they file an issue and we point at the migration column in §9.

## 2. Open questions — RESOLVED

| #   | Question                           | Resolution                                                                                                                                                                                                       |
| --- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Cache eviction on auth change      | **Not needed.** App teardown is automatic (§8).                                                                                                                                                                  |
| Q2  | Server-side `Cache-Control`/`ETag` | **Don't depend on it.** Upstream-proxy cache policy is unpredictable. TanStack Query in-memory is the floor. Non-blocking ask to bigcat for clarification on which routes (if any) commit to consistent headers. |
| Q3  | Legacy migration path              | **Convert** `useRemoteWidget` to use the shared TanStack Query hook in this PR.                                                                                                                                  |
| Q4  | Breaking changes for custom nodes  | **Acceptable, no outreach** per §9.                                                                                                                                                                              |
| Q5  | `authenticatedFetch` abstraction   | **Reject.** Use existing per-service API clients.                                                                                                                                                                |
| Q6  | Component atomization scope        | **Full atomization in this PR.**                                                                                                                                                                                 |

## 3. Architecture

### 3.1 Layer placement

```
base/                       — pure functions, no Vue, no stores, no I/O
  remote/itemSchema.ts     — getByPath, resolveLabel, mapToDropdownItem,
                              extractItems, buildSearchText
  remote/retry.ts          — getBackoff, isRetriableError
  remote/diagnostics.ts    — summarizeError, summarizePayload

platform/remote/            — query layer over existing API clients
  composables/
    useRemoteOptions.ts    — TanStack Query wrapper. Takes a request descriptor,
                              dispatches to the appropriate existing API client,
                              returns { data, isLoading, error, refetch,
                              invalidate, isFetching }
  schema/
    remoteRequestSchema.ts — RequestDescriptor type (route, params, responseKey,
                              client: 'comfyApi' | 'local', ttl)

renderer/extensions/vueNodes/widgets/
  components/
    RemoteCombo/           — atomized component family
      Root.vue, Trigger.vue, Content.vue, Search.vue, List.vue, Item.vue,
      Empty.vue, Loading.vue, Error.vue, Refresh.vue, LayoutSwitcher.vue,
      index.ts (namespaced re-exports), remoteCombo.variants.ts
  composables/
    useRemoteCombo.ts      — view-layer: schema mapping, search index,
                              auto_select / control_after_refresh policy,
                              selection state. Wraps useRemoteOptions.
    useRemoteWidget.ts     — REWRITTEN as a Litegraph-side adapter that
                              consumes useRemoteOptions and writes results
                              into the IWidget contract (preserving
                              widget.options.values mutation, refresh button,
                              execution_success auto-refresh toggle)
```

### 3.2 Auth handling (locked)

Use the existing `useAuthStore.getAuthHeader()` chain via the existing API client(s). No new abstraction. RichComboWidget's queryFn calls into the existing comfy-api client (or whichever client the request descriptor points at), which already handles the workspace > firebase > apikey > anon priority via the established codebase pattern. Auth header injection lives in the existing axios interceptor / client wrapper, not at the call site.

App teardown on auth state change (verified §8) means the QueryClient instance is destroyed and rebuilt; cache lifecycle is bound to the session naturally. No `queryClient.clear()` watcher needed.

### 3.3 Data flow

```
inputSpec (RemoteComboConfig | RemoteOptions)
     ↓
useRemoteCombo({ widget }) | useRemoteWidget({ widget, node })
     ↓
useRemoteOptions({ requestDescriptor })   ← TanStack Query (key factory)
     ↓
existing API client                       ← auth headers injected here
     ↓
comfy-api (or local server)
     ↓
TanStack Query in-memory cache
     ↓
mapToDropdownItem(raw, item_schema)       ← pure, base/
     ↓
search index, selection state, auto_select / control_after_refresh policy
     ↓
<RemoteCombo.Root>
  <RemoteCombo.Trigger />
  <RemoteCombo.Content>
    <RemoteCombo.Search />
    <RemoteCombo.List>
      <RemoteCombo.Item />  ← slot-based, schema-driven content
    </RemoteCombo.List>
    <RemoteCombo.Empty /> | .Loading | .Error
    <RemoteCombo.Refresh />
  </RemoteCombo.Content>
</RemoteCombo.Root>
```

### 3.4 TanStack Query setup

- **Install** `@tanstack/vue-query` (currently absent — only `@tanstack/vue-virtual` in `package.json`).
- **`main.ts`**: `app.use(VueQueryPlugin, { queryClient })` once. QueryClient lifetime is tied to the Vue app instance — torn down naturally on auth change (§8).
- **Default options**: `staleTime: 0`, `gcTime: 5 * 60_000`, `retry` driven by `isRetriableError`, `refetchOnWindowFocus: false`. TanStack Query has no built-in cache size cap — we rely on aggressive `gcTime` + key-factory scoping. If memory becomes a problem, add a custom `QueryCache` with LRU semantics in a follow-up.
- **Key factory**: `remoteOptionKeys.byRoute(route, params, { userId, workspaceId })`. Defense in depth — if teardown ever fails, keys still partition.
- **Refresh button**: `invalidateQueries({ queryKey })` then `refetch()`. The "delete cache before refetch to avoid the fast-response race" gymnastics in current `RichComboWidget.vue` go away.
- **In-flight dedupe**: free, by query key. Fixes the existing regression where two instances of the same node fire two requests.

### 3.5 Component atomization

Current monolith (`RichComboWidget.vue`, 345 lines) mixes fetch + cache + retry + state + mapping + search + selection + UI. Atomize:

- Each atom ≤80 lines, one responsibility
- Slot props on `Item` for schema-driven content with consumer override capability
- CVA variants in `remoteCombo.variants.ts` using `cn()` from `@comfyorg/tailwind-utils`
- Reka-ui primitives (`<ComboboxRoot>`, `<ComboboxVirtualizer>`, `<ComboboxItem>`) underneath; our atoms are the styled comfy layer
- State via provide/inject from `Root`. No prop-drilling.
- Mirrors existing `Button.vue` + `button.variants.ts` convention in `src/components/ui/`.

### 3.6 Pure / side-effect split

| Function/Helper                                                                     | Layer                                  | Pure? |
| ----------------------------------------------------------------------------------- | -------------------------------------- | ----- |
| `getByPath`, `resolveLabel`, `mapToDropdownItem`, `extractItems`, `buildSearchText` | `base/remote/itemSchema.ts`            | ✅    |
| `getBackoff`, `isRetriableError`                                                    | `base/remote/retry.ts`                 | ✅    |
| `summarizeError`, `summarizePayload`                                                | `base/remote/diagnostics.ts`           | ✅    |
| `useRemoteOptions`                                                                  | `platform/remote/composables/`         | ❌    |
| `useRemoteCombo` (Vue path), `useRemoteWidget` (Litegraph path)                     | `renderer/.../composables/`            | ❌    |
| Atom components                                                                     | `renderer/.../components/RemoteCombo/` | ❌    |

## 4. Implementation phases (all in this PR)

### Phase 1 — Foundation

- [ ] Add `@tanstack/vue-query` to `package.json`
- [ ] Wire `VueQueryPlugin` in `src/main.ts` with default options (bounded `gcTime`, retry policy, no window-focus refetch)
- [ ] Verify QueryClient lifetime aligns with app teardown on auth change (no leaks)

### Phase 2 — Pure helpers

- [ ] Move `itemSchemaUtils.ts` → `base/remote/itemSchema.ts`
- [ ] Split `richComboHelpers.ts` → `base/remote/retry.ts` + `base/remote/diagnostics.ts`
- [ ] Delete `fetchRemoteRoute.ts` (use existing API clients)

### Phase 3 — Data composable

- [ ] Build `platform/remote/composables/useRemoteOptions.ts` with TanStack Query
- [ ] Define `RequestDescriptor` (route, params, responseKey, client, ttl)
- [ ] Key factory: `remoteOptionKeys.byRoute(route, params, { userId, workspaceId })`
- [ ] Dispatch to existing API clients based on `descriptor.client`

### Phase 4 — Component family

- [ ] Build `RemoteCombo/` atom family (~10 SFCs), each ≤80 lines
- [ ] Build `remoteCombo.variants.ts` with CVA + `cn()` from `@comfyorg/tailwind-utils`
- [ ] Use semantic design tokens from `@comfyorg/design-system`
- [ ] Use `reka-ui` Combobox primitives + `ComboboxVirtualizer`
- [ ] Replace `RichComboWidget.vue` with thin assembler over the atoms (or delete + compose directly in `WidgetSelect.vue`)

### Phase 5 — Legacy convergence

- [ ] Build `renderer/.../composables/useRemoteCombo.ts` (Vue path: schema mapping, search, auto_select)
- [ ] Rewrite `useRemoteWidget.ts` (Litegraph path) over `useRemoteOptions`. Preserve: first-load defaulting, `control_after_refresh` override semantics, `execution_success` auto-refresh toggle, `widget.options.values` mutation contract.
- [ ] Reconcile `auto_select` (fill-if-empty) vs `control_after_refresh` (override) — they remain distinct policies in the view-layer composable, sharing only the data source

### Phase 6 — Schema + dispatch

- [ ] Tighten `zComboInputOptions` in `src/schemas/nodeDefSchema.ts` to enforce `remote` XOR `remote_combo` (matches backend XOR validation in `comfy_api/latest/_io.py`)
- [ ] Decide v-if-chain → registry in `WidgetSelect.vue` dispatch (consistent with `widgetRegistry.ts` pattern). OPEN — Phase 6 decision.

### Phase 7 — Tests

- [ ] Unit tests for relocated pure helpers
- [ ] `useRemoteOptions` with mocked QueryClient (in-flight dedupe, key partitioning, refetch, error flow)
- [ ] `useRemoteCombo` (auto_select policy, search, selection)
- [ ] `useRemoteWidget` rewrite (control_after_refresh override, execution_success toggle, IWidget contract preservation)
- [ ] Component tests per atom (mount in isolation, slot rendering, variant application)
- [ ] Integration test: schema XOR enforcement, end-to-end selection flow

> Detailed test strategy (E2E / integration / unit / property) deferred to next planning iteration — see §11.3.

## 5. Out of scope (captured for later)

- **Design system / Figma alignment** — full audit beyond using existing tokens & atoms (next planning iteration, see §11.2)
- **HCI principles audit** — keyboard nav, ARIA depth (we'll get reka-ui defaults; deeper review later)
- **Wider auth abstraction migration** — the other ~30 direct auth-store accessors stay until follow-up PRs
- **Spec → widget → UI feature reusability** — the registry/discriminated-union story for input specs (next planning iteration, see §11.1)
- **Server-side `Cache-Control` / `ETag`** rollout in comfy-api (depends on bigcat input on which routes commit)
- **API-nodes-on-Cloud / SSR direction** — explicitly deferred per the contributor

## 6. Risks & open concerns

1. **Scope.** Multi-phase PR, ~3000–4500 lines. Mitigation: well-organized commits per phase, this comment as the map.
2. **TanStack Query is net-new to the codebase.** No precedent. Mitigation: this comment + an ADR in `docs/adr/`. Locks defaults so future widgets follow the same conventions.
3. **Reka-ui Combobox virtualizer requires fixed viewport height.** Confirm with design before atomizing.
4. **`useRemoteWidget` rewrite risk.** Existing custom-node consumers depend on its precise IWidget mutation contract. Mitigation: integration tests, manual smoke test on built-in nodes (Ollama nodes) before merge.
5. **TanStack Query unbounded cache growth.** Default has no size cap. Mitigation: aggressive `gcTime` (~5min) + scoped keys means a single session's footprint is small. If this becomes a problem, add a custom `QueryCache` with LRU semantics in a follow-up.

## 7. Decision log

| #   | Decision                                          | Status                |
| --- | ------------------------------------------------- | --------------------- |
| 1   | Use TanStack Query                                | LOCKED                |
| 2   | No disk cache (Cache API removed)                 | LOCKED                |
| 3   | No new auth abstraction; use existing API clients | LOCKED                |
| 4   | App teardown on auth = free eviction              | LOCKED (§8)           |
| 5   | Atomize component family in this PR               | LOCKED                |
| 6   | Single PR, no follow-ups                          | LOCKED                |
| 7   | Convert legacy `useRemoteWidget` (Option 1)       | LOCKED                |
| 8   | Breaking custom-node deprecations acceptable      | LOCKED (§9)           |
| 9   | No deprecation warning / no outreach              | LOCKED (§9 rationale) |
| 10  | Pure helpers in `base/`                           | LOCKED                |
| 11  | Query layer in `platform/remote/composables/`     | LOCKED                |
| 12  | View composable + atoms in `renderer/`            | LOCKED                |
| 13  | Schema XOR in frontend Zod                        | LOCKED                |
| 14  | Server `Cache-Control` strategy                   | DEFERRED — ask bigcat |
| 15  | v-if dispatch → registry in `WidgetSelect.vue`    | OPEN — Phase 6        |

## 8. Auth-teardown invariant — CONFIRMED

The mechanism is router-driven, not `window.location.reload()`-driven. Path:

1. `onAuthStateChanged` in `src/stores/authStore.ts:108-119` sets `currentUser.value = null`
2. Router guard in `src/router.ts:142-235` reads `isLoggedIn` (derived from `currentUser`) on every navigation; on logout, `isLoggedIn` becomes false → guard redirects to `/cloud/login`
3. The redirect causes `LayoutDefault` (the authenticated wrapper) to unmount
4. `LayoutDefault` contains `<WorkspaceAuthGate>` which contains the rest of the authenticated tree. Comment at `src/platform/workspace/auth/WorkspaceAuthGate.vue:130` confirms this is intentional: _"This gate should be placed on the authenticated layout (LayoutDefault) so it mounts fresh after login and unmounts on logout."_
5. The entire authenticated subtree unmounts → all composable scopes dispose → on next login `LayoutDefault` re-mounts fresh and re-initializes the workspace store

For our purposes: **the QueryClient lifecycle is bound to the authenticated layout's lifecycle**, so an auth state change does effectively wipe the in-memory query cache. Defense-in-depth via auth-aware query keys is still cheap and worth doing.

Workspace switching also reloads via `window.location.reload()` in `teamWorkspaceStore.ts` (lines 370, 399, 437, 491). Belt and suspenders.

## 9. Custom-node ecosystem audit (rationale only — no action)

Performed an exhaustive search via grep.app, GitHub code search, ComfyUI Registry, and the ComfyUI-Manager `custom-node-list.json`.

### Findings

| Risk       | Repo                                               | Usage                                                                                  | Migration path                                              |
| ---------- | -------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **MEDIUM** | `jtydhr88/comfyui-custom-node-skills`              | `RemoteOptions` with `control_after_refresh`. No `query_params`. No absolute URLs.     | `control_after_refresh` → `auto_select`                     |
| **LOW**    | `comfy_extras/nodes_*.py` (built-in: Ollama nodes) | `RemoteOptions` with relative routes only                                              | Migrate in this PR or sibling backend PR — we control these |
| **NONE**   | All other public custom-node repos                 | No usage of `RemoteOptions`, `query_params`, absolute URLs, or `control_after_refresh` | —                                                           |

### Risk-class breakdown

- **HIGH RISK** (uses `query_params` OR absolute URL OR non-trivial `control_after_refresh`): **0 external repos**.
- **MEDIUM RISK** (uses `control_after_refresh` only): **1 external repo**.
- **LOW RISK** (uses `RemoteOptions` with simple relative routes): **2 built-in nodes**.

### Why no deprecation / no outreach (decision #9)

- 1 external repo with a 1-line migration is below the threshold where formal deprecation pays off
- The migration is mechanical: rename one kwarg, optionally adjust call site for fill-if-empty vs override semantics
- A deprecation warning in `RemoteOptions.__init__` adds noise to users who don't care (everyone except this one repo)
- Outreach via GitHub issue costs maintainer time on both sides for negligible coordination benefit
- If the affected repo breaks at the next ComfyUI release, they'll file an issue; we'll point at the migration row in this table. That's the SLA.

If we ever discover a HIGH-risk consumer post-merge, the migration table here is the canonical reference.

## 10. Verified facts (codebase ground truth, branch `pr-11310`)

- **Already installed**: `reka-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `@vueuse/core`, `es-toolkit`, `axios`, `zod`, `@tanstack/vue-virtual`. ✅
- **Not installed**: `@tanstack/vue-query`, `valibot`. ❌ (Phase 1 adds vue-query.)
- **`cn()` exists** at `@comfyorg/tailwind-utils/src/index.ts` (clsx + extended tailwind-merge). ✅
- **CVA pattern in use** at `src/components/ui/button/button.variants.ts`. ✅
- **Design tokens exist** at `@comfyorg/design-system/css/_palette.css` (CSS custom properties). ✅
- **Widget registry exists** at `src/renderer/extensions/vueNodes/widgets/registry/widgetRegistry.ts`. Sub-dispatch in `WidgetSelect.vue` is currently v-if (Phase 6 decision pending). ⚠️
- **Auth state change DOES tear down the authenticated app subtree** via router-driven unmount of `LayoutDefault` + `WorkspaceAuthGate`. QueryClient is bound to the same lifecycle. (§8) ✅
- **31 direct auth-store accessors** across `src/`. Out of scope for this PR; tracked for future migration. ⚠️
- **Reka-ui Combobox + ComboboxVirtualizer are stable** primitives.

## 11. Next planning iterations (in progress — fresh sessions)

These three sections are being filled in by separate fresh-context investigation sessions running in parallel. Each will update this section in place (v3 → v4 → v5 → v6) with concrete findings.

### 11.1 Spec → widget prop → UI feature reusability — TBD (in flight)

Goal: design a unified pattern for how Python input-spec fields propagate to Vue widget props and on to UI features, so that adding a new spec field is a localized change rather than a forest of show\*-prop edits.

Investigation scope: schema entry points (`src/schemas/`), spec→component adapters (`useComboWidget`, `WidgetSelect.vue`, `SimplifiedWidget<T>`), widget registry mechanics, cross-pipeline widgets, show\* prop forest, `RemoteItemSchema` reusability path. Design space: registry-based dispatch with discriminated unions vs adapter pattern with tighter types.

### 11.2 Figma / design-system alignment audit — TBD (in flight)

Goal: ensure the new `RemoteCombo` atom family is wired into the existing design-system surface (tokens, variants, motion, a11y) and surface gaps where the codebase's own conventions are inconsistent.

Investigation scope: `@comfyorg/design-system` package contents, Tailwind config, `src/components/ui/` library, CVA pattern adoption, Figma source-of-truth + Storybook tooling, current widget token usage, iconography, motion tokens, a11y instrumentation. Output: token alignment table, variant naming conventions, slot-prop conventions, a11y minimums.

### 11.3 E2E / integration / unit / property testing strategy — TBD (in flight)

Goal: define a coherent test plan for the refactor that fits the existing test infrastructure and covers the new seams (TanStack Query, atom family, legacy migration) without over-testing.

Investigation scope: test framework inventory, existing patterns, TanStack Query test scaffolding (likely none), Playwright E2E config, fixtures and factories, CI gates, surface-area coverage. Output: test pyramid for this refactor with citations, MSW vs vi.mock convention, test ID convention, CI runtime budget.

---

> **Edit history:**
>
> - v1 — initial draft
> - v2 — Q1–Q6 resolved; auth-teardown CONFIRMED (§8 mechanism); custom-node audit added (§9); authenticatedFetch removed; legacy convert via Option 1 locked
> - v3 — deprecation/outreach removed (§9 retained as rationale only); §11 placeholders for next iterations; minor wording cleanup
