# ECS Component and Entity data audit

Status: Current implementation audit
Verified: 2026-08-21 against `95f1c114bdafbf944caad7d10a1f2f998f190659`
Scope: Work remaining under
[Centralize remaining Component and Entity data](ecs-migration-plan.md#2-centralize-remaining-component-and-entity-data)

This audit verifies the current authority, compatibility projection, and
lifecycle boundary for every concern in that section. `Open` means the planned
authority does not exist. `Partial` means a store or centralized mechanism
exists, but a live class, legacy map, or caller still owns part of the durable
state or mutation policy.

## Summary

No item in this section is complete. The implementation has useful foundations:
node shell fields, topology, persistent layout, widget values, and preview
exposures have store-backed authorities. The remaining gaps are not uniformly
"add a store." Most require moving serialization, lifecycle, or compatibility
projection ownership away from live LiteGraph classes without changing their
extension-visible behavior.

| Concern                             | Status  | Verified current boundary                                                                                                                                                  |
| ----------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Graph and subgraph definitions      | Open    | `LGraph` and `Subgraph` own membership, order, metadata, and interfaces; serializers enumerate the live registries.                                                        |
| Remaining node visuals              | Partial | `NodeState` owns most shell visuals; `LGraphNode.boxcolor` remains a directly configured and serialized class field.                                                       |
| Outputs and transient previews      | Open    | `nodeOutputStore` mirrors and sometimes reads `app.nodeOutputs`, `app.nodePreviewImages`, and live node image fields rather than projecting compatibility state outward.   |
| Node ordering                       | Partial | Layout z-index is canonical for Vue and renderer switching; `sendToBack` mutates only legacy `_nodes` order.                                                               |
| Store-driven serialization          | Open    | `LGraph.asSerialisable`, `LGraphNode.serialize`, group serializers, and subgraph serializers still walk live objects.                                                      |
| Legacy node geometry projection     | Partial | Layout is authoritative, but `LGraphNode` owns stable mutable buffers, version tracking, synchronization, and write-through callbacks for `pos` and `size`.                |
| Link non-topological state          | Partial | `linkStore` owns topology; `LLink` still owns execution data, interaction flags, render paths, hit-test geometry, and color without one defined lifecycle.                 |
| Plain slot descriptors              | Partial | Store-owned node arrays contain reactive slot class instances. Connectivity is derived from `linkStore`, while descriptor data, drawing, callbacks, and geometry stay OOP. |
| Node properties                     | Open    | `LGraphNode.properties` is a directly mutable dictionary with optional `setProperty` orchestration.                                                                        |
| Group presentation                  | Open    | Layout owns group geometry; `LGraphGroup` owns title, color, font, font size, and flags.                                                                                   |
| Preview-exposure persistence        | Partial | `previewExposureStore` is authoritative for runtime lookup and serialization; raw host keys and root-only cleanup remain.                                                  |
| Extension persistence adapter       | Open    | Graph and node `onSerialize` hooks receive the complete mutable canonical DTO; no validated extension namespace protects store-backed fields.                              |
| Graph metadata                      | Open    | `revision`, `config`, and `extra` are public class fields configured and serialized directly.                                                                              |
| Graph invalidation                  | Partial | `incrementVersion()` centralizes the primitive, but graph, node, canvas, widget, slot, and subgraph callers still choose when `_version` changes.                          |
| Unknown-node fallback               | Partial | `last_serialization` is an opaque class-owned DTO that overrides normal serialization and follows only the live-node lifecycle.                                            |
| Execution order                     | Partial | Topology recomputation writes `node.order`, but the mutable field is also configured and serialized as wire state.                                                         |
| Entity ID allocation                | Partial | Root and subgraphs share `LGraph.state`; helper APIs exist, but configure, clipboard, and compatibility setters can still observe or mutate class-owned counters.          |
| Delayed widget restoration          | Partial | Registered widgets use `widgetValueStore`; general configure and delayed dynamic-widget paths still consume or mutate `widgets_values` and `widgets_values_named` shadows. |
| Widget and preview-exposure cleanup | Partial | Both stores clear a root; neither has complete owner/node cleanup wired through remove, replacement, failed configure, and released-subgraph teardown.                     |

## Verified authority and mutation paths

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
- Unknown node load stores the complete source DTO in
  `LGraphNode.last_serialization`. Missing-node serialization returns that DTO
  over current store-backed fields except for selected compatibility overrides.

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
- `LLink` topology is store-backed. Execution payload, drag state, render path,
  center/angle caches, endpoint hit geometry, and optional color remain on the
  live link with different persistence and cleanup expectations.
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

## Corrections to the prior plan wording

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

## Dependency order

The smallest safe sequence follows the serialization dependencies:

1. Finish narrow authorities and lifecycle first: `boxcolor`, ordering,
   output/preview directionality, widget/preview owner cleanup, and graph
   metadata/identity ownership.
2. Move class projections only behind compatibility adapters: node geometry,
   slot descriptors, group presentation, link runtime categories, properties,
   and unknown-node fallback records.
3. Parse widget and extension compatibility payloads at workflow boundaries and
   remove first-party writes to wire shadows.
4. Add a store-record serializer beside the current class serializer and prove
   normalized differential parity before changing production serialization.

This ordering does not require a universal ECS world, command replay, or a new
undo model.

## Progress record

Each concern is completed in its own commit. The order follows the dependency
sequence above rather than the summary-table order.

| Sequence | Concern                             | Status      | Commit      | Result                                                                                    |
| -------- | ----------------------------------- | ----------- | ----------- | ----------------------------------------------------------------------------------------- |
| 1        | Remaining node visuals              | Complete    | `fa5dcd8ca` | `boxcolor` moved into `NodeState` with an enumerable tracked compatibility accessor.      |
| 2        | Node ordering                       | Complete    | `06ae14e8b` | One action now updates layout z-index and the legacy node array for front/back order.     |
| 3        | Outputs and transient previews      | Complete    | `570b38c2a` | Store maps now own output and preview reads; legacy maps and node images are projections. |
| 4        | Preview-exposure persistence        | Complete    | `2212ed302` | Host exposures use owner-scoped locators; raw node-ID entries are hydration-only input.   |
| 5        | Widget and preview-exposure cleanup | Complete    | This commit | Node removal, replacement, teardown, and failed configure clear node-owned store records. |
| 6        | Graph metadata                      | Not started |             |                                                                                           |
| 7        | Entity ID allocation                | Not started |             |                                                                                           |
| 8        | Graph and subgraph definitions      | Not started |             |                                                                                           |
| 9        | Legacy node geometry projection     | Not started |             |                                                                                           |
| 10       | Plain slot descriptors              | Not started |             |                                                                                           |
| 11       | Group presentation                  | Not started |             |                                                                                           |
| 12       | Link non-topological state          | Not started |             |                                                                                           |
| 13       | Node properties                     | Not started |             |                                                                                           |
| 14       | Unknown-node fallback               | Not started |             |                                                                                           |
| 15       | Delayed widget restoration          | Not started |             |                                                                                           |
| 16       | Extension persistence adapter       | Not started |             |                                                                                           |
| 17       | Execution order                     | Not started |             |                                                                                           |
| 18       | Graph invalidation                  | Not started |             |                                                                                           |
| 19       | Store-driven serialization          | Not started |             |                                                                                           |
