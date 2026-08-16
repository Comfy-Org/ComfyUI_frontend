# ECS migration verification audit (PR 14246)

Status: Current implementation audit
Verified: 2026-08-16 against PR 14246
Scope: Behavioral evidence added or materially changed by PR 14246

Evidence is grouped by invariant rather than implementation unit. A `Strong`
grade includes integration or browser evidence. `Good` covers meaningful
boundaries, while `Partial` indicates a material gap.

For the accuracy and status audit of the accompanying design records, see
[ecs-documentation-audit.md](ecs-documentation-audit.md).

## Evidence by invariant

### Store collisions: Strong

Invariant: IDs cannot overwrite an incumbent entity, owner scopes remain
isolated, and persisted collisions are normalized before registration.

Representative evidence:

- `src/stores/linkStore.test.ts`: contested targets, duplicate link IDs,
  sibling-owner rejection, and atomic endpoint replacement.
- `src/stores/nodeDataStore.test.ts`: duplicate node identity and graph
  isolation.
- `src/stores/rerouteStore.test.ts`: duplicate reroutes and owner isolation.
- `src/lib/litegraph/src/LGraph.test.ts`: persisted node, link, reroute, and
  floating-link collision normalization.
- `browser_tests/tests/vueNodes/nodeStates/registration.spec.ts`: duplicate node
  IDs remain visible in separate graph scopes.

### Lifecycle teardown: Strong

Invariant: add/remove/clear transfers or releases store ownership exactly once,
including reentrant and failing callbacks, without clearing sibling scopes.

Representative evidence:

- `src/lib/litegraph/src/LGraph.test.ts`: callback ordering, recursive removal,
  entities added during clear, callback failure, idempotent root clear, and
  owner-local subgraph clear.
- `src/lib/litegraph/src/LLink.store.test.ts`: root, subgraph, unconfigured, and
  floating-link teardown; shared subgraph definitions remain registered.
- `src/lib/litegraph/src/Reroute.store.test.ts` and
  `src/lib/litegraph/src/LGraphGroup.test.ts`: registration and clear behavior.
- `src/renderer/extensions/vueNodes/layout/useNodeLayout.test.ts`: workflow
  replacement releases the originally retained graph.

### Subgraph identity: Strong

Invariant: one root allocates a unique runtime identity space while graph
ownership partitions queries; shared definitions retain ownership until their
last instance is gone.

Representative evidence:

- `src/lib/litegraph/src/idAllocation.test.ts` and
  `src/lib/litegraph/src/LGraph.test.ts`: shared counters and cross-definition
  deduplication.
- `src/lib/litegraph/src/subgraph/subgraphDeduplication.test.ts`: remaps every
  regular/floating link reference and handles cyclic definition order.
- `src/lib/litegraph/src/subgraph/SubgraphSerialization.test.ts`: duplicate node
  IDs and owner topology through reload.
- `browser_tests/tests/subgraph/subgraphLinkIdentity.spec.ts`: link identity and
  reroute chains survive a real workflow load.

### Serialization: Strong

Invariant: store-backed runtime state emits the existing wire contract,
round-trips deterministically, and does not mutate caller-owned input while
normalizing aliases.

Representative evidence:

- `src/lib/litegraph/src/LGraph.test.ts`: byte-identical plain, rerouted,
  floating-link, and reroute records; input immutability.
- `src/lib/litegraph/src/LGraph.serialise.test.ts`: links register after a JSON
  round trip.
- `src/lib/litegraph/src/subgraph/SubgraphSerialization.test.ts`: interior
  topology ordering, ownership, and rejected aliases.
- `src/lib/litegraph/src/node/slotUtils.test.ts`: output links serialize in
  deterministic order and as `null` when empty.
- `browser_tests/tests/workflowPersistence.spec.ts` and
  `browser_tests/tests/subgraph/subgraphSerialization.spec.ts`: browser-level
  persistence checks.

### Layout renderer toggle: Good

Invariant: canonical node, slot, group, and reroute geometry remains coherent
across renderer changes and subgraph navigation.

Representative evidence:

- `browser_tests/tests/vueNodes/layout/rendererToggleGeometry.spec.ts`: slot and
  node geometry across Vue-to-legacy round trips and repeated toggles.
- `browser_tests/tests/vueNodes/layout/subgraphLayoutSync.spec.ts`: layout sync in
  an owned subgraph.
- `browser_tests/tests/vueNodes/rerouteGeometry.spec.ts`: reroute geometry across
  navigation.
- `src/lib/litegraph/src/LGraphNode.test.ts`,
  `src/lib/litegraph/src/LGraphGroup.test.ts`, and
  `src/lib/litegraph/src/Reroute.store.test.ts`: legacy geometry views write
  through and refresh from the store.

### Widgets and promotions: Good

Invariant: widget value identity is graph/host scoped, `null` is data rather
than absence, promotions preserve the interior/host mapping, and connectivity
reactively changes controls.

Representative evidence:

- `src/stores/widgetValueStore.graphReactivity.test.ts`: graph isolation,
  nested promotions, duplicate names, and input-link reactivity.
- `src/lib/litegraph/src/subgraph/SubgraphWidgetPromotion.test.ts`: `null`
  through promotion, reorder, serialization, and reload.
- `src/core/graph/subgraph/migration/proxyWidgetMigration.test.ts` and
  `src/core/graph/subgraph/promotionUtils.test.ts`: migration and reorder
  preservation.
- `src/components/rightSidePanel/parameters/WidgetActions.test.ts` and
  `WidgetItem.test.ts`: user actions and linked-input state.
- `browser_tests/tests/appModeBuilder.spec.ts` and
  `browser_tests/tests/vueNodes/widgets/widgetReactivity.spec.ts`: builder and
  renderer integration.

### Replacement: Good

Invariant: replacing a same-ID node transfers registered shell/layout state and
live connectivity without allowing stale ownership to delete the replacement.

Representative evidence:

- `src/stores/nodeDataStore.test.ts`: same-ID state and geometry transfer;
  mismatched identity does not transfer.
- `src/lib/litegraph/src/LLink.store.test.ts`: replacement commits before
  callbacks and tolerates callback displacement.
- `src/lib/litegraph/src/node/slotLinks.test.ts`: atomic connected-input layout
  replacement and stale-snapshot rejection.
- `browser_tests/tests/nodeReplacement.spec.ts`: replacement behavior through
  the UI.

### Clipboard and insertion: Good

Invariant: copy/paste and insertion mint identities, retain geometry and
topology, and cannot hijack registrations owned by live entities.

Representative evidence:

- `src/lib/litegraph/src/LGraphCanvas.clipboard.test.ts`: stale reroute pruning,
  live subgraph ownership, and reroute collision remapping.
- `src/core/graph/widgets/dynamicWidgets.test.ts`: group growth/shrink preserves
  unrelated links and disconnects removed links.
- `src/lib/litegraph/src/LGraph.inputSlotRealign.test.ts`: rejected aliases and
  slot movement realign registered topology.
- `browser_tests/tests/copyPaste.spec.ts`: pinned-node paste lands at the cursor.
- `browser_tests/tests/vueNodes/interactions/links/linkInteraction.spec.ts`:
  floating-reroute interaction.

### Badges: Good

Invariant: badges are derived, reactive presentation data; pricing and source
rows update without a second authoritative store.

Representative evidence:

- `src/systems/badgeSystem.test.ts`: derivation, filtering, reactivity, and
  identity-stable memoization.
- `src/systems/badgeSystem.pricing.test.ts`: relevant connectivity and graph-key
  changes recompute pricing.
- `src/systems/badgeSystem.subgraph.test.ts`: wrapper aggregation and promoted
  overrides.
- `src/renderer/extensions/vueNodes/composables/usePartitionedBadges.test.ts`
  and `src/lib/litegraph/src/nodeBadgeDraw.test.ts`: Vue and legacy projections.

### Performance: Partial

Invariant: central stores and compatibility views do not introduce observable
hot-path regressions or reactive invalidation churn.

Representative evidence:

- `browser_tests/tests/performance.spec.ts`: large-graph legacy node drag.
- `src/lib/litegraph/src/LGraphNode.test.ts`: per-frame slot access does not
  invalidate subscribers.
- `src/renderer/extensions/vueNodes/layout/useNodeDrag.test.ts`: one mutation
  batch per animation frame.
- `src/renderer/extensions/vueNodes/composables/useVueNodeResizeTracking.test.ts`:
  unchanged measurements avoid writes.

### Extension behavior: Good

Invariant: supported extension callbacks retain ordering and state visibility;
deprecated slot mirrors warn, remain derived, and cannot mutate authority.

Representative evidence:

- `src/lib/litegraph/src/node/NodeInputSlot.test.ts` and
  `NodeOutputSlot.test.ts`: deprecation reads/writes and store-derived values.
- `src/lib/litegraph/src/node/slotEcosystemPatterns.test.ts`: duck-typed slots,
  unknown keys, legacy `extra_info`, and collapsed rendering.
- `src/lib/litegraph/src/LGraphNode.test.ts` and
  `src/lib/litegraph/src/node/slotLinks.test.ts`: callback-time committed state.
- `src/lib/litegraph/src/LGraphCanvas.drawConnections.test.ts`: normal internal
  drawing and serialization do not emit deprecation warnings.
- `src/extensions/core/widgetInputs.test.ts`: stale extension-facing link state
  recovers through the graph/store boundary.

## Prioritized missing behavioral scenarios

1. P0, undo/redo across a mixed transaction. Replace or remove a node with
   links, reroutes, promoted widgets, and layout; undo and redo; assert every
   store, callback-visible state, renderer, and serialization agree. Current
   tests validate each concern but not transactional restoration across them.
2. P0, failed or interrupted workflow load. Force a configure callback to
   throw after some nested definitions register, then load another workflow.
   Assert no node/link/reroute/layout/widget ownership leaks from the failed
   graph.
3. P1, deep mixed collision fixture. Load at least three nested/shared
   definitions containing simultaneous node, link, reroute, group, and floating
   link collisions; save/reload and verify reference remapping and byte-stable
   second serialization.
4. P1, browser copy/paste of a connected subgraph. Paste a shared subgraph
   with promoted widgets and rerouted external links, then delete original and
   pasted instances in both orders. Verify ownership, values, and topology.
5. P1, renderer toggle plus navigation and history. Edit geometry in Vue,
   navigate into/out of a subgraph, toggle legacy, undo/redo, and verify node,
   slot, group, and reroute hit targets before saving.
6. P1, real extension compatibility corpus. Run representative extensions
   that enumerate/spread slots, mutate deprecated `link`/`links`, use duck-typed
   slots, and inspect callback state. Assert warnings and graceful behavior,
   not merely type compatibility.
7. P2, promotion lifecycle after replacement. Replace a host node or remove
   and recreate a shared definition while a nested promoted widget has a `null`
   value and an external link; verify locator identity and cleanup.
8. P2, quantified renderer parity. Measure p50/p95 drag, toggle, and link
   interaction frame time for representative 200- and 500-node workflows under
   both renderers, with a checked threshold and warm-up policy.
9. P2, badge end-to-end settings parity. Toggle badge and pricing settings
   in both renderers for root and subgraph nodes; verify updates after connect,
   disconnect, replacement, and definition registration.

## Assessment

PR 14246 has strong behavioral coverage for identity, lifecycle, and wire
compatibility. The remaining verification risks are cross-store undo/load
failure atomicity, realistic extension execution, and quantified performance;
these matter more than adding further implementation-level store tests.
