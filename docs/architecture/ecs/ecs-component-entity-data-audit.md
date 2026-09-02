# ECS Component and Entity data audit

Status: Scoped migration implemented; structural follow-up remains
Verified: 2026-08-21 against `73c3c633f`
Scope: Implementation record for
[Centralize remaining Component and Entity data](ecs-migration-plan.md#2-centralize-remaining-component-and-entity-data)

This audit records the baseline, implementation, and remaining structural work
for every concern in that section. `Implemented` means the scoped authority move
landed with its compatibility boundary and tests. It does not mean all legacy
facades or broader ECS architecture work have been removed.

## Summary

All 19 scoped concerns are implemented. Compatibility facades remain where
extensions or legacy rendering require their object identity and mutation
behavior. Five larger structural slices remain and are listed separately below.

| Concern                             | Status      | Current boundary                                                                                       |
| ----------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| Graph and subgraph definitions      | Implemented | Root-scoped records own ordered membership, registries, and subgraph definition metadata.              |
| Remaining node visuals              | Implemented | `NodeState` owns `boxcolor` behind an enumerable compatibility accessor.                               |
| Outputs and transient previews      | Implemented | Store maps own reads; legacy output-map writes commit through stable nested mutation views.            |
| Node ordering                       | Implemented | One action updates canonical layout z-index and legacy node-array order.                               |
| Store-driven serialization          | Implemented | Graph, node, group, topology, reroute, and subgraph DTOs enumerate store authorities.                  |
| Legacy node geometry projection     | Implemented | The layout adapter owns stable mutable geometry views and write-through.                               |
| Link non-topological state          | Implemented | Separate persistent and runtime records follow topology lifecycle.                                     |
| Plain slot descriptors              | Implemented | Plain reactive descriptors back stable slot-class projections with native callback semantics.          |
| Node properties                     | Implemented | `NodeState` owns the stable mutable property dictionary behind compatibility behavior.                 |
| Group presentation                  | Implemented | Graph-definition records own presentation while layout owns geometry.                                  |
| Preview-exposure persistence        | Implemented | Owner-scoped locators key runtime lookup and serialization; raw IDs are hydration-only input.          |
| Extension persistence adapter       | Implemented | Validated namespaced payloads and isolated hook views preserve canonical fields.                       |
| Graph metadata                      | Implemented | A graph-keyed store owns revision, config, and extra behind compatibility accessors.                   |
| Graph invalidation                  | Implemented | Graph-scoped batching coalesces composite mutations behind `_version`.                                 |
| Unknown-node fallback               | Implemented | `NodeState` owns opaque fallback DTOs behind `last_serialization`.                                     |
| Execution order                     | Implemented | Graph-scoped derived records own execution order behind the node projection.                           |
| Entity ID allocation                | Implemented | Root-keyed allocation state and shared helpers own minting and observation.                            |
| Delayed widget restoration          | Implemented | Store-owned restoration state feeds registered and delayed widgets.                                    |
| Widget and preview-exposure cleanup | Implemented | Removal, replacement, and teardown clear node-owned records; failed configure cleanup remains limited. |

## Pre-migration baseline findings

The following sections preserve the verified baseline used to derive the 19
implementation commits. They describe the code before those commits, not the
current authority boundaries.

### Graph definitions, metadata, execution order, and identity

- `LGraph._nodes`, `_nodes_by_id`, `_groups`, `_subgraphs`, `config`, `extra`,
  `revision`, and `state` remain the live authorities. `Subgraph.inputs`,
  `outputs`, and `widgets` are ordered class-owned arrays.
- `LGraph.asSerialisable` enumerates those registries and calls class
  serializers. Subgraph serialization does the same for definition metadata and
  interfaces.
- `computeExecutionOrder` derives topology order and writes `node.order`; the
  same mutable field remains in `ISerialisedNode` and normal node serialization.
- Allocation helpers centralize mint/observe behavior over root-shared
  `LGraph.state`, but that state remains publicly replaceable and clipboard
  import still advances counters through the live graph.
- Unknown node load stores the complete source DTO in `NodeState` behind the
  `LGraphNode.last_serialization` compatibility accessor. Missing-node
  serialization returns that DTO over current store-backed fields except for
  selected compatibility overrides.

Representative implementation:

- `src/lib/litegraph/src/LGraph.ts`: graph fields, `add`, `removeNode`,
  `computeExecutionOrder`, `configure`, `asSerialisable`, and `Subgraph`.
- `src/lib/litegraph/src/idAllocation.ts`: root-shared mint and observe helpers.
- `src/lib/litegraph/src/subgraph/subgraphDeduplication.ts`: recursive import
  normalization.
- `src/lib/litegraph/src/LGraphNode.ts`: `order`, `last_serialization`, and
  `serialize`.
- `src/platform/nodeReplacement/useNodeReplacement.ts`: unknown-node discovery
  and replacement.

Representative evidence:

- `src/lib/litegraph/src/LGraph.test.ts`: shared counters, definition retention,
  and cross-definition identity.
- `src/lib/litegraph/src/subgraph/SubgraphSerialization.test.ts`: interface,
  membership, topology, and collision round trips.
- `src/lib/litegraph/src/idAllocation.test.ts`: mint and observe behavior.
- `src/platform/nodeReplacement/useNodeReplacement.test.ts`: unknown-node
  replacement and compatibility values.

### Node, group, slot, link, and layout projections

- `NodeState` owns tracked shell fields including foreground/background color,
  shape, flags, and mode. `boxcolor` remains a plain `LGraphNode` property.
- Persistent node/group/reroute geometry and node z-index live in `layoutStore`.
  `LGraphNode` still owns `_posSize`, mutation views, geometry-version checks,
  and layout write-through. These provide the stable indexed `pos` and `size`
  references expected by extensions.
- `bringToFront` updates layout z-index and legacy `_nodes` order.
  `sendToBack` changes only `_nodes`; renderer switching later re-sorts that
  array from layout z-index.
- `NodeState.inputs` and `outputs` contain slot class instances. Their
  connectivity facades read `linkStore`, while descriptor fields, node
  back-references, drawing, geometry, and callbacks remain class behavior.
- `LLink` topology remains in `linkStore`. `linkStateStore` owns separately
  categorized persistent color and runtime execution, interaction, render, and
  hit-test state behind compatible `LLink` accessors and the same lifecycle.
- Group geometry is store-backed, but presentation fields remain on
  `LGraphGroup`.

Representative implementation:

- `src/types/nodeState.ts`; `src/lib/litegraph/src/LGraphNode.ts`.
- `src/renderer/core/layout/operations/graphLayoutAttachment.ts` and
  `layoutMutations.ts`.
- `src/lib/litegraph/src/LGraphCanvas.ts`: `bringToFront` and `sendToBack`.
- `src/renderer/core/canvas/litegraph/arrangeForLegacyRender.ts`.
- `src/lib/litegraph/src/node/SlotBase.ts`, `NodeSlot.ts`, `NodeInputSlot.ts`, and
  `NodeOutputSlot.ts`.
- `src/lib/litegraph/src/LLink.ts` and
  `src/renderer/core/canvas/litegraph/litegraphLinkAdapter.ts`.
- `src/lib/litegraph/src/LGraphGroup.ts`.

Representative evidence:

- `src/stores/nodeDataStore.test.ts`: shell transfer and slot-array identity.
- `src/lib/litegraph/src/LGraphNode.test.ts`: stable geometry views and
  store-backed indexed writes.
- `src/renderer/core/layout/operations/layoutMutations.test.ts` and
  `src/renderer/core/canvas/litegraph/arrangeForLegacyRender.test.ts`: z-order
  mutation and legacy projection.
- `src/lib/litegraph/src/node/NodeInputSlot.test.ts`,
  `NodeOutputSlot.test.ts`, and `slotEcosystemPatterns.test.ts`: derived
  connectivity and extension compatibility.
- `src/lib/litegraph/src/canvas/LinkConnector.core.test.ts`: transient link
  interaction state.

### Outputs, properties, widgets, and preview exposures

- `nodeOutputStore` maintains reactive output and preview maps, locator-aware
  removal, object-URL cleanup, and workflow stash/restore. Its read/write paths
  still synchronize in both directions with `app.nodeOutputs`,
  `app.nodePreviewImages`, `node.images`, and `node.imgs`.
- `LGraphNode.properties` remains directly mutable. First-party code writes it
  both through `setProperty` and directly. Serialization clones the whole map.
- Registered widget values and order are store-backed. General node configure
  still restores from named or positional wire shadows, and delayed widget
  creation plus some first-party consumers still read or write those shadows.
- `previewExposureStore` is further along than the prior plan wording implied:
  subgraph configure hydrates it from the compatibility property, runtime reads
  use it, and serialization projects from it. The remaining gap is scoped
  identity and lifecycle cleanup, not initial authority.

Representative implementation:

- `src/stores/nodeOutputStore.ts`; `src/scripts/app.ts`.
- `src/lib/litegraph/src/LGraphNode.ts`: `properties`, `configure`,
  `setProperty`, and `serialize`.
- `src/stores/widgetValueStore.ts`; `src/lib/litegraph/src/widgets/BaseWidget.ts`;
  `src/extensions/core/widgetInputs.ts`.
- `src/stores/previewExposureStore.ts` and
  `src/lib/litegraph/src/subgraph/SubgraphNode.ts`.

Representative evidence:

- `src/stores/nodeOutputStore.test.ts` and
  `nodeOutputStore.workflowSwitch.test.ts`: mirrored maps, legacy image
  projection, cleanup, and workflow switching.
- `src/lib/litegraph/src/LGraphNode.widgetOrder.test.ts`: named/positional
  restoration and reorder behavior.
- `src/lib/litegraph/src/subgraph/SubgraphWidgetPromotion.test.ts`: store-backed
  promoted values and preview-exposure round trips.
- `src/stores/previewExposureStore.test.ts`: graph isolation and root cleanup.

### Serialization and extension boundary

- `LGraph.asSerialisable`, `LGraphNode.serialize`, and the group/subgraph
  serializers remain the wire-format oracle. No store-record serializer exists.
- Node and graph `onSerialize` hooks receive the complete mutable canonical DTO.
  The repository has no adapter that extracts a validated namespaced extension
  payload or rejects canonical-field writes.
- Prompt construction serializes the workflow and then invokes asynchronous
  widget `serializeValue` hooks. At least one first-party hook mutates the
  positional workflow widget projection, so prompt derivation is not isolated
  from persistence DTOs.

Representative implementation:

- `src/lib/litegraph/src/LGraph.ts`: `asSerialisable` and graph `onSerialize`.
- `src/lib/litegraph/src/LGraphNode.ts`: node `serialize` and `onSerialize`.
- `src/utils/executionUtil.ts`: workflow and prompt construction.
- `src/extensions/core/dynamicPrompts.ts`: queue-time workflow projection write.

## Corrections established by the baseline audit

1. Preview-exposure persistence has already moved to a store for runtime reads
   and serialization. Remaining work is scoped host/source cleanup and the
   compatibility hydration boundary.
2. `_version` increments use one method, but mutation callers still own
   invalidation policy. The missing boundary is centralized policy and batching,
   not an increment helper.
3. `nodeOutputStore` already owns substantial locator, object-URL, and workflow
   cleanup. It is not authoritative because it still reads legacy maps and
   accepts live node image fields as reverse synchronization inputs.
4. Slot connectivity and persistent geometry already have store authorities.
   The remaining work concerns plain descriptors and compatibility projection
   ownership, not moving connectivity or duplicating geometry.
5. Widget and preview-exposure stores have root cleanup. They lack complete
   node/owner cleanup across remove, replacement, failed configure, and released
   subgraphs.

## Implemented migration sequence rationale

The implemented sequence followed the serialization dependencies:

1. Finished narrow authorities and lifecycle first: `boxcolor`, ordering,
   output/preview directionality, widget/preview owner cleanup, and graph
   metadata/identity ownership.
2. Moved class projections behind compatibility adapters: node geometry,
   slot descriptors, group presentation, link runtime categories, properties,
   and unknown-node fallback records.
3. Parsed widget and extension compatibility payloads at workflow boundaries
   and removed first-party writes to wire shadows.
4. Added a store-record serializer beside the mutable serializer and proved
   normalized differential parity before changing production serialization.

This ordering does not require a universal ECS world, command replay, or a new
undo model.

## Progress record

Each concern is completed in its own commit. The order follows the dependency
sequence above rather than the summary-table order.

| Sequence | Concern                             | Status   | Commit       | Result                                                                                                 |
| -------- | ----------------------------------- | -------- | ------------ | ------------------------------------------------------------------------------------------------------ |
| 1        | Remaining node visuals              | Complete | `fa5dcd8ca`  | `boxcolor` moved into `NodeState` with an enumerable tracked compatibility accessor.                   |
| 2        | Node ordering                       | Complete | `06ae14e8b`  | One action now updates layout z-index and the legacy node array for front/back order.                  |
| 3        | Outputs and transient previews      | Complete | `570b38c2a`  | Store maps own reads; the legacy output map commits mutations through a compatibility view.            |
| 4        | Preview-exposure persistence        | Complete | `2212ed302`  | Host exposures use owner-scoped locators; raw node-ID entries are hydration-only input.                |
| 5        | Widget and preview-exposure cleanup | Complete | `ecd148fa0`  | Removal, replacement, and teardown clear node-owned records; failed configure cleanup remains limited. |
| 6        | Graph metadata                      | Complete | `298bf3da0`  | Revision, config, and extra now use graph-keyed store records behind compatibility accessors.          |
| 7        | Entity ID allocation                | Complete | `7fbd10624`  | Root-keyed allocation state now backs graph accessors; clipboard allocation uses shared helpers.       |
| 8        | Graph and subgraph definitions      | Complete | `8923225fb`  | Root-scoped records now own ordered membership, the registry, and subgraph definition metadata.        |
| 9        | Legacy node geometry projection     | Complete | `854f68fb2`  | The layout adapter now owns stable legacy views, synchronization, and geometry write-through.          |
| 10       | Plain slot descriptors              | Complete | `cc53dad291` | Plain store descriptors now back stable extension-visible slot class projections.                      |
| 11       | Group presentation                  | Complete | `3ac7b726a`  | Graph-definition records now back mutable presentation fields and serialization.                       |
| 12       | Link non-topological state          | Complete | `38b40988a`  | Separate persistent and runtime records now back compatible link fields with topology lifecycle.       |
| 13       | Node properties                     | Complete | `f75b30dbd`  | Node state now owns stable mutable properties across lifecycle, callbacks, and serialization.          |
| 14       | Unknown-node fallback               | Complete | `ba4757f4c`  | Node state now owns unknown-node fallback records behind the compatibility accessor.                   |
| 15       | Delayed widget restoration          | Complete | `972947d939` | Store-owned restoration state now hydrates configured and delayed widgets from wire shadows.           |
| 16       | Extension persistence adapter       | Complete | `287bf33f38` | Validated payloads round trip through a namespace while legacy hooks mutate isolated DTO views.        |
| 17       | Execution order                     | Complete | `7f6c2783dd` | Graph-scoped derived records own execution order behind the compatible node projection.                |
| 18       | Graph invalidation                  | Complete | `335b69420c` | Graph-scoped batching coalesces composite invalidations behind the compatible version counter.         |
| 19       | Store-driven serialization          | Complete | `458d292f1`  | Store authorities now build wire DTOs after normalized parity against mutable serialization.           |

Final full-suite verification also tightened slot-projection deletion and
updated test fixtures to preserve their store scope and projected-array
contract.

Post-review regression verification restored legacy output-map write-through,
kept widget output changes observable by preview rendering, and removed a
redundant MatchType slot wrapper that hid descriptor updates from Vue.

| Review follow-up                    | Commit      | Result                                                                                  |
| ----------------------------------- | ----------- | --------------------------------------------------------------------------------------- |
| Graph extension isolation           | `b8fdbf860` | Configure payloads remain in isolated persistence records and hook views.               |
| Nested legacy output mutations      | `cceb56330` | Output fields and their immediate arrays commit through stable mutation views.          |
| Populated graph ID changes          | `17546ff13` | Populated graphs reject ID reassignment instead of splitting scoped store state.        |
| Native slot callback array behavior | `73c3c633f` | Callback-bearing array methods now receive and mutate the extension-visible slot array. |

## Verified current limitations

- Slot descriptors remain behind a virtual slot-class array. Native callback
  behavior is preserved, but complete reflection compatibility still requires
  restoring real extension-visible slot arrays.
- `graphDefinitionStore` still contains live node, group, subgraph, and
  interface instances. Persisted UUIDs remain runtime store keys; populated
  graph IDs are therefore immutable until instance-scoped identity replaces
  that keying model.
- Store-driven persistence joins and compatibility adaptation still live in
  and around `LGraph`.
- Replacement configure is destructive on failure, while additive configure
  has only best-effort rollback.
- `SubgraphNode` still owns promoted-widget projection, preview hydration, and
  host persistence responsibilities.

## Structural follow-up plan

These are future structural improvements, not incomplete rows in the scoped
19-concern migration. They should proceed as vertical slices rather than adding
more projections to `LGraph` and `LGraphNode`.

1. **Replace the slot virtual array.** Keep extension-visible input and output
   arrays as real slot-class arrays. Derive plain serializable descriptors at
   the node-state boundary until a complete ID-based slot record can replace
   both representations. Remove `slotDescriptorView` only after ecosystem
   tests cover indexed access, mutation methods, reflection, and stable slot
   identity.
2. **Introduce one plain graph record.** Replace live node, group, subgraph, and
   interface instances in `graphDefinitionStore` with ordered IDs and plain
   component records. Resolve runtime adapters through one instance-scoped
   registry. The instance scope must allow two loaded graphs with the same
   persisted UUID without rekeying one graph's state over the other.
3. **Extract persistence from `LGraph`.** Move store joins, invariant checks,
   extension payload adaptation, and DTO construction into a focused graph
   persistence adapter. Keep the mutable serializer as the compatibility
   oracle until canonicalized DTOs compare with exact equality for root graphs,
   nested subgraphs, groups, reroutes, widgets, unknown nodes, and extensions.
4. **Make configure transactional.** Stage graph records and topology before
   publishing them, then swap atomically. This replaces the current best-effort
   rollback for additive configuration and gives failed root replacement the
   same no-partial-state guarantee.
5. **Decompose subgraph hosting.** Move promoted-widget projection, preview
   exposure hydration, and host persistence out of `SubgraphNode` into focused
   adapters, returning the class below the 1,000-line boundary without adding
   another general-purpose manager.

Each slice needs focused unit tests for its pure boundary plus the existing
Playwright bridge-history scenarios for delete/undo/redo, renderer switching,
navigation, and reload. Production authority should switch only after exact
serializer parity and the browser suite pass together.
