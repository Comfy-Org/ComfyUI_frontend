# ADR-CRDT-LAYOUT-0046: The Layout Store Owns Its Y.Doc for the Page Lifetime

Date: 2026-10-22

## Status

Proposed

## Context

`layoutStore` is a module singleton. Importing
`src/renderer/core/layout/store/layoutStore.ts` constructs it, and the
constructor creates the layout `Y.Doc`, takes its `nodes`, `groups`, and
`reroutes` maps, and registers the store's own deep observers and
`afterTransaction` handler on them. The module-load side-effects survey
(FE-3560) flagged this as work that happens at import with no named owner for
the document's lifecycle.

[ADR-CRDT-LAYOUT-0003](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md)
governs what the document holds. It does not say who creates, resets, or
disposes it, how a sync layer reaches it, or what importing the store may do.
Three facts on main shape the answer:

- The document is private and never leaves the store. The 2026-07-30
  amendment to 0003 removed `applyUpdate` and `getStateAsUpdate` as
  callerless; nothing encodes, transmits, or merges the layout document.
- The agent follower does not share it.
  [ADR-CRDT-FOLLOWER-0025](CRDT-FOLLOWER-0025-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md)
  keeps the semantic document in the follower's own `FollowerDoc`, replaced on
  every lineage break. Remote edits reach layout only as `LayoutOperation`s
  issued inside `layoutStore.withActor(actor, ...)` while the applier drives
  the graph API.
- One document already holds every root graph. Entity keys are
  `makeScopedLayoutKey(rootGraphId, id)`; a root graph leaves through
  `clearGraph` and a subgraph through `detachGraphLayouts`. Nothing about a
  workflow switch requires a different document, and per-workflow live graphs
  (the direction of ADR-GRAPH-DOCUMENT-0045, proposed in an open PR) need
  several root graphs resident at once.

## Decision

1. **The `layoutStore` module owns the `Y.Doc`, for the lifetime of the
   page.** It is created once, when the module is evaluated, and is never
   replaced or destroyed in production. The reference stays private to
   `LayoutStoreImpl`; no getter, export, or callback hands it out.

2. **Reset is per graph, never per document.** Closing or reloading a
   workflow drops its entries with `clearGraph(rootGraphId)`; removing a
   subgraph drops its entries through `detachGraphLayouts`; leaving a view
   drops view-local measurement with `clearViewGeometry`. A workflow switch
   with the graph kept alive touches the document not at all.
   `resetForTests` is the only whole-document reset and stays test-only.

3. **Sync layers attach through commands, not through the document.** A
   sync layer writes layout by applying `LayoutOperation`s, stamped with its
   actor via `withActor`, and reads it through the store's query methods and
   `onChange` / `onGeometryChange` / `onNodeChange`. If document transmission
   is reinstated, it returns as store methods that apply or encode updates
   against the private document with an explicit remote origin, so the
   store's observers still see every change. A second consumer holding the
   `Y.Doc` itself is not an attachment mode this store supports.

4. **Importing `layoutStore` is inert.** Evaluating the module may allocate
   in-memory state and wire observers on objects the store itself creates.
   It must not schedule timers or animation frames, add `window` or
   `document` listeners, issue network requests, or look up a Pinia store or
   any other state that needs an application context. The constructor can
   run before `app.use(pinia)` when the module is imported early, and many
   importers (`LGraph`, layout operations, the agent panel) run outside a
   component. Work that needs the environment belongs in the caller that
   needs it, after setup, not in the constructor.

A cold-import unit test pins clause 4: it re-evaluates the module
with no active Pinia and fake timers and asserts that the store is empty, that no timer,
listener, or fetch is left behind, and that no Pinia was activated; a store
lookup throws without an active Pinia, so the import would fail.

## Alternatives considered

- **Construct the store lazily, behind a getter or proxy.** Rejected. The
  allocation is a few empty maps, so laziness saves nothing measurable, while
  a proxy adds indirection to per-frame reads such as `readNodeRect` and
  changes the identity that every importer and test suite holds. It also only moves the side effects to first use instead of forbidding
  them.
- **A Pinia or app-scoped owner with explicit `dispose`.** Rejected.
  `LGraph` and the layout operations call the store with no component or
  injection context, so every one of them would need the owner passed in,
  which changes the public API for no behavioral gain. A page-lifetime value
  has no disposal point to model.
- **One document per workflow or root graph, swapped on switch.** Rejected.
  Observers are bound to the maps of one document, so swapping means
  re-wiring them and re-subscribing every listener; scoped keys already
  isolate graphs inside one document; and per-workflow live graphs need
  several roots resident together, which a swapped document cannot hold.
- **Share or merge the agent follower's document into the layout document.**
  Rejected by 0025: semantic and layout state are separate lineages, and the
  follower replaces its document on every lineage break, which would wipe
  local layout for every graph.
- **Drop Yjs from the store and keep plain maps.** Out of scope. 0003 keeps the
  document as the conflict-resolution layer for replicated layout; that
  decision belongs to 0003, not to an ownership ADR.

## Consequences

### Positive

- One owner and one lifetime to reason about: graph lifecycles reset layout,
  the document's never does.
- The import contract is enforced by a test rather than by convention, so
  early importers stay safe to load before the app is configured.
- Sync code stays behind the store's command and observer surface, which keeps
  provenance (`withActor`) and change notification on every remote write.

### Negative

- The document lives as long as the tab. With the default `gc: true`, deleted
  items collapse to compact tombstone ranges, but the struct store still grows
  with edit history. If a long session measures this as significant, the fix
  is a whole-document rebuild inside the store, not a lifecycle exposed to
  callers.
- Any future need for environment-dependent initialization (device pixel
  ratio listeners, settings-driven defaults) must be wired by a caller after
  setup, which is more ceremony than writing it in the constructor.
