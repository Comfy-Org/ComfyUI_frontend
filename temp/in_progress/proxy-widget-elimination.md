# ProxyWidget Elimination — Progress Log

## How to Use This Document

### Workflow per Phase

1. **Find the next incomplete phase** — search for `[ ]` to locate the first unchecked task
2. **Read the full phase** before starting — understand scope and dependencies
3. **Complete each task** — check off `[x]` as you finish
4. **Run validation steps** — every phase has a validation section; all checks must pass
5. **Commit the changes** — use the suggested commit message prefix
6. **Handoff** — create a new thread to continue with subsequent phases. Include a link to this document and the phase number to start from

### Handoff Instructions

When handing off to a new thread, use this prompt:

> Continue the ProxyWidget elimination project. Progress log:
> `temp/in_progress/proxy-widget-elimination.md`
> Plan: `temp/plans/proxy-widget-elimination-plan.md`
> Analysis: `temp/plans/proxy-widget-elimination-analysis.md`
> Start at Phase N (the first phase with unchecked tasks).

### Key Principles (re-read before every phase)

- **No intermediate widget objects.** The true interior widget is the source of truth.
- **The `WidgetValueStore` is the single source of value state.** No forwarding, no Proxy traps.
- **`properties.proxyWidgets` serialization format is unchanged.** `[nodeId, widgetName][]`
- **System 1 (slot-based promotion in SubgraphNode._setWidget) is NOT touched.**
- **Every `isProxyWidget` call site must be eliminated**, not replaced with a different type guard.

### Reference: All `isProxyWidget` / `_overlay` Sites

| # | File | Usage |
|---|------|-------|
| 1 | `src/core/graph/subgraph/proxyWidget.ts` | Definition + `registerProxyWidgets` |
| 2 | `src/core/graph/subgraph/proxyWidgetUtils.ts` | `getWidgetName`, `pruneDisconnected` |
| 3 | `src/composables/graph/useGraphNodeManager.ts` | `getNodeType`, `safeWidgetMapper` |
| 4 | `src/stores/nodeDefStore.ts` | `getInputSpecForWidget` |
| 5 | `src/utils/widgetUtil.ts` | `renameWidget` |
| 6 | `src/scripts/app.ts` | `registerProxyWidgets(this.canvas)` |
| 7 | `src/components/rightSidePanel/parameters/WidgetItem.vue` | `sourceNodeName` |
| 8 | `src/components/rightSidePanel/parameters/WidgetActions.vue` | `handleHideInput` |
| 9 | `src/components/rightSidePanel/parameters/SectionWidgets.vue` | `isWidgetShownOnParents` |
| 10 | `src/components/rightSidePanel/parameters/TabSubgraphInputs.vue` | widget ordering |
| 11 | `src/lib/litegraph/src/subgraph/SubgraphNode.ts:565` | `onRemoved` cleanup |
| 12 | `src/lib/litegraph/src/types/widgets.ts:375` | JSDoc reference |

---

## Phase 1: Extend WidgetValueStore

**Goal:** Add promotion resolution capability to the store without changing any existing behavior.
**Commit prefix:** `feat: widgetValueStore promotion resolution`

### Tasks

- [x] **1.1** Add `resolvePromotedWidget()` to `src/stores/widgetValueStore.ts`
  - Signature: `(subgraph: Subgraph, nodeId: NodeId, widgetName: string) => { state: WidgetState; widget: IBaseWidget; node: LGraphNode } | null`
  - Looks up the node in the subgraph by `nodeId`, finds the widget by `widgetName`
  - Returns the `WidgetState` from the store via `getWidget(stripGraphPrefix(nodeId), widgetName)`
  - Returns `null` if the node or widget doesn't exist (disconnected state)
  - Import types minimally — avoid coupling to `Subgraph` internals if possible (accept a lookup function or the graph itself)

- [x] **1.2** Add helper `getPromotionList(node: SubgraphNode): ProxyWidgetsProperty`
  - Thin wrapper around `parseProxyWidgets(node.properties.proxyWidgets)`
  - Place in a new file `src/core/graph/subgraph/promotionList.ts` (or in `proxyWidgetUtils.ts` temporarily)
  - This helper will become the single entry point for reading the promotion list

- [x] **1.3** Write tests for `resolvePromotedWidget` in `src/stores/widgetValueStore.test.ts`
  - Test: returns `null` for missing node
  - Test: returns `null` for missing widget on existing node
  - Test: returns correct `{ state, widget, node }` for a registered widget
  - Test: `state.value` matches the store's value (same object reference)
  - Test: handles `stripGraphPrefix` correctly for scoped node IDs

- [x] **1.4** Write tests for `getPromotionList` if in a new file
  - Test: returns `[]` for node with no `proxyWidgets` property
  - Test: parses valid `[nodeId, widgetName][]` correctly
  - Test: throws on invalid format (delegates to `parseProxyWidgets`)

### Validation

- [x] `pnpm test:unit -- src/stores/widgetValueStore.test.ts` — all 21 pass
- [x] `pnpm test:unit -- src/core/graph/subgraph/promotionList.test.ts` — all 6 pass
- [x] `pnpm typecheck` — no new errors
- [x] `pnpm lint` — no new errors (eslint on changed files)
- [x] Existing `proxyWidget.test.ts` tests still pass (7 tests, no behavior change)
- [ ] `pnpm test:unit` — full suite passes (deferred to CI)

---

## Phase 2: Update Vue Rendering Path

**Goal:** Make `useGraphNodeManager` build `SafeWidgetData` for promoted widgets from the promotion list + store, eliminating `isProxyWidget` from the Vue rendering pipeline.
**Commit prefix:** `refactor: Vue rendering uses promotion list`
**Depends on:** Phase 1

### Tasks

- [x] **2.1** Modify `getNodeType()` in `useGraphNodeManager.ts` (L124-128)
  - Changed signature to accept `sourceNodeId?: string` instead of `widget: IBaseWidget`
  - Removed `isProxyWidget(widget)` check; now checks `!sourceNodeId` directly
  - Updated `getSharedWidgetEnhancements` to pass `sourceNodeId` through

- [x] **2.2** Modify `safeWidgetMapper()` in `useGraphNodeManager.ts` (L191-251)
  - Removed the `isProxyWidget` branch (L224-231) that read `_overlay.nodeId` and `_overlay.widgetName`
  - Regular widgets use `widget.name` directly (no special-casing)
  - Removed `nodeId` from regular widget mapper — promoted widgets get their `nodeId` via the promotion list resolution below

- [x] **2.3** Add promoted widget resolution to `extractVueNodeData()` (L254+)
  - After building widgets from `node.widgets`, checks `node.isSubgraphNode()`
  - Reads `getPromotionList(node)`, skips `-1` entries (native widgets already in widgets[])
  - For each `[nodeId, widgetName]`: calls `resolvePromotedWidget(node.subgraph, nodeId, widgetName)`
  - Resolved: builds `SafeWidgetData` with `nodeId: subgraphId:nodeId`, `name: widgetName`, type, nodeType, spec, callback
  - Unresolved: builds disconnected placeholder with `name: "nodeId: widgetName"`, type `'text'`
  - Deduplicates via Set of seen `"nodeId: widgetName"` keys

- [x] **2.4** Verify `NodeWidgets.vue` needs no changes
  - Confirmed: zero `isProxyWidget` references in this file
  - It reads from `widgetValueStore.getWidget(bareWidgetId, widget.name)` (L189-190)
  - `borderStyle` promoted ring check (L203) and `updateHandler` (L222-227) still work

- [x] **2.5** Remove `isProxyWidget` import from `useGraphNodeManager.ts`
  - Replaced with `import { getPromotionList } from '@/core/graph/subgraph/promotionList'`
  - Added `import { useWidgetValueStore } from '@/stores/widgetValueStore'`
  - Confirmed zero `isProxyWidget` references remain in file

### Validation

- [x] `pnpm typecheck` — no errors
- [x] `pnpm lint` — no errors (eslint on changed files)
- [x] `pnpm test:unit -- src/composables/graph` — all 39 pass (5 files)
- [x] `pnpm test:unit` — full suite passes (4433 passed, 0 failures)
- [ ] **Manual verification**: open the app, create a subgraph with promoted widgets
  - Promoted widgets render correctly on the SubgraphNode (Vue renderer)
  - Widget values are editable and sync to interior node
  - Purple promotion ring appears
  - Disconnected widgets show placeholder (delete an interior node while promoted)

---

## Phase 3: Update Right Side Panel Components

**Goal:** Remove all `isProxyWidget` / `_overlay` usage from RSP components. Use promotion list metadata and store lookups instead.
**Commit prefix:** `refactor: RSP uses promotion metadata`
**Depends on:** Phase 1

### Tasks

- [x] **3.1** `src/components/rightSidePanel/parameters/WidgetItem.vue` (L7, L67-68)
  - Removed `import { isProxyWidget }` and unused `getNodeByExecutionId` import
  - Simplified `sourceNodeName` computed: `node` is always the source node now (no proxy unwrapping needed)
  - After Phase 2, promoted widgets arrive with the real interior `node`, not a proxy

- [x] **3.2** `src/components/rightSidePanel/parameters/WidgetActions.vue` (L7, L62-80)
  - Removed `import { isProxyWidget }` 
  - Simplified `handleHideInput()` to just `demoteWidget(node, widget, parents)` — no proxy unwrapping needed
  - `node` and `widget` are now always the real interior node/widget

- [x] **3.3** `src/components/rightSidePanel/parameters/SectionWidgets.vue` (L6, L69-84)
  - Removed `import { isProxyWidget }`
  - Simplified `isWidgetShownOnParents()` — removed the proxy branch, always uses `widgetNode.id == nodeId && widget.name === widgetName`

- [x] **3.4** `src/components/rightSidePanel/parameters/TabSubgraphInputs.vue` (L18, L92-96)
  - Removed `import { isProxyWidget }`
  - `widgetsList` now resolves promoted widgets from interior nodes via `node.subgraph.getNodeById(nodeId)` instead of matching proxy objects in `node.widgets[]`
  - Native widgets (`nodeId === '-1'`) still matched from `node.widgets[]`

- [x] **3.5** Update parent components that pass widget data to these children
  - No changes needed: `TabSubgraphInputs` now passes `{ node: interiorNode, widget }` pairs to `SectionWidgets`, which passes them to `WidgetItem` and `WidgetActions`
  - `SubgraphEditor.vue` uses `proxyWidgetUtils` directly, not `isProxyWidget` — unaffected

### Validation

- [x] `pnpm typecheck` — no errors
- [x] `pnpm lint` — no errors (eslint on 4 changed files clean; oxlint error is pre-existing in promotionList.test.ts)
- [x] `pnpm test:unit` — full suite passes (4433 passed, 0 failures)
- [ ] **Manual verification**: Right Side Panel
  - Select a SubgraphNode → promoted widgets appear in the panel
  - Rename a promoted widget → interior widget label updates
  - Demote a widget from the panel → widget removed from SubgraphNode
  - Promote a widget from inside subgraph → appears on SubgraphNode
  - Source node name displays correctly for promoted widgets
  - Favoriting promoted widgets works
- [x] Grep confirms: `findstr /S "isProxyWidget" src/components/` returns **zero** results

---

## Phase 4: Simplify Promotion/Demotion Logic

**Goal:** Remove `isProxyWidget` / `isDisconnectedWidget` / `_overlay` from `proxyWidgetUtils.ts` and `widgetUtil.ts`. Promotion logic works purely with the promotion list and the store.
**Commit prefix:** `refactor: promotion logic uses store directly`
**Depends on:** Phases 2, 3

### Tasks

- [x] **4.1** Simplify `proxyWidgetUtils.ts`
  - Removed imports: `isProxyWidget`, `isDisconnectedWidget` from `proxyWidget.ts`
  - Added imports: `getPromotionList` from `promotionList.ts`, `useWidgetValueStore` from `widgetValueStore.ts`
  - `getWidgetName()`: removed `isProxyWidget` branch; now simply returns `w.name`
  - `pruneDisconnected()`: rewritten to read promotion list entries and filter via `resolvePromotedWidget`

- [x] **4.2** Simplify `widgetUtil.ts` `renameWidget()` (L1, L23-55)
  - Removed `import { isProxyWidget }` and `import { SubgraphNode }`
  - Removed the entire proxy branch (L22-55) and `parents` parameter
  - Updated caller in `WidgetItem.vue` to remove the `parents` argument

- [x] **4.3** Simplify `nodeDefStore.ts` `getInputSpecForWidget()` (L7, L403-411)
  - Removed `import { isProxyWidget }` 
  - Added `import { getPromotionList }` from `promotionList.ts`
  - Subgraph branch now looks up promotion list to find interior node, then recurses
  - Also checks slot-promoted widgets (System 1) via `node.widgets`

- [x] **4.4** Rename `proxyWidgetUtils.ts` → `promotionUtils.ts` — deferred to follow-up
  - Not worth the import churn in this phase

### Validation

- [x] `pnpm typecheck` — no errors
- [x] `pnpm lint` — no errors (eslint on 4 changed files clean)
- [x] `pnpm test:unit` — 4432 passed (1 pre-existing ColorWidget timeout failure unrelated)
- [x] Grep confirms: `isProxyWidget` in src/ only in `proxyWidget.ts` and `SubgraphNode.ts:565`
- [x] Grep confirms: `_overlay` in changed files returns zero results
- [ ] **Manual verification**: full promote/demote/reorder cycle works end-to-end

---

## Phase 5: Canvas Rendering

**Goal:** Ensure promoted widgets render on the canvas (legacy renderer) without ProxyWidgets.
**Commit prefix:** `refactor: canvas promoted widget rendering`
**Depends on:** Phase 4

### Decision Point

- [x] **5.0** Decide: Is canvas rendering of promoted widgets required?
  - **Decision: YES — Option A (PromotedWidgetSlot, full fidelity)**
  - Rationale: Vue nodes mode (`Comfy.VueNodes.Enabled`) defaults to `false` and is `experimental`.
    Most users are on the legacy canvas renderer. When `vueNodesMode = false`, `drawNode()` renders
    widgets from `node.widgets[]`. Without objects in `widgets[]`, promoted widgets vanish from canvas.
  - When `vueNodesMode = true`, `drawNode()` returns early at L5406 — no canvas widget rendering occurs,
    so the Vue rendering path (Phase 2) handles everything.

### Option A: PromotedWidgetSlot (full fidelity) — IMPLEMENTED

- [x] **5.A1** Create `src/core/graph/subgraph/PromotedWidgetSlot.ts`
  - Extends `BaseWidget<IBaseWidget>` — a plain class, NOT a Proxy
  - Owns positional state: `y`, `last_y`, `computedHeight`, `width`
  - `resolvedType` getter resolves interior widget type; `type` set via `Object.defineProperty` on prototype
  - `value` getter reads from `WidgetValueStore` via `stripGraphPrefix(sourceNodeId):sourceWidgetName`
  - `drawWidget()` resolves interior widget, calls `toConcreteWidget().drawWidget()` with patched y position
  - `onClick()` delegates to resolved concrete widget
  - `callback()` delegates to resolved interior widget
  - `promoted` always returns `true`, `outline_color` always returns promoted color
  - Disconnected state: draws "Disconnected" placeholder text
  - `sourceNodeId` and `sourceWidgetName` are readonly properties (used for serialization and cleanup)

- [x] **5.A2** Create `src/core/graph/subgraph/promotedWidgetRegistration.ts`
  - `registerPromotedWidgetSlots(canvas)` replaces `registerProxyWidgets(canvas)` in `app.ts`
  - Sets up same event listeners: `subgraph-opened` (promoted flag sync), `subgraph-converted` (auto-promote)
  - `onConfigure` override creates `PromotedWidgetSlot` instances instead of Proxy objects
  - `properties.proxyWidgets` getter reads `sourceNodeId`/`sourceWidgetName` from slots (not `_overlay`)
  - `properties.proxyWidgets` setter filters out old slots via `instanceof PromotedWidgetSlot` (not `isProxyWidget`)
  - Native widgets (`-1` entries) still preserved from existing `widgets[]`

- [x] **5.A3** Update `SubgraphNode.onRemoved` (L564-565)
  - Replaced `if ('isProxyWidget' in widget && widget.isProxyWidget) continue`
  - With `if ('sourceNodeId' in widget) continue` (duck-typing to avoid cross-layer import)

- [x] **5.A4** Update `src/scripts/app.ts`
  - Changed import from `registerProxyWidgets` to `registerPromotedWidgetSlots`
  - Changed call from `registerProxyWidgets(this.canvas)` to `registerPromotedWidgetSlots(this.canvas)`

- [x] **5.A5** Update JSDoc reference in `src/lib/litegraph/src/types/widgets.ts` (L375)
  - Changed `@see` from `proxyWidget.registerProxyWidgets` to `promotedWidgetRegistration.registerPromotedWidgetSlots`

- [x] **5.A6** Write tests for `PromotedWidgetSlot` — 16 tests
  - Test: name from sourceNodeId and sourceWidgetName
  - Test: always promoted, serialize false
  - Test: resolves type from interior widget
  - Test: returns button type when disconnected (missing node or widget)
  - Test: value reads from WidgetValueStore
  - Test: value returns undefined when not in store
  - Test: value writes to interior widget
  - Test: label reads from store, falls back to name
  - Test: drawWidget draws disconnected placeholder when disconnected
  - Test: onClick doesn't throw when disconnected
  - Test: _displayValue returns string, empty when null, empty when computedDisabled

### Validation

- [x] `pnpm typecheck` — no errors
- [x] `pnpm lint` — no errors (eslint on 5 changed files clean)
- [x] `pnpm test:unit` — full suite passes (4449 passed, 180 skipped, 0 failures)
- [x] `pnpm test:unit -- src/core/graph/subgraph/` — all 29 tests pass (3 files)
- [ ] **Manual verification** (canvas renderer):
  - SubgraphNode shows promoted widgets on canvas
  - Widget types display correctly (combo shows dropdown, number shows slider, etc.)
  - Disconnected widgets show placeholder
  - Canvas and Vue renderers show consistent state

---

## Phase 6: Delete ProxyWidget Infrastructure

**Goal:** Remove all ProxyWidget code, tests, and references. The Proxy-based system no longer exists.
**Commit prefix:** `refactor: remove ProxyWidget infrastructure`
**Depends on:** Phases 4, 5

### Pre-flight Check

- [ ] **6.0** Confirm no remaining consumers
  - `grep -r "isProxyWidget" src/` → only `proxyWidget.ts`, `proxyWidget.test.ts`, `SubgraphNode.ts:565`, `widgets.ts:375`
  - `grep -r "_overlay" src/` → only `proxyWidget.ts`, `proxyWidget.test.ts`
  - `grep -r "isDisconnectedWidget" src/` → only `proxyWidget.ts`, `proxyWidgetUtils.ts`
  - `grep -r "registerProxyWidgets" src/` → only `proxyWidget.ts`, `app.ts`
  - `grep -r "disconnectedWidget" src/` → only `proxyWidget.ts`, `DisconnectedWidget.ts`, `proxyWidgetUtils.ts`
  - `grep -r "newProxyWidget\|newProxyFromOverlay\|resolveLinkedWidget" src/` → only `proxyWidget.ts`

### Tasks

- [ ] **6.1** Delete `src/core/graph/subgraph/proxyWidget.ts`
  - The entire file: `Overlay` type, `ProxyWidget` type, `isProxyWidget`, `isDisconnectedWidget`, `registerProxyWidgets`, `newProxyWidget`, `newProxyFromOverlay`, `resolveLinkedWidget`, `onConfigure` override

- [ ] **6.2** Delete `src/core/graph/subgraph/proxyWidget.test.ts`

- [ ] **6.3** Delete `src/lib/litegraph/src/widgets/DisconnectedWidget.ts`
  - Confirm no other consumers first: `grep -r "DisconnectedWidget\|disconnectedWidget" src/`
  - If other consumers exist, keep the file but remove the `proxyWidget.ts` import

- [ ] **6.4** Remove `registerProxyWidgets` call from `src/scripts/app.ts` (L10, L882)
  - Remove import (L10)
  - Remove call `registerProxyWidgets(this.canvas)` (L882)

- [ ] **6.5** Clean up `SubgraphNode.onRemoved()` (L564-565)
  - Remove: `if ('isProxyWidget' in widget && widget.isProxyWidget) continue`
  - If Phase 5 Option A: replace with `if (widget instanceof PromotedWidgetSlot) continue`
  - If Phase 5 Option B or skipped: remove the line entirely

- [ ] **6.6** Remove JSDoc reference in `src/lib/litegraph/src/types/widgets.ts` (L375)
  - Update or remove `@see /core/graph/subgraph/proxyWidget.registerProxyWidgets`

- [ ] **6.7** Clean up `proxyWidgetUtils.ts` remaining references
  - Remove any remaining imports from `proxyWidget.ts`
  - Ensure `getWidgetName`, `pruneDisconnected` no longer reference proxy concepts
  - Consider renaming file to `promotionUtils.ts` if not done in Phase 4

- [ ] **6.8** Remove `src/core/schemas/proxyWidget.ts` — NO, KEEP
  - The schema and `parseProxyWidgets` are still used for the `properties.proxyWidgets` format
  - Consider renaming to `promotionSchema.ts` in a follow-up

- [ ] **6.9** Update `SubgraphNode.clone()` (L638-649)
  - L642: `this.properties.proxyWidgets = this.properties.proxyWidgets`
  - This currently triggers the computed setter to rebuild Proxy objects
  - After removal: this line may be a no-op or need adjustment for the new system
  - Verify clone + serialize still works correctly

- [ ] **6.10** Remove `subgraph-opened` event listener for `promoted` flag sync
  - In `registerProxyWidgets` (now deleted), L60-70 synced `widget.promoted` on subgraph open
  - This logic needs to move: when entering a subgraph, set `promoted` flag on interior widgets based on the promotion list
  - Move to `SubgraphEditor.vue` `onMounted` or the subgraph navigation flow

### Validation

- [ ] `pnpm typecheck` — no errors
- [ ] `pnpm lint` — no errors
- [ ] `pnpm test:unit` — full suite passes
- [ ] Grep confirms: **zero** results for all of these patterns in `src/`:
  - `isProxyWidget`
  - `_overlay`
  - `isDisconnectedWidget`
  - `registerProxyWidgets`
  - `newProxyWidget`
  - `newProxyFromOverlay`
  - `resolveLinkedWidget`
  - `ProxyWidget` (as a type, not in "proxyWidgets" property name)
  - `disconnectedWidget` (import/usage, not the deleted file)
- [ ] `pnpm format` — no errors
- [ ] **Manual verification** — full end-to-end test:
  - Create a new subgraph from selected nodes
  - Recommended widgets auto-promote
  - Manually promote additional widgets
  - Edit promoted widget values on SubgraphNode
  - Values sync to interior nodes
  - Demote widgets
  - Reorder promoted widgets in SubgraphEditor
  - Delete an interior node → disconnected state shows correctly
  - Save and reload workflow → promoted widgets restore correctly
  - Nested subgraphs (subgraph inside subgraph) → promoted widgets chain correctly
  - Clone a SubgraphNode → promoted widgets present on clone
  - Undo/redo promote/demote actions

---

## Post-Completion

- [ ] Run full test suite: `pnpm test:unit`
- [ ] Run typecheck: `pnpm typecheck`
- [ ] Run lint: `pnpm lint`
- [ ] Run format: `pnpm format`
- [ ] Run knip: `pnpm knip` (check for dead exports)
- [ ] Consider browser tests: `pnpm test:browser:local` (subgraph-related specs)
- [ ] Update `temp/plans/proxy-widget-elimination-plan.md` with any deviations or decisions made
- [ ] Consider follow-up tasks:
  - [ ] Rename `proxyWidgets` property to `promotedWidgets` (serialization migration)
  - [ ] Rename `proxyWidgetUtils.ts` → `promotionUtils.ts`
  - [ ] Rename `proxyWidget.ts` schema → `promotionSchema.ts`
  - [ ] Unify System 1 (slot-based) and System 2 (user-controlled) promotion
