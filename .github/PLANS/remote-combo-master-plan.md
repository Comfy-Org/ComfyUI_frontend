# Master Plan — RemoteCombo / RichComboWidget Refactor

> **Status: DRAFT BOARD v4.** Persistent plan-of-record across iterations and agent sessions. Edit in place; don't fork into new comments.
>
> **v4 changes:** §11.1 (spec→widget→UI reusability), §11.2 (design-system alignment), §11.3 (testing strategy) all filled in by parallel fresh-context investigations. The file is now ~4x its v3 size — sections are stable, content is detailed.

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

```text
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

```text
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

### 11.1 Spec → widget prop → UI feature reusability

**Status: INVESTIGATION COMPLETE.** This section documents the current state of spec→UI mapping, identifies reusability gaps, and recommends a design pattern for future widget additions.

#### a) Current state diagram

```text
Python Backend (comfy_api/latest/_io.py)
  ↓
  RemoteItemSchema (class)
  RemoteComboOptions (class)
  RemoteOptions (class)
  ↓
JSON wire format (object_info endpoint)
  ↓
Zod parse (src/schemas/nodeDefSchema.ts)
  ├─ zRemoteItemSchema → RemoteItemSchema type
  ├─ zRemoteComboConfig → RemoteComboConfig type
  ├─ zRemoteWidgetConfig → RemoteWidgetConfig type
  ├─ zComboInputOptions → ComboInputOptions type
  └─ zComboInputSpec | zComboInputSpecV2 → ComboInputSpec | ComboInputSpecV2 types
  ↓
InputSpec (union of all input types)
  ↓
Litegraph adapter (useComboWidget.ts:281–294)
  ├─ isComboInputSpec() guard
  ├─ inputSpec.multi_select → addMultiSelectWidget()
  ├─ inputSpec.remote → useRemoteWidget() [legacy]
  └─ inputSpec.remote_combo → [Vue-only, not used in Litegraph]
  ↓
Vue adapter (WidgetSelect.vue:51–133)
  ├─ comboSpec computed (isComboInputSpec guard)
  ├─ hasRemoteCombo computed (comboSpec.value?.remote_combo)
  ├─ specDescriptor computed (extracts image_upload, video_upload, audio_upload, mesh_upload, image_folder, upload_subfolder)
  ├─ isAssetMode computed (assetService.shouldUseAssetBrowser)
  ├─ assetKind computed (specDescriptor.value.kind)
  ├─ isDropdownUIWidget computed (isAssetMode || assetKind !== 'unknown')
  ├─ allowUpload computed (specDescriptor.value.allowUpload)
  ├─ uploadFolder computed (specDescriptor.value.folder)
  ├─ uploadSubfolder computed (specDescriptor.value.subfolder)
  └─ defaultLayoutMode computed (isAssetMode ? 'list' : 'grid')
  ↓
Component dispatch (WidgetSelect.vue:2–21)
  ├─ RichComboWidget (if hasRemoteCombo)
  ├─ WidgetSelectDropdown (if isDropdownUIWidget)
  ├─ WidgetWithControl (if widget.controlWidget)
  └─ WidgetSelectDefault (else)
  ↓
Leaf components
  ├─ RichComboWidget.vue (lines 99–345)
  │  ├─ comboSpec computed (isComboInputSpec guard)
  │  ├─ remoteConfig computed (comboSpec.value?.remote_combo)
  │  ├─ itemSchema computed (remoteConfig.value?.item_schema)
  │  ├─ rawItems ref (fetched data)
  │  ├─ loading ref (fetch state)
  │  ├─ error ref (error state)
  │  ├─ applyAutoSelect() (remoteConfig.auto_select policy)
  │  ├─ fetchAll() (TanStack Query-like retry logic)
  │  ├─ mapToDropdownItem() (itemSchemaUtils.ts:25–39)
  │  └─ FormDropdown (renders items)
  │
  ├─ WidgetSelectDropdown.vue (lines 1–181)
  │  ├─ assetKind prop (from parent)
  │  ├─ allowUpload prop (from parent)
  │  ├─ uploadFolder prop (from parent)
  │  ├─ uploadSubfolder prop (from parent)
  │  ├─ isAssetMode prop (from parent)
  │  ├─ defaultLayoutMode prop (from parent)
  │  ├─ useWidgetSelectItems() (composable)
  │  ├─ useWidgetSelectActions() (composable)
  │  ├─ dropdownItems computed (from useWidgetSelectItems)
  │  ├─ displayItems computed (from useWidgetSelectItems)
  │  ├─ filterSelected computed (from useWidgetSelectItems)
  │  ├─ filterOptions computed (from useWidgetSelectItems)
  │  ├─ ownershipSelected computed (from useWidgetSelectItems)
  │  ├─ showOwnershipFilter computed (from useWidgetSelectItems)
  │  ├─ baseModelSelected computed (from useWidgetSelectItems)
  │  ├─ showBaseModelFilter computed (from useWidgetSelectItems)
  │  └─ FormDropdown (renders items with filters)
  │
  ├─ WidgetSelectDefault.vue (lines 1–97)
  │  ├─ selectOptions computed (resolveValues(widget.options?.values))
  │  ├─ invalid computed (modelValue not in selectOptions)
  │  ├─ combinedProps computed (filterWidgetProps + transformCompatProps)
  │  └─ SelectPlus (PrimeVue dropdown)
  │
  └─ WidgetWithControl.vue (lines 1–39)
     ├─ widget prop (SimplifiedControlWidget<T>)
     ├─ component prop (Component)
     ├─ controlModel ref (widget.controlWidget.value)
     └─ renders component + ValueControlButton
  ↓
SimplifiedWidget<T> interface (src/types/simplifiedWidget.ts:46–90)
  ├─ name: string
  ├─ type: string
  ├─ value: T
  ├─ borderStyle?: string
  ├─ callback?: (value: T) => void
  ├─ computeSize?: () => { minHeight, maxHeight? }
  ├─ label?: string
  ├─ options?: O (IWidgetOptions)
  ├─ nodeType?: string
  ├─ serializeValue?: () => unknown
  ├─ nodeLocatorId?: string
  ├─ spec?: InputSpecV2
  ├─ tooltip?: string
  ├─ controlWidget?: SafeControlWidget
  └─ linkedUpstream?: LinkedUpstreamInfo
```

**Key files and line citations:**

- `/workspace/comfyui/comfy_api/latest/_io.py:46–97` — RemoteItemSchema class definition
- `/workspace/comfyui/comfy_api/latest/_io.py:100–131` — RemoteOptions class definition
- `/workspace/comfyui/comfy_api/latest/_io.py:133–207` — RemoteComboOptions class definition
- `/workspace/comfyui_frontend/src/schemas/nodeDefSchema.ts:24–31` — zRemoteItemSchema Zod schema
- `/workspace/comfyui_frontend/src/schemas/nodeDefSchema.ts:13–22` — zRemoteWidgetConfig Zod schema
- `/workspace/comfyui_frontend/src/schemas/nodeDefSchema.ts:39–48` — zRemoteComboConfig Zod schema
- `/workspace/comfyui_frontend/src/schemas/nodeDefSchema.ts:116–133` — zComboInputOptions Zod schema (exact definition below)
- `/workspace/comfyui_frontend/src/schemas/nodeDef/nodeDefSchemaV2.ts:37–41` — zComboInputSpec (V2 format)
- `/workspace/comfyui_frontend/src/renderer/extensions/vueNodes/widgets/composables/useComboWidget.ts:281–294` — Litegraph adapter
- `/workspace/comfyui_frontend/src/renderer/extensions/vueNodes/widgets/components/WidgetSelect.vue:51–133` — Vue adapter with computed properties
- `/workspace/comfyui_frontend/src/renderer/extensions/vueNodes/widgets/components/RichComboWidget.vue:99–345` — Rich combo widget
- `/workspace/comfyui_frontend/src/renderer/extensions/vueNodes/widgets/utils/itemSchemaUtils.ts:25–39` — mapToDropdownItem signature
- `/workspace/comfyui_frontend/src/types/simplifiedWidget.ts:46–90` — SimplifiedWidget interface

**Exact zComboInputOptions definition:**

```typescript
export const zComboInputOptions = zBaseInputOptions.extend({
  control_after_generate: z
    .union([z.boolean(), z.enum(CONTROL_OPTIONS)])
    .optional(),
  image_upload: z.boolean().optional(),
  image_folder: resultItemType.optional(),
  allow_batch: z.boolean().optional(),
  video_upload: z.boolean().optional(),
  audio_upload: z.boolean().optional(),
  mesh_upload: z.boolean().optional(),
  upload_subfolder: z.string().optional(),
  animated_image_upload: z.boolean().optional(),
  options: z.array(zComboOption).optional(),
  remote: zRemoteWidgetConfig.optional(),
  remote_combo: zRemoteComboConfig.optional(),
  /** Whether the widget is a multi-select widget. */
  multi_select: zMultiSelectOption.optional()
})
```

**Discriminated union usage:** The codebase does NOT currently use `z.discriminatedUnion` for input specs. Instead, it uses a flat `z.union([zIntInputSpec, zFloatInputSpec, ..., zComboInputSpec, zComboInputSpecV2, ...])` at line 235–243 of `nodeDefSchema.ts`. Type guards (`isComboInputSpec`, `isIntInputSpec`, etc.) are used to narrow the union at runtime.

#### b) Reusability gaps: 3 concrete fragility points

**Gap 1: Spec field → computed property → UI feature (WidgetSelect.vue)**

The `specDescriptor` computed (lines 60–114) manually extracts 7 fields from `comboSpec` and derives 4 computed properties (`kind`, `allowUpload`, `folder`, `subfolder`). Adding a new upload type (e.g., `model_upload`) requires:

1. Add field to `zComboInputOptions` (nodeDefSchema.ts)
2. Add field to `RemoteComboOptions` or `RemoteOptions` (Python backend)
3. Extract field in `specDescriptor` computed (WidgetSelect.vue)
4. Derive new computed property (WidgetSelect.vue)
5. Pass new prop to child component (WidgetSelect.vue)
6. Consume new prop in child (WidgetSelectDropdown.vue)

This is a 6-step cascade with no type safety between steps 3–6. A missing step silently fails at runtime.

**Gap 2: Show\* prop forest (WidgetSelectDropdown.vue, FormDropdownMenuActions.vue)**

The `useWidgetSelectItems` composable returns 8 computed properties that control UI visibility:

- `showOwnershipFilter` (computed from assetData + assetKind)
- `showBaseModelFilter` (computed from assetData + assetKind)
- `filterSelected` (computed from user selection)
- `filterOptions` (computed from dropdownItems)
- `ownershipSelected` (computed from user selection)
- `baseModelSelected` (computed from user selection)

Each is passed as a prop to FormDropdown, which passes them to FormDropdownMenuActions. The logic is scattered across 3 files with no single source of truth. Adding a new filter type (e.g., `showLicenseFilter`) requires edits in 4 files and introduces the same 6-step cascade.

**Gap 3: mapToDropdownItem signature and generalization**

The `mapToDropdownItem` function (itemSchemaUtils.ts:25–39) is hardcoded to `RemoteItemSchema` and returns `FormDropdownItem`. The signature is:

```typescript
export function mapToDropdownItem(
  raw: unknown,
  schema: RemoteItemSchema
): FormDropdownItem
```

This function is only used in RichComboWidget.vue. If we wanted to reuse the same pattern for other remote-populated widgets (e.g., asset picker, model browser, LoRA selector), we would need to:

1. Generalize `RemoteItemSchema` to a `RemoteItemSchemaBase<T>` type
2. Generalize `mapToDropdownItem` to `mapToRemoteItem<T>(raw, schema) → T`
3. Update all call sites

The cost is moderate (3–4 files), but the pattern is not discoverable — a new widget author would likely duplicate the logic rather than reuse it.

#### c) Design space comparison: two options

**Option A: Registry-based dispatch with z.discriminatedUnion**

Introduce a discriminated union at the schema level:

```typescript
const zInputSpecWithType = z.discriminatedUnion('type', [
  zIntInputSpec,
  zFloatInputSpec,
  zBooleanInputSpec,
  zStringInputSpec,
  zComboInputSpec,
  zColorInputSpec
  // ... etc
])
```

Then use a registry to map type → component + prop extractor:

```typescript
interface WidgetSpecHandler<T extends InputSpec> {
  component: Component
  extractProps: (spec: T) => Record<string, unknown>
}

const specHandlers = new Map<string, WidgetSpecHandler<any>>([
  ['COMBO', {
    component: WidgetSelect,
    extractProps: (spec: ComboInputSpec) => ({
      assetKind: deriveAssetKind(spec),
      allowUpload: spec.image_upload || spec.video_upload || ...,
      uploadFolder: spec.image_folder,
      uploadSubfolder: spec.upload_subfolder,
      // ... etc
    })
  }],
  // ... etc
])
```

**Pros:**

- Type-safe dispatch: `z.discriminatedUnion` ensures the type field is always present and matches the spec shape
- Centralized prop extraction: all spec→prop logic lives in one place per widget type
- Discoverable: new widget authors see the registry pattern and follow it
- Extensible: adding a new spec field is a single edit to the handler's `extractProps` function

**Cons:**

- Requires schema refactor: moving from flat union to discriminated union is a breaking change to the schema layer
- Registry boilerplate: each widget type needs a handler definition (5–10 lines per type)
- Blast radius: affects all input spec consumers (useComboWidget, WidgetSelect, WidgetRenderer, etc.)
- Litegraph adapter complexity: the Litegraph side (useComboWidget.ts) would need to consume the same registry, adding coupling

**Blast radius estimate:** 8–12 files, 200–300 lines of new code, 1–2 days of refactoring + testing.

---

**Option B: Adapter pattern with tighter types (RECOMMENDED)**

Keep the current adapter pattern but introduce a `SpecAdapter<T>` interface that centralizes prop extraction:

```typescript
interface SpecAdapter<T extends InputSpec> {
  canHandle: (spec: InputSpec) => spec is T
  extractProps: (spec: T) => Record<string, unknown>
  component: Component
}

const comboAdapter: SpecAdapter<ComboInputSpec> = {
  canHandle: isComboInputSpec,
  extractProps: (spec: ComboInputSpec) => ({
    assetKind: deriveAssetKind(spec),
    allowUpload: spec.image_upload || spec.video_upload || ...,
    uploadFolder: spec.image_folder,
    uploadSubfolder: spec.upload_subfolder,
  }),
  component: WidgetSelect
}

// In WidgetSelect.vue:
const adapter = computed(() => {
  const spec = props.widget.spec
  if (!spec) return null
  if (comboAdapter.canHandle(spec)) return comboAdapter
  // ... other adapters
  return null
})

const extractedProps = computed(() => {
  if (!adapter.value) return {}
  return adapter.value.extractProps(adapter.value.canHandle(props.widget.spec) ? props.widget.spec : {})
})
```

**Pros:**

- Minimal schema changes: no refactor to zod schemas or discriminated unions
- Localized edits: adding a new spec field is a single edit to the adapter's `extractProps` function
- Type-safe: TypeScript ensures `extractProps` receives the correct spec type
- Backward compatible: existing code paths unchanged
- Reusable: the same adapter can be used in Litegraph (useComboWidget) and Vue (WidgetSelect)

**Cons:**

- Less discoverable: the adapter pattern is not as obvious as a registry
- Manual dispatch: the `canHandle` guard must be written for each adapter (but this is already done via `isComboInputSpec`, etc.)
- Prop extraction still scattered: each adapter lives in a separate file, so the logic is not in one place (but it's co-located with the component)

**Blast radius estimate:** 3–5 files, 50–100 lines of new code, 4–6 hours of refactoring + testing.

#### d) Recommendation: Option B (Adapter pattern with tighter types)

**Rationale:**

1. **Minimal disruption:** The current codebase already uses type guards (`isComboInputSpec`, etc.) and adapters (useComboWidget, WidgetSelect). Option B formalizes this pattern without requiring a schema refactor.
2. **Localized changes:** Adding a new spec field (e.g., `model_upload`) requires a single edit to the adapter's `extractProps` function, not a 6-step cascade.
3. **Reusability:** The same adapter can be used in both Litegraph and Vue, reducing duplication.
4. **Backward compatible:** No breaking changes to the schema layer or existing consumers.
5. **Fits the refactor scope:** This is a natural extension of the existing codebase structure and aligns with the "no fast-followups" constraint.

**Concrete signatures:**

```typescript
// src/renderer/extensions/vueNodes/widgets/adapters/specAdapter.ts
export interface SpecAdapter<T extends InputSpec> {
  canHandle: (spec: InputSpec) => spec is T
  extractProps: (spec: T) => SpecAdapterProps
  component: Component
}

export interface SpecAdapterProps {
  assetKind?: AssetKind
  allowUpload?: boolean
  uploadFolder?: ResultItemType
  uploadSubfolder?: string
  isAssetMode?: boolean
  defaultLayoutMode?: LayoutMode
  // ... extensible for future spec fields
}

export const comboAdapter: SpecAdapter<ComboInputSpec> = {
  canHandle: isComboInputSpec,
  extractProps: (spec: ComboInputSpec): SpecAdapterProps => {
    const kind: AssetKind = spec.video_upload
      ? 'video'
      : spec.image_upload || spec.animated_image_upload
        ? 'image'
        : spec.audio_upload
          ? 'audio'
          : spec.mesh_upload
            ? 'mesh'
            : 'unknown'

    return {
      assetKind: kind,
      allowUpload:
        spec.image_upload === true ||
        spec.animated_image_upload === true ||
        spec.video_upload === true ||
        spec.audio_upload === true ||
        spec.mesh_upload === true,
      uploadFolder: spec.mesh_upload ? 'input' : spec.image_folder,
      uploadSubfolder: spec.upload_subfolder,
      isAssetMode: assetService.shouldUseAssetBrowser(nodeType, widgetName),
      defaultLayoutMode: isAssetMode ? 'list' : 'grid'
    }
  },
  component: WidgetSelect
}

// In WidgetSelect.vue:
const adapter = computed(() => {
  const spec = props.widget.spec
  if (!spec) return null
  if (comboAdapter.canHandle(spec)) return comboAdapter
  // ... other adapters as needed
  return null
})

const adapterProps = computed(() => {
  if (!adapter.value || !props.widget.spec) return {}
  return adapter.value.extractProps(props.widget.spec as any)
})
```

**File paths to create/modify:**

- **Create:** `/workspace/comfyui_frontend/src/renderer/extensions/vueNodes/widgets/adapters/specAdapter.ts` (interface + types)
- **Create:** `/workspace/comfyui_frontend/src/renderer/extensions/vueNodes/widgets/adapters/comboAdapter.ts` (ComboInputSpec adapter)
- **Modify:** `/workspace/comfyui_frontend/src/renderer/extensions/vueNodes/widgets/components/WidgetSelect.vue` (use adapter)
- **Modify:** `/workspace/comfyui_frontend/src/renderer/extensions/vueNodes/widgets/composables/useComboWidget.ts` (use adapter for Litegraph)
- **Modify:** `/workspace/comfyui_frontend/src/renderer/extensions/vueNodes/widgets/utils/itemSchemaUtils.ts` (generalize mapToDropdownItem if needed)

**Phase placement:** This fits into **Phase 4 (Component family)** of the master plan, alongside the atomization work — the adapter is what feeds props into the new atom family, so the two land together. It must be completed before the PR is merged, as it affects the `WidgetSelect` dispatch logic.

#### e) Implementation shopping list

**New files:**

- `src/renderer/extensions/vueNodes/widgets/adapters/specAdapter.ts` — SpecAdapter interface and SpecAdapterProps type
- `src/renderer/extensions/vueNodes/widgets/adapters/comboAdapter.ts` — ComboInputSpec adapter implementation
- `src/renderer/extensions/vueNodes/widgets/adapters/index.ts` — re-exports

**Modified files:**

- `src/renderer/extensions/vueNodes/widgets/components/WidgetSelect.vue` — use adapter for prop extraction (lines 51–133)
- `src/renderer/extensions/vueNodes/widgets/composables/useComboWidget.ts` — use adapter for Litegraph side (lines 210–279)
- `src/renderer/extensions/vueNodes/widgets/utils/itemSchemaUtils.ts` — generalize mapToDropdownItem to accept a generic schema type (optional, low priority)

**Deleted files:** None.

**Test files to add/update:**

- `src/renderer/extensions/vueNodes/widgets/adapters/comboAdapter.test.ts` — unit tests for extractProps
- `src/renderer/extensions/vueNodes/widgets/components/WidgetSelect.test.ts` — update to test adapter dispatch

#### f) Risks

**Risk 1: Litegraph parallel path divergence**

The Litegraph side (useComboWidget.ts) and Vue side (WidgetSelect.vue) both consume the spec, but they have different dispatch logic:

- **Litegraph:** `addComboWidget()` checks `inputSpec.remote` (legacy) and `inputSpec.multi_select`
- **Vue:** `WidgetSelect.vue` checks `hasRemoteCombo` (new), `isDropdownUIWidget`, and `widget.controlWidget`

If the adapter pattern is only applied to the Vue side, the Litegraph side will continue to have its own prop-extraction logic, creating a maintenance burden. **Mitigation:** Apply the adapter pattern to both sides in the same PR. The Litegraph adapter can reuse the same `extractProps` logic.

**Risk 2: Asset service coupling**

The `specDescriptor` computed in WidgetSelect.vue calls `assetService.shouldUseAssetBrowser()`, which is a side effect. If the adapter pattern moves this logic into `extractProps`, the adapter becomes coupled to the asset service. **Mitigation:** Keep the asset service call in the component (WidgetSelect.vue), not in the adapter. The adapter should only extract spec fields; business logic (asset mode detection) stays in the component.

**Risk 3: Show\* prop forest not addressed**

This recommendation does not solve the show\* prop forest (Gap 2). The `useWidgetSelectItems` composable still returns 8 computed properties that are passed as props. **Mitigation:** This is a separate refactoring (Phase 3 or later). For now, document the pattern in a comment and add a TODO for future cleanup.

**Risk 4: RemoteItemSchema generalization not included**

Gap 3 (mapToDropdownItem generalization) is not addressed in this recommendation. **Mitigation:** This is a low-priority optimization. If a second remote-populated widget is added, the generalization will be obvious and can be done then. For now, keep mapToDropdownItem as-is.

**Risk 5: Custom node breakage**

The audit (§9) identified one external repo (`jtydhr88/comfyui-custom-node-skills`) that uses `remote=` (legacy). If the adapter pattern changes the behavior of `useRemoteWidget`, it could break this repo. **Mitigation:** The adapter pattern should NOT change the behavior of `useRemoteWidget` — it should only extract props. The actual fetch logic remains in `useRemoteWidget.ts` (or is migrated to TanStack Query in a separate phase).

---

**Summary:** Option B (Adapter pattern) is a low-risk, high-value improvement that formalizes the existing codebase structure and makes future spec-field additions a single-file edit. It should be included in the PR as part of Phase 2.

## 11.2 Figma / design-system alignment audit

**Status: INVESTIGATION COMPLETE.** This section documents the design-system surface, token tier organization, and the implementation contract for the `RemoteCombo` atom family.

### a) Token tier inventory

The codebase uses a three-tier token hierarchy:

| Tier          | Purpose                                             | Examples                                                                                                                     | Source                                                                                 |
| ------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Primitive** | Raw color values, no semantic meaning               | `--color-charcoal-500`, `--color-azure-400`, `--color-coral-600`                                                             | `packages/design-system/src/css/_palette.css` (Tailwind v4 `@theme` block)             |
| **Semantic**  | Intent-driven, context-aware tokens for UI surfaces | `--primary-background`, `--secondary-background-hover`, `--destructive-background`, `--muted-foreground`, `--border-default` | `packages/design-system/src/css/style.css` (Tailwind v4 `@theme` block, lines 100–200) |
| **Component** | Component-specific tokens, rarely used directly     | `--component-node-widget-background`, `--component-node-widget-background-hovered`, `--node-component-ring`                  | `packages/design-system/src/css/style.css` (lines 200–250)                             |

**Tailwind v4 adoption:** The codebase uses Tailwind CSS v4 with `@theme` blocks (not v3 JS config). All tokens are CSS custom properties, automatically available as Tailwind utilities (e.g., `bg-primary-background`, `text-muted-foreground`, `border-border-default`).

**Semantic token catalog (complete):**

| Category       | Token Name                        | Primitive Value                       | Usage                              |
| -------------- | --------------------------------- | ------------------------------------- | ---------------------------------- |
| **Background** | `--primary-background`            | `--color-azure-400` (#31b9f4)         | Primary action buttons, highlights |
|                | `--primary-background-hover`      | `--color-cobalt-800` (#185a8b)        | Primary button hover state         |
|                | `--secondary-background`          | `--color-smoke-200` (#e9e9e9)         | Input fields, secondary surfaces   |
|                | `--secondary-background-hover`    | `--color-smoke-400` (#d9d9d9)         | Secondary surface hover            |
|                | `--secondary-background-selected` | `--color-smoke-600` (#b4b4b4)         | Selected item in list/dropdown     |
|                | `--base-background`               | `--color-white` (#ffffff)             | Page/panel background              |
|                | `--destructive-background`        | `--color-coral-500` (#f75951)         | Error/delete actions               |
|                | `--destructive-background-hover`  | `--color-coral-600` (#e04e48)         | Error button hover                 |
|                | `--warning-background`            | `--color-gold-400` (#fcbf64)          | Warning states                     |
|                | `--success-background`            | `--color-jade-600` (#00cd72)          | Success states                     |
|                | `--muted-background`              | `--color-smoke-700` (#a0a0a0)         | Disabled/inactive surfaces         |
|                | `--accent-background`             | `--color-smoke-800` (#8a8a8a)         | Accent highlights                  |
| **Foreground** | `--base-foreground`               | `--color-charcoal-800` (#171718)      | Primary text                       |
|                | `--muted-foreground`              | `--color-charcoal-200` (#494a50)      | Secondary/disabled text            |
|                | `--secondary-foreground`          | (derived from context)                | Secondary text on secondary bg     |
| **Border**     | `--border-default`                | `--color-smoke-600` (#b4b4b4)         | Standard borders                   |
|                | `--border-subtle`                 | `--color-smoke-400` (#d9d9d9)         | Subtle dividers                    |
|                | `--node-component-border`         | `--color-smoke-400` (#d9d9d9)         | Node widget borders                |
|                | `--node-component-ring`           | `rgb(from --color-smoke-500 / 50%)`   | Focus ring on node widgets         |
| **Focus**      | `--ring`                          | (Tailwind default, typically primary) | Focus-visible ring color           |

### b) Token alignment table for RemoteCombo

This table specifies which design-system token each visual surface in the atom family must use. **Semantic tokens are preferred; primitive tokens are only used when semantic tokens don't exist.**

| Surface                             | Atom             | Property         | Token                             | Tailwind Class                                          | Notes                                     |
| ----------------------------------- | ---------------- | ---------------- | --------------------------------- | ------------------------------------------------------- | ----------------------------------------- |
| **Trigger (closed state)**          | `Trigger`        | Background       | `--secondary-background`          | `bg-secondary-background`                               | Matches `Button.vue` secondary variant    |
|                                     |                  | Foreground       | `--base-foreground`               | `text-base-foreground`                                  | Primary text color                        |
|                                     |                  | Border           | `--border-default`                | `border-border-default`                                 | Subtle border, 1px solid                  |
|                                     |                  | Hover background | `--secondary-background-hover`    | `hover:bg-secondary-background-hover`                   | Hover state                               |
| **Trigger (open state)**            | `Trigger`        | Border           | `--node-component-border`         | `data-[state=open]:border-node-component-border`        | Highlight when dropdown is open           |
| **Trigger (focus)**                 | `Trigger`        | Ring             | `--ring`                          | `focus-visible:ring-1 focus-visible:ring-ring`          | Standard focus ring (1px, semantic color) |
| **Content (dropdown panel)**        | `Content`        | Background       | `--base-background`               | `bg-base-background`                                    | White background for dropdown             |
|                                     |                  | Foreground       | `--base-foreground`               | `text-base-foreground`                                  | Text in dropdown                          |
|                                     |                  | Border           | `--border-default`                | `border-border-default`                                 | Dropdown border                           |
|                                     |                  | Shadow           | `--shadow-interface`              | `shadow-md`                                             | Elevation shadow                          |
| **Search input**                    | `Search`         | Background       | `--secondary-background`          | `bg-secondary-background`                               | Matches input field convention            |
|                                     |                  | Foreground       | `--base-foreground`               | `text-base-foreground`                                  | Input text                                |
|                                     |                  | Border           | `--border-default`                | `border-border-default`                                 | Input border                              |
|                                     |                  | Focus ring       | `--ring`                          | `focus-visible:ring-1 focus-visible:ring-ring`          | Focus state                               |
|                                     |                  | Placeholder      | `--muted-foreground`              | `placeholder:text-muted-foreground`                     | Placeholder text                          |
| **List item (default)**             | `Item`           | Background       | transparent                       | `bg-transparent`                                        | No background by default                  |
|                                     |                  | Foreground       | `--base-foreground`               | `text-base-foreground`                                  | Item text                                 |
|                                     |                  | Hover background | `--secondary-background-hover`    | `hover:bg-secondary-background-hover`                   | Hover highlight                           |
| **List item (highlighted/focused)** | `Item`           | Background       | `--secondary-background-selected` | `data-highlighted:bg-secondary-background-selected`     | Keyboard nav highlight                    |
|                                     |                  | Foreground       | `--base-foreground`               | `data-highlighted:text-base-foreground`                 | Text remains readable                     |
| **List item (selected)**            | `Item`           | Background       | `--secondary-background-selected` | `data-[state=checked]:bg-secondary-background-selected` | Checkmark/selection state                 |
|                                     |                  | Checkmark icon   | `--primary-background`            | `text-primary-background`                               | Accent color for checkmark                |
| **Empty state**                     | `Empty`          | Foreground       | `--muted-foreground`              | `text-muted-foreground`                                 | Subtle text for "no results"              |
| **Loading state**                   | `Loading`        | Spinner color    | `--primary-background`            | `text-primary-background`                               | Animated spinner (lucide-loader-circle)   |
| **Error state**                     | `Error`          | Background       | `--destructive-background`        | `bg-destructive-background`                             | Error container                           |
|                                     |                  | Foreground       | `--base-foreground`               | `text-base-foreground`                                  | Error text                                |
|                                     |                  | Icon             | `--destructive-background`        | `text-destructive-background`                           | Error icon (lucide-alert-circle)          |
| **Refresh button**                  | `Refresh`        | Variant          | secondary                         | `variant="secondary"`                                   | Matches `Button.vue` secondary            |
|                                     |                  | Size             | icon                              | `size="icon"`                                           | Icon-only button (8px)                    |
|                                     |                  | Icon             | lucide-rotate-cw                  | `icon-[lucide--rotate-cw]`                              | Refresh icon                              |
| **LayoutSwitcher buttons**          | `LayoutSwitcher` | Variant          | secondary                         | `variant="secondary"`                                   | Toggle buttons                            |
|                                     |                  | Size             | icon-sm                           | `size="icon-sm"`                                        | Compact icon buttons (5px)                |
|                                     |                  | Icons            | lucide-list, lucide-grid-2x2      | `icon-[lucide--list]`, `icon-[lucide--grid-2x2]`        | List/grid view toggles                    |

### c) Variant axis conventions

The `RemoteCombo` atom family uses the following CVA variant axes, mirroring `Button.vue` and `SearchInput.vue` conventions:

| Axis        | Values                                            | Component(s)                                             | Notes                                                                    |
| ----------- | ------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------ |
| **size**    | `sm`, `md`, `lg`, `icon-sm`, `icon`               | `Trigger`, `Search`, `Item`, `Refresh`, `LayoutSwitcher` | Height + padding scale. Matches Button.vue sizes.                        |
| **variant** | `secondary`, `primary`, `destructive`, `textonly` | `Trigger`, `Refresh`, `LayoutSwitcher`                   | Intent-driven styling. Matches Button.vue variants.                      |
| **border**  | `none`, `active`, `invalid`                       | `Trigger`                                                | Border state: none (default), active (open), invalid (error).            |
| **layout**  | `single`, `multi`                                 | `Item`                                                   | Single-select vs multi-select item layout. Matches `SelectItem` pattern. |
| **density** | (not used in v1)                                  | —                                                        | Reserved for future compact/comfortable/spacious modes.                  |

**Default variants:**

- `Trigger`: `size="md"`, `variant="secondary"`, `border="none"`
- `Search`: `size="md"`
- `Item`: `layout="single"`
- `Refresh`: `size="icon"`, `variant="secondary"`
- `LayoutSwitcher`: `size="icon-sm"`, `variant="secondary"`

### d) Slot-prop conventions for `<RemoteCombo.Item>`

The `Item` component uses slot props to allow consumers to override the default rendering while maintaining schema-driven content. This mirrors the `FormDropdownMenuItem` pattern.

```vue
<RemoteCombo.Item :item="item" :index="index">
  <template #default="{ item, isHighlighted, isSelected }">
    <!-- Custom content here; falls back to default if not provided -->
    <div class="flex items-center gap-2">
      <span>{{ item.label }}</span>
      <span v-if="item.description" class="text-muted-foreground text-xs">
        {{ item.description }}
      </span>
    </div>
  </template>
</RemoteCombo.Item>
```

**Slot props:**

- `item: DropdownItem` — The mapped item object (label, value, description, icon, previewUrl, etc.)
- `isHighlighted: boolean` — True if keyboard-focused (reka-ui `data-highlighted`)
- `isSelected: boolean` — True if checked/selected (reka-ui `data-[state=checked]`)
- `index: number` — Item index in the list

**Default rendering (when slot is not provided):**

- Label + optional description (if `item.description` exists)
- Optional preview image (if `item.previewUrl` exists, e.g., for asset dropdowns)
- Checkmark icon on selected items (multi-select only)

This convention allows:

1. **Schema-driven defaults** — most consumers use the default slot
2. **Override capability** — custom nodes can provide a slot for specialized rendering
3. **Consistency** — matches `FormDropdownMenuItem` precedent in the codebase

### e) A11y minimums

**What reka-ui Combobox provides for free:**

- `aria-expanded` on trigger (reflects open/closed state)
- `aria-controls` linking trigger to content
- `aria-activedescendant` on input, pointing to highlighted item
- `role="listbox"` on list container
- `role="option"` on items
- Keyboard navigation: Arrow Up/Down, Enter to select, Escape to close, Tab to move focus
- Focus management: focus returns to trigger after selection

**What RemoteCombo adds:**

- `aria-label` on trigger: `"Select ${fieldLabel}"` (from widget spec)
- `aria-label` on search input: `"Search ${fieldLabel}"` (from widget spec)
- `aria-live="polite"` on loading/error states: announces state changes to screen readers
- `aria-label` on refresh button: `"Refresh options"` (i18n)
- `aria-label` on layout switcher buttons: `"List view"` / `"Grid view"` (i18n)
- `sr-only` text for empty state: `"No results found"` (i18n, visible to screen readers)
- Error announcements: `aria-live="assertive"` on error container, announces error message immediately
- Disabled state: `aria-disabled="true"` on trigger when loading or error

**A11y instrumentation level:** **Well-instrumented.** The codebase uses reka-ui primitives (which have solid ARIA support) + explicit labels + live regions for dynamic state. Matches the pattern in `ColorPicker.vue` and `TagsInput.vue`.

### f) Iconography decision

**Icon system:** The codebase uses **Lucide icons via Iconify** (`@iconify-json/lucide` + `@iconify/tailwind4` plugin).

**Icon invocation:** Inline `<i class="icon-[lucide--{name}]" />` in templates. No separate Icon component wrapper.

**RemoteCombo icon names:**

- **Refresh button:** `icon-[lucide--rotate-cw]` (refresh/reload)
- **Search input:** `icon-[lucide--search]` (magnifying glass, optional prefix icon)
- **Clear search:** `icon-[lucide--x]` (close/clear)
- **Loading spinner:** `icon-[lucide--loader-circle]` (animated with `animate-spin`)
- **Error icon:** `icon-[lucide--alert-circle]` (error state)
- **Layout list view:** `icon-[lucide--list]` (vertical list)
- **Layout grid view:** `icon-[lucide--grid-2x2]` (2x2 grid)
- **Checkmark (selected item):** `icon-[lucide--check]` (selection indicator)

**Icon sizing:** Use `size-*` Tailwind classes (e.g., `size-4`, `size-5`) or set font-size on parent. Do NOT use `text-*` classes for icon sizing (Iconify icons scale via `1.2em` relative to font-size).

### g) Motion conventions

**Animations:** The codebase uses Tailwind v4 animation utilities + `tw-animate-css` plugin for extended animations.

**RemoteCombo motion:**

| Surface                      | Animation             | Duration | Easing      | Tailwind Classes                                                                                 |
| ---------------------------- | --------------------- | -------- | ----------- | ------------------------------------------------------------------------------------------------ |
| **Content (dropdown panel)** | Fade + zoom in        | 150ms    | ease-out    | `data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95`          |
|                              | Fade + zoom out       | 150ms    | ease-in     | `data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95` |
|                              | Slide in from top     | 150ms    | ease-out    | `data-[side=bottom]:slide-in-from-top-2`                                                         |
| **Loading spinner**          | Continuous rotation   | 1s       | linear      | `animate-spin`                                                                                   |
| **Item hover**               | Background transition | 100ms    | ease        | `transition-colors` (via CVA base)                                                               |
| **Trigger state change**     | Border transition     | 200ms    | ease-in-out | `transition-all duration-200 ease-in-out` (via SelectTrigger pattern)                            |

**Motion token definitions:** Durations and easings are hardcoded in Tailwind utilities (no custom CSS variables for motion in the current design-system). If motion tokens become necessary in future, add to `style.css`:

```css
@theme {
  --duration-fast: 100ms;
  --duration-normal: 150ms;
  --duration-slow: 200ms;
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
}
```

### h) Design-system gaps and inconsistencies

**Gaps identified:**

1. **Motion tokens are not centralized.** Durations (100ms, 150ms, 200ms) and easings (ease-in-out, ease) are hardcoded in component variants. Recommendation: Extract to CSS variables in `style.css` for consistency across all components.

2. **No density/size scale for dropdowns.** `Button.vue` has `sm/md/lg/icon-sm/icon/icon-lg`, but `SelectItem` only has `md/lg`. Recommendation: Standardize on Button's scale for all interactive components.

3. **Icon sizing convention is implicit.** The codebase uses `size-*` classes for icons, but this is not documented. Recommendation: Add to `src/components/ui/AGENTS.md` that icons use `size-*` (not `text-*`).

4. **No error/warning/success text color tokens.** Only background tokens exist (`--destructive-background`, `--warning-background`, `--success-background`). Recommendation: Add foreground variants:

   ```css
   --destructive-foreground: var(--color-coral-700);
   --warning-foreground: var(--color-gold-600);
   --success-foreground: var(--color-jade-600);
   ```

5. **Focus ring color is generic.** `--ring` is not explicitly defined in the design-system; it falls back to Tailwind default. Recommendation: Explicitly define `--ring: var(--primary-background)` in `style.css` for clarity.

6. **No disabled state tokens.** Disabled styling is hardcoded (`disabled:opacity-50`, `disabled:pointer-events-none`). Recommendation: Add `--disabled-foreground` and `--disabled-background` tokens for consistency.

**Inconsistencies:**

1. **Button.vue uses `focus-visible:ring-ring`; SelectTrigger uses `focus-visible:border-node-component-border`.** Recommendation: Standardize on `focus-visible:ring-ring` for all interactive elements (matches WAI-ARIA best practices).

2. **SearchInput.vue has custom size config (icon positions, padding) hardcoded in `searchInput.variants.ts`.** Other components use pure CVA. Recommendation: Extract size config to a shared utility or document the pattern for future components.

3. **SelectItem uses `data-highlighted` (reka-ui) but Button uses `hover:` (CSS).** Recommendation: Clarify when to use reka-ui data attributes vs CSS pseudo-classes in component guidelines.

### i) Storybook decision

**Current state:** The codebase has **Storybook configured** in `.storybook/` with a `preview.ts` and `main.ts`. The `pnpm storybook` command is available.

**Storybook coverage:** Existing components (`Button.vue`, `Select.vue`, `SearchInput.vue`, `TagsInput.vue`, etc.) have `.stories.ts` files with Default, Disabled, and variant stories.

**Recommendation for RemoteCombo:** **Include Storybook stories in the PR.** Create `RemoteCombo.stories.ts` with:

- **Default story:** Basic remote combo with mock data
- **Loading state:** Spinner visible
- **Error state:** Error message displayed
- **Empty state:** "No results" message
- **Multi-select variant:** Checkmarks on items
- **Custom item slot:** Override default rendering
- **Layout switcher:** Toggle between list and grid views
- **Accessibility story:** Keyboard navigation demo (focus management, arrow keys, Enter/Escape)

This ensures visual regression testing and provides documentation for consumers.

---

**Summary:** The `RemoteCombo` atom family is ready to be wired into the design-system surface. Use semantic tokens from the table in §11.2.b, follow the CVA variant axes in §11.2.c, and implement the a11y minimums in §11.2.e. The identified gaps (motion tokens, density scale, error foreground colors) are low-priority and can be addressed in follow-up PRs without blocking this refactor.

### 11.3 E2E / integration / unit / property testing strategy

#### a) Existing infrastructure summary

**Framework stack:**

- **Vitest 4.0.16** (happy-dom environment, globals enabled, retry: 2 in CI)
- **@playwright/test 1.58.1** (205 E2E tests in `browser_tests/`, projects: chromium, chromium-2x, chromium-0.5x, mobile-chrome, performance, audit, cloud)
- **@vue/test-utils 8.1.0** (component mounting)
- **@testing-library/vue 8.1.0** (behavioral testing)
- **@testing-library/user-event 14.6.1** (user interaction simulation)
- **fast-check 4.5.3** (property testing; light adoption: 1 file `draftCacheV2.property.test.ts`)
- **@vitest/coverage-v8 4.0.16** (v8 provider, reporter: text/json/html/lcov)
- **@vitest/ui 4.0.16** (available but not in CI)

**Test inventory:**

- **Unit tests:** 755 files in `src/**/*.test.ts` (mostly litegraph, layout, canvas, widget logic)
- **E2E tests:** 205 files in `browser_tests/**/*.spec.ts` (canvas, workflows, settings, assets, load3d, linear mode)
- **Snapshot testing:** light adoption (5 files using `toMatchSnapshot`); no inline snapshots
- **Property testing:** minimal (1 file); not a codebase pattern yet
- **HTTP mocking:** dominant pattern is `vi.mock('axios')` with `vi.mocked(axios.get).mockResolvedValueOnce()` (see `useRemoteWidget.test.ts`, `workspaceApi.test.ts`, `releaseService.test.ts`); no MSW setup currently
- **Composable testing:** uses `effectScope()` pattern (see `useWorkspaceBilling.test.ts`, `useErrorSurveyTracking.test.ts`); no `@vitest/browser` mode
- **Test ID convention:** `data-testid` (sparse usage; 5 instances in codebase)
- **Fixtures:** JSON fixtures in `src/**/__fixtures__/` (workflow schemas, assets); E2E fixtures in `browser_tests/fixtures/` (ComfyPage, VueNodeHelpers, selectors); test utilities in `src/utils/__tests__/litegraphTestUtils.ts`
- **CI gates:** `pnpm lint`, `pnpm typecheck`, `pnpm knip`, `pnpm test:unit` (all tests), `pnpm test:browser` (Playwright, 3 retries in CI, 0 local)
- **No TanStack Query tests yet** (library not in use; canonical pattern from https://tanstack.com/query/latest/docs/framework/vue/guides/testing requires QueryClient wrapper with `defaultOptions: { queries: { retry: false } }`)

#### b) Conventions to follow

**File naming & colocation:**

- Unit/component tests colocate with source: `src/path/to/Component.test.ts` (not in `__tests__/` subdirs)
- E2E tests in `browser_tests/tests/` with `.spec.ts` extension
- Fixtures in `__fixtures__/` subdirs or `browser_tests/fixtures/`

**Mount helpers:**

- Composables: `effectScope()` pattern (see `useWorkspaceBilling.test.ts` lines 50–59)
- Components: `@testing-library/vue` `render()` or `@vue/test-utils` `mount()`
- Pinia: `setActivePinia(createPinia())` before each test

**Mock pattern:**

- Axios: `vi.mock('axios')` with `vi.mocked(axios.get).mockResolvedValueOnce()`
- Stores: `vi.hoisted()` for per-test mock state (see `useWorkspaceBilling.test.ts` lines 7–25)
- Composables: mock via `vi.mock('@/path/to/composable')`
- No MSW in current codebase; new tests should use MSW for HTTP (see §11.3.e)

**Test ID attribute:**

- Use `data-testid` (existing convention in codebase)
- Apply to atom roots and interactive elements (buttons, inputs, dropdowns)

#### c) Net-new conventions for RemoteCombo refactor

**TanStack Query test wrapper:**

```typescript
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createApp } from 'vue'

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
}

function createTestApp(component: any) {
  const app = createApp(component)
  const queryClient = createTestQueryClient()
  app.use(VueQueryPlugin, { queryClient })
  return { app, queryClient }
}
```

Reference: https://tanstack.com/query/latest/docs/framework/vue/guides/testing

**MSW handler pattern for `useRemoteOptions`:**

```typescript
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer(
  http.get('/api/remote-route', () => {
    return HttpResponse.json({ items: [...] })
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

Rationale: exercises the full axios → API client → HTTP layer; more realistic than `vi.mock('axios')`; enables testing retry logic and error handling end-to-end.

**Atom-family component test pattern:**

```typescript
import { render, screen } from '@testing-library/vue'
import { RemoteCombo } from '@/renderer/extensions/vueNodes/widgets/components/RemoteCombo'

describe('RemoteCombo.Root', () => {
  it('renders trigger with data-testid', () => {
    render(RemoteCombo.Root, {
      props: { isOpen: false },
      slots: { default: () => 'Trigger text' }
    })
    expect(screen.getByTestId('remote-combo-root')).toBeInTheDocument()
  })
})
```

Each atom (Root, Trigger, Content, Search, List, Item, Empty, Loading, Error, Refresh, LayoutSwitcher) tested in isolation with slot rendering and variant application verified.

#### d) Test pyramid for the refactor

**Unit tests (vitest, happy-dom):**

1. **`src/base/remote/itemSchema.ts`** (pure helpers)
   - `getByPath(obj, path)`: nested objects, arrays, numeric segments, missing keys, null/undefined
   - `resolveLabel(item, labelField)`: string labels, nested paths, fallback to item.id
   - `mapToDropdownItem(raw, schema)`: value_field extraction, label resolution, search_text building, null handling
   - `extractItems(data, itemsPath)`: array extraction, nested paths, non-array data
   - `buildSearchText(item, searchFields)`: multi-field concatenation, null fields, case normalization
   - **Target:** 100% line coverage (pure functions, no I/O)

2. **`src/base/remote/retry.ts`** (pure helpers)
   - `getBackoff(retryCount)`: exponential backoff `Math.min(1000 * 2^retryCount, 16000)` — sequence 2s, 4s, 8s, 16s, 16s, … (1-indexed; first retry is 2s) capped at 16s
   - `isRetriableError(error)`: network errors (ECONNREFUSED, ETIMEDOUT), 5xx status codes, non-retryable (4xx, AbortError)
   - **Target:** 100% line coverage

3. **`src/base/remote/diagnostics.ts`** (pure helpers)
   - `summarizeError(error)`: message extraction, status code formatting, timeout detection
   - `summarizePayload(data, maxChars)`: truncation, JSON stringification, null handling
   - **Target:** 100% line coverage

4. **`src/platform/remote/composables/useRemoteOptions.ts`** (TanStack Query wrapper)
   - **In-flight deduplication:** two concurrent calls with same key return same promise
   - **Key partitioning:** userId/workspaceId/route/params produce distinct cache keys
   - **Retry policy:** honors `isRetriableError`, respects `max_retries` config, exponential backoff
   - **Abort on unmount:** AbortController signal passed to axios, cleanup on component destroy
   - **Refresh via invalidate+refetch:** `queryClient.invalidateQueries()` + `refetch()` flow
   - **Error state:** error object populated on failure, cleared on success
   - **Loading state:** `isLoading` true during fetch, false after data/error
   - **Stale-while-revalidate:** if data exists and TTL not exceeded, return cached; if stale, refetch in background
   - **Test setup:** QueryClient with `retry: false`, MSW server for HTTP
   - **Target:** 90%+ coverage (integration with TanStack Query internals is tested via E2E)

5. **`src/renderer/extensions/vueNodes/widgets/composables/useRemoteCombo.ts`** (view layer)
   - **Auto_select fill-if-empty:** if `auto_select: true` and items exist, select first item
   - **Search index correctness:** search text built from schema fields, case-insensitive matching
   - **Selection state:** `selectedItem` ref updated on user selection, emitted to parent
   - **Control_after_refresh override:** if set, refresh does not auto-select
   - **Execution_success toggle:** if true, refresh on execution completion
   - **Test setup:** mount with mock `useRemoteOptions`, verify computed/ref behavior
   - **Target:** 85%+ coverage

6. **`src/renderer/extensions/vueNodes/widgets/composables/useRemoteWidget.ts` (rewritten, Litegraph adapter)**
   - **First-load defaulting:** if no cached value, use `defaultValue` prop
   - **Control_after_refresh override:** refresh button respects override
   - **Execution_success toggle:** auto-refresh on execution completion
   - **IWidget contract preservation:** `widget.options.values` mutation contract honored (legacy compat)
   - **Refresh button interaction:** manual refresh via `refreshRemoteData()` call
   - **Test setup:** mock node, mock widget, mock `useRemoteOptions`, verify side effects
   - **Target:** 85%+ coverage

**Composable tests (vitest + mount/effectScope):**

- `useRemoteOptions`: 12–15 test cases (dedup, key partitioning, retry, abort, invalidate, error, loading, stale-while-revalidate)
- `useRemoteCombo`: 10–12 test cases (auto_select, search, selection, control_after_refresh, execution_success)
- `useRemoteWidget`: 8–10 test cases (first-load, control_after_refresh, execution_success, widget contract, refresh button)
- **Total composable tests:** ~35–40 test cases
- **Runtime:** ~2–3 seconds (MSW server setup + QueryClient per test)

**Component tests (vitest + @vue/test-utils, possibly browser mode):**

- **RemoteCombo.Root:** renders slot, applies data-testid, passes props to children
- **RemoteCombo.Trigger:** renders trigger text, aria-expanded attribute, click opens dropdown
- **RemoteCombo.Content:** renders list and search, aria-hidden when closed
- **RemoteCombo.Search:** input field, onChange handler, placeholder text
- **RemoteCombo.List:** renders items, aria-activedescendant on keyboard nav, virtualization (if used)
- **RemoteCombo.Item:** renders label, click selects, aria-selected attribute
- **RemoteCombo.Empty:** renders when no items, aria-live region
- **RemoteCombo.Loading:** renders spinner, aria-busy attribute
- **RemoteCombo.Error:** renders error message, retry button
- **RemoteCombo.Refresh:** renders refresh button, onClick handler
- **RemoteCombo.LayoutSwitcher:** renders layout toggle (grid/list), onChange handler
- **Total component tests:** ~11 atoms × 3–5 test cases each = 33–55 test cases
- **Runtime:** ~3–5 seconds (mount overhead)
- **A11y focus:** aria-expanded, aria-activedescendant, aria-selected, aria-busy, aria-live, sr-only labels

**Integration tests (vitest + mount + MSW):**

- **Schema XOR enforcement:** if `item_schema.value_field` exists, use it; else use `item.id`
- **End-to-end selection flow:** fetch → map → display → select → emit → parent receives value
- **Refresh button interaction:** click refresh → invalidate cache → refetch → update display
- **Error recovery:** fetch fails → error state → retry button → refetch succeeds → display updates
- **Abort on unmount:** component unmounts during fetch → AbortController signal fires → no state update
- **Test setup:** full component tree (Root + Trigger + Content + List + Item), MSW server, QueryClient
- **Total integration tests:** ~6–8 test cases
- **Runtime:** ~2–3 seconds

**E2E tests (Playwright):**

- **At least one test** that exercises a real comfy-api remote-combo route (or MSW intercept of it):
  - Open dropdown
  - Type search query
  - Select item from list
  - Confirm value persisted to workflow JSON
  - Verify refresh button re-fetches and updates display
- **Test file:** `browser_tests/tests/remoteCombo.spec.ts`
- **Setup:** ComfyPage fixture, MSW server (or real API if available), workflow with remote-combo widget
- **Runtime:** ~5–10 seconds per test

**Property tests (fast-check):**

- **`mapToDropdownItem(raw, schema)` is a clean target:**

  ```typescript
  import * as fc from 'fast-check'

  describe('mapToDropdownItem property tests', () => {
    it('mapping is total and stable', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.string(),
            label: fc.string(),
            custom_field: fc.string()
          }),
          fc.record({
            value_field: fc.constant('id'),
            label_field: fc.constant('label')
          }),
          (raw, schema) => {
            const item1 = mapToDropdownItem(raw, schema)
            const item2 = mapToDropdownItem(raw, schema)
            expect(item1).toEqual(item2) // stable
            expect(item1.id).toBeDefined() // total
          }
        )
      )
    })

    it('if schema.value_field exists in raw, mapped item.id is non-empty', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.string({ minLength: 1 }),
            label: fc.string()
          }),
          (raw) => {
            const schema = { value_field: 'id', label_field: 'label' }
            const item = mapToDropdownItem(raw, schema)
            expect(item.id).toBeTruthy()
          }
        )
      )
    })
  })
  ```

- **Target:** 2–3 property tests for pure helpers
- **Runtime:** ~1–2 seconds

#### e) Mock layer decision: MSW vs vi.mock

**Decision: Use MSW for new tests.**

**Rationale:**

- Exercises the full axios → API client → HTTP layer end-to-end
- Enables testing retry logic, timeout handling, and error recovery realistically
- Decouples tests from axios internals (if axios is replaced, tests still pass)
- Supports testing concurrent requests and deduplication
- Existing codebase uses `vi.mock('axios')` for simple cases; MSW is a step up for complex async flows

**When to use vi.mock('axios'):**

- Simple unit tests of pure functions that don't depend on HTTP behavior
- Mocking a single axios call with a fixed response
- Testing error handling in isolation (e.g., `isRetriableError`)

**When to use MSW:**

- Composable tests that exercise TanStack Query's retry/dedup logic
- Integration tests with multiple HTTP calls
- E2E tests that need realistic HTTP behavior

**Setup (once per test file):**

```typescript
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

const server = setupServer(
  http.get('/api/remote-route', () => HttpResponse.json({ items: [...] }))
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

#### f) Test ID convention

**Attribute:** `data-testid`

**Naming pattern:** `{component-name}-{element-role}`

**Examples:**

- `data-testid="remote-combo-root"` (RemoteCombo.Root)
- `data-testid="remote-combo-trigger"` (RemoteCombo.Trigger)
- `data-testid="remote-combo-search-input"` (RemoteCombo.Search input)
- `data-testid="remote-combo-list"` (RemoteCombo.List)
- `data-testid="remote-combo-item-{index}"` (RemoteCombo.Item, indexed)
- `data-testid="remote-combo-empty"` (RemoteCombo.Empty)
- `data-testid="remote-combo-loading"` (RemoteCombo.Loading)
- `data-testid="remote-combo-error"` (RemoteCombo.Error)
- `data-testid="remote-combo-refresh"` (RemoteCombo.Refresh button)

**Application:**

- Add to atom roots and interactive elements
- Use in Playwright E2E tests: `page.getByTestId('remote-combo-trigger').click()`
- Use in component tests: `screen.getByTestId('remote-combo-root')`

#### g) CI runtime budget

**Unit tests (vitest):**

- Pure helpers (`base/remote/`): ~0.5 seconds
- Composables (`useRemoteOptions`, `useRemoteCombo`, `useRemoteWidget`): ~3 seconds (MSW server setup)
- Components (RemoteCombo atoms): ~5 seconds (mount overhead)
- Integration tests: ~3 seconds
- **Total unit:** ~11–12 seconds (sequential, no parallelism due to MSW server)

**E2E tests (Playwright):**

- RemoteCombo E2E suite: ~10–15 seconds (1–2 tests, 5–10s each)
- Existing E2E tests: ~60–90 seconds (205 tests, parallelized across workers)
- **Total E2E:** ~70–105 seconds (new tests add ~10–15s)

**CI gates (existing):**

- `pnpm lint`: ~10 seconds
- `pnpm typecheck`: ~15 seconds
- `pnpm knip`: ~5 seconds
- `pnpm test:unit`: ~30 seconds (all 755 tests)
- `pnpm test:browser`: ~90 seconds (205 E2E tests, 3 retries in CI)
- **Total CI time:** ~150 seconds (2.5 minutes)

**Added by RemoteCombo refactor:**

- New unit tests: +11–12 seconds (included in `pnpm test:unit`)
- New E2E tests: +10–15 seconds (included in `pnpm test:browser`)
- **Total added:** ~21–27 seconds (net CI impact: ~3.5–4.5 minutes total)

#### h) Coverage targets

**Must-cover (new code):**

- `src/base/remote/itemSchema.ts`: 100% (pure functions)
- `src/base/remote/retry.ts`: 100% (pure functions)
- `src/base/remote/diagnostics.ts`: 100% (pure functions)
- `src/platform/remote/composables/useRemoteOptions.ts`: 90%+ (TanStack Query integration tested via E2E)
- `src/renderer/extensions/vueNodes/widgets/composables/useRemoteCombo.ts`: 85%+
- `src/renderer/extensions/vueNodes/widgets/composables/useRemoteWidget.ts`: 85%+ (legacy adapter)
- `src/renderer/extensions/vueNodes/widgets/components/RemoteCombo/*.vue`: 80%+ (atoms, a11y attributes)

**Aspirational (existing code touched):**

- `src/schemas/nodeDefSchema.ts`: maintain existing coverage
- `src/renderer/extensions/vueNodes/widgets/composables/useComboWidget.ts`: maintain existing coverage
- `src/stores/authStore.ts`: maintain existing coverage
- `src/scripts/api.ts`: maintain existing coverage

**Coverage thresholds (CI gate):**

- Lines: 80% (new code only)
- Branches: 75% (new code only)
- Functions: 85% (new code only)
- Statements: 80% (new code only)

#### i) Out of scope

- **Visual regression testing:** no Storybook visual tests (Storybook exists but not integrated with visual regression tools)
- **Cross-browser E2E:** Playwright config includes chromium, mobile-chrome, 2x/0.5x scale factors; no Firefox/Safari (not in existing matrix)
- **Performance tests:** no Lighthouse/Core Web Vitals tests (existing `@perf` tag tests are manual; not automated)
- **Accessibility audit:** no axe-core integration (a11y attributes tested manually; no automated scanning)
- **Snapshot testing:** no snapshot tests for RemoteCombo atoms (snapshots are brittle; prefer explicit assertions)
- **Locale tests:** no i18n-specific tests (RemoteCombo uses existing i18n infrastructure; no new strings)
- **Custom node integration tests:** no tests for external custom nodes using `remote=` (audit in §9 identified 1 affected repo; migration guidance in §9 suffices)

---

**Summary:** The test plan balances coverage (100% for pure helpers, 85%+ for composables/components) with pragmatism (MSW for HTTP, effectScope for composables, E2E for end-to-end flows). Total added runtime is ~21–27 seconds; CI gates remain at ~150 seconds. No new infrastructure (MSW, TanStack Query test wrapper) is required beyond what's already in the codebase.

## 12. Naming proposal — RemoteOptions / RemoteComboOptions / RichComboWidget rename

**Status: PROPOSED for both PRs (#11310 frontend + #13432 backend).** Apply in lockstep; do not land asymmetrically.

### 12.1 Why the current names confuse

The current pair is `RemoteOptions` (legacy flat string array) vs `RemoteComboOptions` (new rich-object array, with `RemoteItemSchema`). On the frontend the corresponding pair is `useRemoteWidget` (legacy Litegraph) vs `RichComboWidget.vue` (new Vue) plus the kwargs `remote=` vs `remote_combo=`. Reviewer feedback called these names confusing because:

1. **Both already live under `Combo.Input`.** "Combo" in the name is not discriminating — adding "Combo" only to the new one suggests the legacy one is _not_ a combo, which is false.
2. **"Rich" describes the rendering, not the data.** The actual axis of difference is the _shape of items_ (flat strings vs structured objects with a schema). Using "Rich" hides that.
3. **`remote=` is too generic.** Both kwargs fetch from a remote endpoint; the kwarg name doesn't tell custom-node authors which one they're picking.
4. **Frontend symbol pair is mixed metaphor.** `useRemoteWidget` (data source) vs `RichComboWidget` (item shape) vs `RemoteComboConfig` (compound) — three different framings for one feature pair.
5. **Industry survey** (12 libraries: shadcn-vue, Reka UI, Headless UI, MUI, Mantine, PrimeVue, Ant Design Vue, Element Plus, Naive UI, plus JSON Schema / Django / Stripe SDK conventions) found that **no major library splits naming by item shape**. They use one component with field-mapping props (`optionLabel`, `getOptionLabel`, `fieldNames`, `itemToString`). Where they do name an item type, it's a generic `SelectItem` / `ComboboxItem` / `SelectOption`. Nobody calls one path "Rich" and the other plain.

### 12.2 The actual axis of distinction

The two configurations differ on **item shape**, not on any other axis:

| Concept                    | Items shape                                                             | Rendering                                   |
| -------------------------- | ----------------------------------------------------------------------- | ------------------------------------------- |
| Legacy (`RemoteOptions`)   | `string[]` (flat scalar)                                                | Plain dropdown                              |
| New (`RemoteComboOptions`) | `Array<{ ...fields }>` (structured, requires `RemoteItemSchema` to map) | Rich rows: previews, search, virtual scroll |

Naming should expose this single axis explicitly.

### 12.3 Two viable rename options

Both are improvements over the status quo. The team picks one and applies it everywhere — backend, frontend, schema, component, kwargs.

#### Option N1 — `Scalar` vs `Object` (RECOMMENDED)

Names the data shape directly. Maximally explicit. Matches the JSON Schema / OpenAPI convention (primitive `enum` of strings vs `oneOf` of objects).

| Layer                         | Current                                     | N1                                                                                                                                                                |
| ----------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend class (legacy)        | `RemoteOptions`                             | `RemoteScalarOptions`                                                                                                                                             |
| Backend class (new)           | `RemoteComboOptions`                        | `RemoteObjectOptions`                                                                                                                                             |
| Backend item-schema           | `RemoteItemSchema`                          | `RemoteObjectFields` _(or keep `RemoteItemSchema` — see §12.5)_                                                                                                   |
| Backend kwarg (legacy)        | `remote=`                                   | `remote_scalar=`                                                                                                                                                  |
| Backend kwarg (new)           | `remote_combo=`                             | `remote_object=`                                                                                                                                                  |
| Frontend Zod schemas          | `zRemoteWidgetConfig`, `zRemoteComboConfig` | `zRemoteScalarConfig`, `zRemoteObjectConfig`                                                                                                                      |
| Frontend types                | `RemoteWidgetConfig`, `RemoteComboConfig`   | `RemoteScalarConfig`, `RemoteObjectConfig`                                                                                                                        |
| Frontend Vue component        | `RichComboWidget.vue`                       | `RemoteObjectComboWidget.vue` _(deleted in this PR per §3.5; replaced by `RemoteCombo/` atom family — naming applies to the schema/config, not the widget shell)_ |
| Frontend Litegraph composable | `useRemoteWidget`                           | `useRemoteScalarCombo`                                                                                                                                            |
| Frontend Vue composable       | `useRemoteCombo`                            | `useRemoteObjectCombo`                                                                                                                                            |

**Pros:** Self-explanatory. Matches existing Python/JSON conventions. Survives ecosystem churn (the _axis_ won't change even if the rendering does).
**Cons:** "Object" is broad — but the docstring + `item_schema` requirement makes the meaning unambiguous. Slightly verbose kwargs.

#### Option N2 — keep `RemoteOptions` for the legacy, rename the new one to `RemoteRecordOptions`

If the team prefers minimal backend churn (just one new class to name, leave `RemoteOptions` alone), use "Record" — a TypeScript/database-flavored term for a structured object with a known schema.

| Layer                  | Current              | N2                            |
| ---------------------- | -------------------- | ----------------------------- |
| Backend class (legacy) | `RemoteOptions`      | `RemoteOptions` _(unchanged)_ |
| Backend class (new)    | `RemoteComboOptions` | `RemoteRecordOptions`         |
| Backend item-schema    | `RemoteItemSchema`   | `RemoteRecordSchema`          |
| Backend kwarg (legacy) | `remote=`            | `remote=` _(unchanged)_       |
| Backend kwarg (new)    | `remote_combo=`      | `remote_record=`              |
| Frontend types         | `RemoteComboConfig`  | `RemoteRecordConfig`          |
| Frontend composable    | `useRemoteCombo`     | `useRemoteRecord`             |

**Pros:** Smallest blast radius (legacy is preserved verbatim). "Record" maps to a familiar TS concept (`Record<K, V>`) and is shorter than "Object".
**Cons:** Asymmetric — the name only signals "this is the new one" by being different from `RemoteOptions`. Still requires a docstring to explain that `RemoteOptions` returns scalars and `RemoteRecordOptions` returns records.

### 12.4 Recommendation: Option N1 (`Scalar`/`Object`)

The user explicitly asked for clearer names. Symmetric naming on both sides of the axis is more honest than asymmetric naming. The blast radius is small (audit §9 found 1 external repo using `RemoteOptions` legacy, and they'd already be migrating per §1 #6/#8). Renaming both classes simultaneously means custom-node authors learn the axis once.

### 12.5 What stays

- **`RemoteItemSchema`** can stay as-is. "ItemSchema" is generic enough to describe the mapping for any structured-item dropdown; it's not coupled to the "combo" framing. _Alternative_: rename to `RemoteObjectFields` under N1 to keep the family consistent (the schema describes how to extract `value_field`/`label_field`/etc. from each _object_). Open decision — flagged below.
- **`Combo.Input`** stays. The kwargs `remote=` / `remote_combo=` change to `remote_scalar=` / `remote_object=` (N1) but the parent stays `Combo.Input` because that's the input _type_, not the data source.
- **The `RemoteCombo/` atom family** (Phase 4) is unaffected by the rename. The atoms (`Root`, `Trigger`, `Content`, `Item`, etc.) are presentation-layer; they consume the renamed config but don't need to mirror its name.

### 12.6 Application checklist (both PRs in lockstep)

- [ ] **Backend (`pr-13432`)**: rename class `RemoteOptions → RemoteScalarOptions` and `RemoteComboOptions → RemoteObjectOptions` in `comfy_api/latest/_io.py`; rename kwargs on `Combo.Input` from `remote=` / `remote_combo=` to `remote_scalar=` / `remote_object=`; update `__all__`; update XOR validation messages; update test file from `tests-unit/comfy_api_test/remote_combo_options_test.py` → `remote_object_options_test.py` and rename test scenarios accordingly.
- [ ] **Frontend (`pr-11310`)**: rename Zod schemas `zRemoteWidgetConfig → zRemoteScalarConfig` and `zRemoteComboConfig → zRemoteObjectConfig` in `src/schemas/nodeDefSchema.ts`; update derived TS types; rename `inputSpec.remote` field → `remote_scalar` and `remote_combo` → `remote_object` in `zComboInputOptions`; update `WidgetSelect.vue` `hasRemoteCombo` → `hasRemoteObject`; rename utilities `richComboHelpers.ts` → `remoteObjectHelpers.ts` (per §3.1 the file moves to `base/remote/` anyway); rename composable `useRemoteCombo` → `useRemoteObjectCombo`; rename rewritten Litegraph composable `useRemoteWidget` → `useRemoteScalarCombo`; update wire-format snapshot tests.
- [ ] **Cross-PR consistency**: land both renames in the same release. The frontend Zod expects field names matching the backend's `as_dict()` output, so the wire-format change has to be atomic.
- [ ] **Migration table** (§9): update the `control_after_refresh → auto_select` row to use the new kwarg names so the SLA-style migration message stays accurate.
- [ ] **No deprecation** (per decision #9 in §7): the rename ships silently; the one affected external repo (`jtydhr88/comfyui-custom-node-skills`) does a 2-line edit (`RemoteOptions` → `RemoteScalarOptions`, `control_after_refresh` → `auto_select`).

### 12.7 Open sub-decisions

- **Q-N1**: Rename `RemoteItemSchema` to `RemoteObjectFields`, or leave as-is? _Default: leave as-is for minimal churn; only rename if the team votes for full symmetry._
- **Q-N2**: For the rewritten Litegraph composable, is `useRemoteScalarCombo` clearer than `useRemoteScalar`? Both work; the longer form mirrors the Vue-side composable's name. _Default: `useRemoteScalarCombo` for symmetry._
- **Q-N3**: Do we want a discriminator field on the wire (e.g. `remote.kind: 'scalar' | 'object'`) instead of two separate top-level fields? Worth it for future spec types but expands scope. _Default: no — keep two fields, XOR-enforced, matches today's serializer behavior._

---

> **Edit history:**
>
> - v1 — initial draft
> - v2 — Q1–Q6 resolved; auth-teardown CONFIRMED (§8 mechanism); custom-node audit added (§9); authenticatedFetch removed; legacy convert via Option 1 locked
> - v3 — deprecation/outreach removed (§9 retained as rationale only); §11 placeholders for next iterations; minor wording cleanup
> - v4 — §11.1 / §11.2 / §11.3 filled in by three parallel fresh-context investigations; doc grew from ~315 → ~1341 lines
> - v5 — addressed CodeRabbit findings (markdownlint MD040 on §3.1/§3.3/§11.1.a fenced blocks; §11.1.d phase placement aligned to Phase 4; §11.3.d backoff sequence corrected to 2s/4s/8s/16s capped at 16s matching `BACKOFF_BASE_MS=1000`/`BACKOFF_CAP_MS=16000` in `richComboHelpers.ts`); added §12 naming proposal (`Scalar`/`Object` rename for both PRs in lockstep)
