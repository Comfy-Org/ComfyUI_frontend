# ECS mutation audit

Status: Current implementation audit
Verified: 2026-08-20 against `13a302eadda871b939b148ecb87e3d845ceefff2`

This audit classifies current graph-domain writes and compares them with
[ADR-LAYOUT](../../adr/LAYOUT-crdt-layout-intent-and-local-measurement.md)
and [ADR-ECS](../../adr/ECS-entity-component-system.md). The related
[decision traceability matrix](ecs-decision-traceability.md) maps each claim to
the wider design set.

## Classification

| Class                          | Current examples                                                                                                                                                         | Guarantees                                                                                                             | Main gap                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Serializable layout operations | `layoutStore.applyOperation`, `applyOperations`; producers in `graphLayoutAttachment` and `layoutMutations`                                                              | Typed operation union, actor/source metadata, Yjs transaction, create/delete no-op guards, batch transaction           | Operations have wall-clock timestamps; no durable operation log, inverse command, or workflow-wide transaction                     |
| Validated store actions        | `linkStore.registerLink`, `replaceLink`, `updateEndpoints`, `deleteLink`; identity-checked register/delete in node and reroute stores; widget registration/order actions | Ownership checks; link endpoint batches validate before commit; duplicate identities and occupied input targets reject | Actions are not serializable commands and most do not support replay, inverse generation, or multi-store commit                    |
| Direct reactive-proxy writes   | `LGraphNode` shell accessors, `BaseWidget.value`, `LLink.type` and `parentId`, `Reroute.parentId` and `floating`, slot objects and arrays                                | One reactive object is shared by class and store, so no mirror drifts; reroute setter blocks simple cycles             | No command envelope, validation is field-specific, writes are not idempotent records, and nested mutation can bypass actions       |
| Legacy orchestration           | `LGraph.add/remove/clear/configure`, connect/disconnect, reroute splice/removal, subgraph promotion, `replaceWithMapping`                                                | Preserves extension callbacks, serialization, graph indexes, and compatibility order                                   | Imperative, reentrant, exception-sensitive sequences span stores and class containers without atomicity or rollback                |
| Derived read-only data         | Reroute membership, link owner views and slot indexes, badge projections, layout spatial indexes, renderer link/slot geometry                                            | Recomputed from an authority; no second persisted copy                                                                 | Some projections update after individual writes and can expose intermediate state; compatibility views still expose mutable shells |

The first row is the only current implementation that matches ADR-LAYOUT's
command shape in a meaningful sense. The other rows may be centralized or
reactive, but that is not command-driven mutation.

## Mutation inventory by concern

| Concern                        | Authoritative writes                                                                                                          | Classification                             | Notes                                                                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Node identity and ownership    | `nodeDataStore.registerNode`, `deleteNode`, `clearOwner`, `clearGraph`                                                        | Validated store actions                    | Registration and deletion compare raw object identity. Root-wide ID collision makes `LGraph.add` remint and retry.                           |
| Node shell                     | `LGraphNode` accessors over `_state`; configure assigns fields and mutates flags, slots, and properties                       | Direct proxy plus legacy orchestration     | Registered ID is protected, but title, mode, visual state, slot arrays, and nested flags have no serializable operation.                     |
| Link identity and endpoints    | `linkStore.replaceLink`, `updateEndpoint(s)`, `deleteLink`                                                                    | Validated store actions                    | `updateEndpoints` validates all participants, vacates old indexes, patches, then reindexes as one synchronous action.                        |
| Link type and reroute terminus | `LLink.type`, `LLink.parentId`                                                                                                | Direct proxy writes                        | `parentId` mutation invalidates derived reroute membership through Vue tracking, but does not validate owner or chain existence.             |
| Reroute identity               | `rerouteStore.registerReroute`, `deleteReroute`, clear actions                                                                | Validated store actions                    | Raw identity and owner checks protect registration and deletion.                                                                             |
| Reroute chain                  | `Reroute.parentId`, `floating`; `LGraph.createReroute/removeReroute` rewiring loops                                           | Direct proxy plus legacy orchestration     | Setter prevents a local parent cycle. Multi-entity splice/remove is a sequence, not a transaction.                                           |
| Widget state                   | `widgetValueStore.registerWidget`, `setValue`, order and delete actions; `BaseWidget.value`                                   | Store actions plus direct proxy writes     | Registration can reuse existing state by type. Values and render state are freely mutable and have no owner transaction with node lifecycle. |
| Widget value shadows           | `node.widgets_values` / `widgets_values_named` delayed restoration and direct consumer writes                                 | Direct class writes                        | Serialized arrays/maps can diverge from store values and live widgets.                                                                       |
| ID allocation state            | `mint*`, `observe*`, compatibility setters, configure, clipboard/import counter writes                                        | Direct class writes                        | Ambient mutable counters affect future durable IDs and are not deterministic replay commands.                                                |
| Entity geometry                | `LayoutOperation` handlers for node, reroute, and group create/move/resize/delete/clear                                       | Serializable layout operations             | `applyOperations` makes one Yjs transaction. Root-scoped keys and operation handlers make repeated create/delete no-ops.                     |
| Link/slot geometry             | renderer tracking and `layoutStore` view maps                                                                                 | Derived or transient direct state          | Cleared by `clearViewGeometry`; not serialized or part of entity history.                                                                    |
| Graph membership and callbacks | arrays/maps in `LGraph`, `node.graph`, subgraph registry, execution order                                                     | Legacy orchestration                       | Store registration is interleaved with legacy publication and callbacks.                                                                     |
| Graph metadata                 | `LGraph.config`, `extra`, and `revision` direct assignments and serialization                                                 | Direct class writes                        | Durable graph metadata has no store owner, validation schema, command form, or transaction/undo contract.                                    |
| Graph invalidation revision    | `LGraph.incrementVersion()` calls from graph, node, canvas, widget, slot, and subgraph paths                                  | Scattered imperative invalidation          | `_version` can expose intermediate or duplicate increments and is not emitted from a committed mutation boundary.                            |
| Properties and extension state | `node.properties`, callback-owned fields, node-specific widgets                                                               | Direct class writes                        | Open-ended extension data has no schema, validation, command form, or deterministic reducer.                                                 |
| Extension persistence hooks    | node/graph `onSerialize` mutate complete DTOs; generic configure assignment and `onConfigure` mutate live objects             | Extension-controlled orchestration         | Hooks bypass canonical ownership, schemas, validation, replay, transactions, and defined undo behavior.                                      |
| Prompt serialization hooks     | `graphToPrompt` awaits widget `serializeValue`; hooks may mutate shadows/UI, randomize values, capture media, or upload files | Extension-controlled effects               | Prompt assembly is not a pure store read; effects and durable mutations have no command, idempotency, replay, transaction, or undo contract. |
| Unknown-node fallback          | `node.last_serialization` assigned and patched by load/import paths                                                           | Direct class writes                        | Full opaque node wire state can override store-backed serialization without scoped ownership or a command boundary.                          |
| Execution order                | `computeExecutionOrder` assigns `node.order`; configure restores and serialization emits it                                   | Derived projection plus direct class state | Derived scheduling data can become an independent persisted mutation channel.                                                                |
| Badges and reroute membership  | `badgeSystem` computed projections; `rerouteStore.buildMembershipIndex`                                                       | Derived read-only data                     | Correctly omitted from serialization, command, and undo state as independent entities.                                                       |

## ADR-LAYOUT properties

| Property      | Layout operations                                                                                                   | Store actions and proxy writes                                                                                           | Legacy graph operation                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Serializable  | Yes, for the `LayoutOperation` union                                                                                | No common envelope; reactive objects may contain class instances                                                         | No; method calls and callbacks carry live references                                                        |
| Deterministic | Reducers mostly are; actor stamping is stable per session, but timestamps and z-index allocation are producer state | Link validation is deterministic for a fixed store snapshot. General proxy setters and extension callbacks are not       | No. Callback order is defined, but callback behavior, ID allocation, and current graph state affect results |
| Idempotent    | Create/delete/clear guard existing state. Move/resize/set are assignment-idempotent for equal payloads              | Some register/delete actions are idempotent by identity. Array edits, increments, callback effects, and rewiring are not | No general request ID, precondition, or applied-command ledger                                              |
| Replayable    | Operation values can be reapplied, but the removed operation log means the system does not retain a replay stream   | No                                                                                                                       | Workflow JSON can be reconfigured, which is state restoration rather than mutation replay                   |
| Undoable      | Not by inverse operations. Current workflow undo restores snapshots                                                 | Not by action inverses                                                                                                   | `beforeChange`/`afterChange` feed snapshot history; callbacks rerun during restoration paths                |
| Transmittable | Yjs state updates can represent layout state, though public sync seams and operation history are absent             | No command transport                                                                                                     | No                                                                                                          |

The layout store is command-shaped, not a complete command bus. Its Yjs
document is a mergeable state record. `LayoutOperation.timestamp` is metadata,
not an ordering proof, and `allocateZIndex` depends on local store history.

## Transaction boundaries and visibility

### Boundaries that exist

- `layoutStore.applyOperation` wraps one operation in `Y.Doc.transact`.
- `layoutStore.applyOperations` wraps a list in one Yjs transaction, then queues
  one change record per applied operation.
- `linkStore.updateEndpoints` validates the complete endpoint set before any
  mutation. Within one synchronous action it removes all placements, patches
  all topologies, rebuilds indexes, and bumps revision once.
- Root and owner clear actions mutate one Pinia store synchronously.
- `LGraph.clear` uses `finally` so structural teardown completes after a node
  lifecycle callback throws.

### Boundaries that do not exist

There is no transaction spanning Pinia stores, Yjs, `LGraph` containers,
entity back-references, callbacks, and snapshot history. Vue batching may delay
rendering, but it does not make those writes atomic. Examples:

- Node add registers node state, widgets, legacy indexes, callbacks, and layout
  in separate steps. A callback can observe or alter the in-progress state.
- Link connect commits topology before disconnect callbacks for the displaced
  link. Tests pin that useful ordering, but nested callbacks can replace the
  replacement and force the outer connect to abort.
- Reroute creation registers chain and layout separately, then rewires every
  affected link and reroute through direct proxy assignments.
- Node removal disconnects many links, releases subgraphs, runs callbacks,
  unregisters stores, deletes layout, and removes indexes without rollback.
- Root clear invokes six store clears and legacy reset in sequence. No reader
  receives one workflow-level commit event covering all of them.
- Replacement transfers layout ownership and node-state ownership before
  swapping legacy indexes and rebuilding widgets and connections.

Cross-store consistency depends on orchestration order and tests, not an atomic
commit protocol.

## Replay and undo today

Workflow undo remains snapshot-based through the change tracker. Legacy
`beforeChange` and `afterChange` delimit user-visible edits, serialization
captures the graph, and undo configures a prior snapshot. Layout commands do
not independently drive undo, and Pinia store actions do not emit inverses.

Command replay cannot reconstruct the whole workflow because only layout has
command values. Replaying a snapshot can also invoke configure and lifecycle
callbacks whose external effects are absent from the snapshot. Equal
serialized state does not imply equal callback history.

## Later command-driven architecture

The current phase is about data centralization, not implementing this model.
None of the items below is a completion criterion for PR 14246. If the system
later adopts command-driven mutation, that work would need to address:

1. Define serializable command schemas for graph metadata, node, link, reroute,
   widget, slot, group, subgraph-definition, property, and promotion mutations.
   Commands must carry stable IDs, graph scope, payload, source, and explicit
   preconditions.
2. Route class setters, store actions, connect/disconnect, configure-time edits,
   replacement, dynamic widgets, and subgraph promotion through command
   dispatch. Reactive proxies may remain read models, but must not be public
   mutation channels.
3. Implement deterministic reducers. Remove wall-clock and local allocation
   decisions from reducers; resolve IDs and z-order in command creation or with
   deterministic allocation rules recorded in the command.
4. Specify idempotency for each command. Use assignment semantics plus
   expected-version or expected-owner checks, and define duplicate-delivery
   behavior. Multi-entity rewires need one batch command.
5. Add a workflow transaction coordinator that commits all affected stores,
   layout state, legacy compatibility indexes, and derived invalidation as one
   observable unit, or rolls them back. Pinia action boundaries are not enough.
6. Replace snapshot-only undo with command inverses or a documented hybrid that
   records command batches and restores every authoritative concern. Define
   whether extension callback effects are compensatable or excluded.
7. Provide a retained, ordered command stream or equivalent transport contract
   for replay and CRDT transmission. Yjs layout state alone cannot replay graph
   topology and widget mutations.
8. Move lifecycle callbacks outside reducer critical sections. Emit committed
   events with plain data after success; prevent callbacks from mutating the
   same transaction through legacy object references.
9. Close the extension boundary. Deprecate direct mutation of node properties,
   slots, widgets, links, and graph maps, publish command APIs, and provide
   migration behavior for existing custom nodes. Preserve `onSerialize` and
   `onConfigure` compatibility only through a controlled adapter with validated,
   namespaced plain-data payloads; hooks must not rewrite canonical store-backed
   fields, and payload changes need explicit replay and undo semantics.
10. Split `widget.serializeValue` into pure execution-value resolution and
    declared pre-execution effects. Record resolved inputs in an execution
    snapshot; route graph changes through commands and give uploads/capture
    explicit retry and idempotency semantics.
11. Prove the model with tests for duplicate delivery, deterministic replay,
    inverse or snapshot parity, failed-batch rollback, nested subgraph scope,
    and cross-store observer visibility.

Graph invalidation revision should be derived from concern revisions or emitted
once after successful command-batch commit. It is compatibility notification,
not an independently mutable durable component.

Until then, dedicated reactive stores hold an increasing share of entity state.
Layout mutation is operation-driven, topology has validated actions, and graph
mutation as a whole remains legacy-orchestrated and snapshot-undone.

## Implementation and test references

- `src/renderer/core/layout/store/layoutStore.ts`: `applyOperation`,
  `applyOperations`, `applyOperationInTransaction`, operation handlers,
  `clearGraph`, `clearViewGeometry`
- `src/renderer/core/layout/operations/graphLayoutAttachment.ts`: layout
  operation producers and `detachGraphLayouts`
- `src/stores/linkStore.ts`: `replaceLink`, `validateEndpointUpdates`,
  `updateEndpoints`, ownership and index maintenance
- `src/stores/nodeDataStore.ts`, `rerouteStore.ts`, `widgetValueStore.ts`:
  registration, proxy adoption, clear, and direct mutable state
- `src/lib/litegraph/src/LGraph.ts`: graph orchestration, configure ordering,
  clear, connect/remove helpers, and reroute rewiring
- `src/lib/litegraph/src/LGraphNode.ts`, `LLink.ts`, `Reroute.ts`, and
  `widgets/BaseWidget.ts`: proxy-backed setters and compatibility shells
- `src/platform/nodeReplacement/useNodeReplacement.ts`: in-place replacement
- Tests: `layoutStore.test.ts`, `linkStore.test.ts`, `LLink.store.test.ts`,
  `Reroute.store.test.ts`, `LGraph.test.ts`, `LGraphNode.nodeState.test.ts`,
  and `widgetValueStore.test.ts`
