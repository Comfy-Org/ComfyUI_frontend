# ECS lifecycle scenarios

Status: Partial
Verified: 2026-08-20 against `13a302eadda871b939b148ecb87e3d845ceefff2`

This document summarizes current lifecycle boundaries and the requirements for
their ECS replacements. Exact call order, ownership, and failure behavior are in
the [lifecycle audit](ecs/ecs-lifecycle-audit.md). Mutation and transaction gaps
are in the [mutation audit](ecs/ecs-mutation-audit.md).

## Current bridge

### Load and configure

`LGraph.configure` normalizes recursive identities, clears or detaches
concern-specific state, registers links and reroutes, creates all node shells,
and then configures nodes. This two-pass object lifecycle remains necessary for
callbacks, extensions, and unknown-node fallbacks.

- `linkStore` owns topology by root-wide `LinkId` and owner-qualified endpoint
  indexes.
- `rerouteStore` owns chain state; membership derives from link parent chains.
- `nodeDataStore` owns the registered node shell proxy.
- `layoutStore` owns persistent node, group, and reroute geometry.
- `widgetValueStore` owns registered values, render state, and order, while live
  widget objects and serialized value shadows remain compatibility inputs.
- Unknown nodes preserve an opaque `last_serialization` record that can override
  normal component serialization.

Failed configuration is not transactional. Callbacks and readers can observe
partially published state, and owner-scoped cleanup is not uniform across all
stores.

### Connect and disconnect

`LGraphNode` and `LGraph` still orchestrate validation, replacement,
registration, reroute anchoring, callbacks, dirtying, `_version`, and snapshot
undo. Slot connectivity is not mirrored: deprecated `input.link` and
`output.links` accessors derive from `linkStore` and ignore writes.

The target for this phase is one topology mutation owner that preserves
extension veto/callback semantics while updating authoritative link and reroute
stores. A serializable command or workflow transaction is not required.

### Node removal and graph clear

Node removal disconnects topology, releases unreachable subgraphs, runs
callbacks and typed lifecycle events, detaches node/layout ownership, and then
removes legacy indexes. Individual widgets unregister when their own lifecycle
runs, but normal node removal can retain widget records until explicit deletion
or root clear.

Root clear tears down owned graphs and then clears concern-specific root state.
Subgraph release uses owner-aware node/link/reroute/layout cleanup, while widget,
preview, output, and compatibility shadows do not yet share one owner-scoped
contract. Exceptions complete structural teardown where implemented but do not
roll back earlier callbacks or mutations.

### Replace, pack, unpack, copy, and insert

Replacement transfers same-ID node shell and layout ownership before swapping
legacy registries and rebuilding widgets/connections. Pack/unpack and clipboard
operations clone or convert serialized records, remap IDs by entity kind, and
re-register through current class/store chokepoints. Direct workflow insertion
converts recursive workflow data to clipboard items without a temporary graph,
canvas, or local-storage round trip.

These operations are not scope-retagging shortcuts. Root-wide identity,
definition ownership, endpoint indexes, layout keys, widget IDs, promoted
metadata, and extension callbacks require concern-specific remapping and
validation.

### Serialize and undo

Serialization still walks live graph, node, group, subgraph, and widget objects,
reading store-backed accessors where available. Allocation counters, unknown-node
fallbacks, execution order, properties, graph metadata, and widget-value shadows
remain class-side durable inputs. Undo and redo restore serialized snapshots
through `ChangeTracker`; layout operations are not an independent undo stream.
Node and graph `onSerialize` hooks may mutate complete output DTOs, while generic
configure assignment and `onConfigure` expose the corresponding load-time
extension channel. These hooks are not constrained to extension-owned payloads
and do not participate in a command or transaction contract.
Execution prompt construction separately awaits `widget.serializeValue`, whose
implementations can mutate workflow shadows or UI and perform media/upload
effects. Resolved execution values are not currently a deterministic command or
recorded pre-execution effect boundary.

## Data-centralization requirements for this phase

The replacement lifecycle for this phase must provide:

1. Concern-specific identity and owner cleanup rather than one universal key or
   `clearGraph` convention.
2. Store-owned plain graph/subgraph definitions, slot/widget schemas, properties,
   outputs, unknown-node records, metadata, and other durable render inputs.
3. Callback/event compatibility that is preserved, measured, or deliberately
   versioned; systems cannot simply eliminate callbacks during migration.
4. Existing snapshot undo and persistence restoring the same centralized data.
5. Derived execution order, invalidation revision, badges, and transient geometry
   that cannot become competing persisted authorities.
6. A controlled extension persistence adapter that protects canonical
   store-backed fields from becoming secondary authorities.

Serializable commands, command replay or inverse undo, workflow-wide
transactions, and broader CRDT compatibility are later architecture work, not
requirements for this phase.

The [migration plan](ecs/ecs-migration-plan.md) defines sequencing and completion
criteria. This document intentionally avoids hypothetical system APIs until a
concrete implementation and verification path exists.
