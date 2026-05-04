# 9. Vue-Node Viewport Culling Contract

Date: 2026-05-01

## Status

Proposed

## Context

The Vue-node renderer currently mounts every `<LGraphNode>` component for every node in the graph, regardless of whether the node is on screen. `GraphCanvas.vue` does:

```vue
<LGraphNode v-for="nodeData in allNodes" :key="nodeData.id" ... />
```

with `allNodes` derived from `vueNodeLifecycle.nodeManager.value.vueNodeData.values()` — i.e. every node, not just the visible set. As graphs grow, this becomes the dominant performance cost: every node carries widget DOM, slot DOM, watchers, and Pinia subscriptions.

In contrast, the canvas-mode renderer is properly viewport-culled:

- `LGraphCanvas.computeVisibleNodes` (`LGraphCanvas.ts:4954`) filters nodes by AABB intersection against `visible_area` every frame.
- `_renderAllLinkSegments` (`LGraphCanvas.ts:6214`) culls each link against `margin_area` (visible_area + 20px) before issuing draw work.
- Link hit-testing (`_getLinkCentreOnPos`, `LGraphCanvas.ts:5150`) iterates only `renderedPaths`, the set produced by the culled draw pass.

A spatial index already exists for this purpose:

- `QuadTree` (`src/renderer/core/spatial/QuadTree.ts`) and `SpatialIndexManager` (`src/renderer/core/spatial/SpatialIndex.ts`) are instantiated by `layoutStore`.
- `layoutStore.queryLinkAtPoint` (`layoutStore.ts:733`) and `querySlotAtPoint` (`layoutStore.ts:745`) already use the index for link/slot hit-testing.
- `layoutStore.getNodesInBounds` (`layoutStore.ts:338`), however, ignores the quadtree and iterates `ynodes` linearly with `boundsIntersect`. The index is partially used.

The drop-on-link feature added in this branch (see `useDropOnLink.ts`) reuses `queryLinkAtPoint`'s quadtree-backed hit-test on every pointermove during a node drag. That feature works correctly today, but it is _load-bearing on a partially-enforced invariant_: link hit-test is fast because the index is used; node hit-test would be slow because it isn't. As more interactions move from canvas-mode to Vue-mode, this asymmetry compounds.

There is currently no documented contract for what is and is not culled, no shared mounting strategy for Vue-node components, and no enforcement preventing new code from regressing what culling does exist.

## Decision

Establish a single culling contract for the Vue-node renderer, enforce it through the layout store, and migrate `GraphCanvas.vue` to honor it. The contract has three parts:

### 1. Spatial index is the single source of truth for "what is on screen"

Every node, link segment, slot, and reroute that exists in the graph is registered in `SpatialIndexManager` at the moment its layout is created or moves. Every consumer that asks "what is in this rectangle?" must call `SpatialIndexManager.query(bounds)` rather than iterating the canonical map.

`layoutStore.getNodesInBounds` is migrated to call `nodeSpatialIndex.query(bounds)`. The linear-scan fallback is removed. This is a semantic change, not just performance: `getNodesInBounds` becomes a quadtree query with the same correctness guarantees the existing link/slot queries already provide.

### 2. Vue-node mounting is bounded by viewport

`GraphCanvas.vue` no longer iterates `allNodes`. Instead it iterates a derived set that is the union of:

- Nodes whose AABB intersects the current viewport, expanded by an overscan margin (initial value: 25% of viewport size in each direction, tunable per camera scale).
- Nodes that are currently selected, being dragged, or otherwise pinned by an interaction.
- Nodes that are ancestors of any visible node in a subgraph chain (so subgraph navigation does not race with mounting).

The derived set is a `computed` that depends on viewport + spatial-index version. It is recomputed on pan/zoom, on graph mutation, and on selection change — never on every frame.

Mounting is gated by viewport, not visibility: nodes scrolled off-screen at the same zoom are unmounted; nodes zoomed away (so small that their DOM is irrelevant) remain mounted but are eligible for a future low-quality variant. This decouples "is this node renderable" from "is this node interactable."

### 3. Hot paths declare their cull discipline

Every interaction path that reads from the graph during a hot loop (pointermove during drag, hover, marquee select) must either:

a) Query through the spatial index, or  
b) Operate exclusively on a set that is already viewport-bounded (e.g. mounted Vue-node DOM, `renderedPaths`).

Hot paths that iterate the full node/link map are a regression. A lightweight ESLint rule (or a documented pattern check) flags new uses of `layoutStore.ynodes`, `graph._nodes.values()`, or `graph._links.values()` inside `pointermove`/`pointerdown` handlers and inside any function called from `requestAnimationFrame`.

The `graphInteractionHooks` event bus (`src/renderer/core/canvas/hooks/graphInteractionHooks.ts`) is the canonical attach point for features that need to react to drag hot paths. Listeners receive canvas-space positions and are expected to query the spatial index for any spatial lookup. Direct subscription to pointer events on individual node components is permitted only for events that do not require graph-wide spatial queries (e.g. node-local drag start, slot interaction).

## Consequences

### Positive

- **Bounded Vue render cost.** Mounting cost becomes O(visible nodes), not O(graph size). This is the highest-leverage perf fix in the renderer; large workflows (500+ nodes) currently mount ~500 components on load.
- **Uniform hit-testing semantics.** Every spatial lookup uses the same data structure with the same correctness guarantees. New features that need spatial queries do not need to invent their own indexing.
- **Drop-on-link and similar features become trivially scalable.** The current implementation already piggy-backs on the index for link queries; under this contract, the same applies to node queries.
- **Existing hot paths stay valid.** Canvas-mode rendering already follows this contract; this ADR documents and extends it to Vue-mode rather than introducing a new model.

### Negative

- **`getNodesInBounds` semantics change.** Consumers that relied on the linear scan returning _every_ matching node (including nodes with stale or zero bounds) may need to ensure layout is initialized before querying. This is a one-time migration, not an ongoing burden.
- **Mount thrash on rapid pan/zoom.** Aggressive viewport culling without overscan can churn DOM during a fling-pan. The 25% overscan and a small debounce on viewport-derived recomputation mitigate this; Storybook scenarios under pan stress are required as part of the migration.
- **Selection invariant.** A selected node scrolled off-screen must remain mounted (otherwise its selection box and toolbox disappear). The mounting set explicitly includes selected/dragging nodes for this reason; tests should cover this.
- **Subgraph traversal.** Subgraph IO nodes and the current subgraph's parent must remain mounted while the user is inside a subgraph. The "ancestors of visible nodes" rule covers this.

### Migration Path

1. Migrate `layoutStore.getNodesInBounds` to use `nodeSpatialIndex.query`. Smoke-test with existing marquee-selection and minimap tests.
2. Add a `visibleNodeIds` `computed` to `useVueNodeLifecycle` that queries the spatial index against the current camera viewport with overscan.
3. Switch `GraphCanvas.vue` `v-for` from `allNodes` to a derived `mountedNodes` that unions `visibleNodeIds` with selected/dragging/pinned IDs.
4. Add Storybook + Playwright scenarios for: large graph mount cost, rapid pan, selection persistence off-screen, subgraph entry/exit, drag-out-of-viewport.
5. Add ESLint check (or pre-commit hook) for the hot-path discipline rule in part 3.

Steps 1 and 2 are independently shippable. Step 3 is the user-visible perf change.

## Related

- ADR 0003 — Centralized Layout Management with CRDT (introduces `layoutStore` and the observer pattern that makes spatial-index integration possible).
- ADR 0008 — Entity Component System (the long-term direction; this ADR is consistent with treating spatial data as a queryable system rather than an entity-local property).
