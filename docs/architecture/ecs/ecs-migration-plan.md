# ECS migration plan

Status: Partial
Verified: 2026-08-16 against PR 14246

This plan records completed ECS migration work and the work that remains.
Detailed evidence and unresolved risks are in the focused audits under
[References](#references).

The governing decisions remain
[ADR 0003](../../adr/0003-crdt-based-layout-system.md) and
[ADR 0008](../../adr/0008-entity-component-system.md). This plan does not amend
them.

## Direction

Runtime graph state is moving from mutable LiteGraph object graphs into
dedicated stores, one store per concern. Legacy classes remain compatibility
facades while extensions and renderers migrate. Behavior moves into systems
only when there is a concrete consumer and a tested replacement path.

The implementation has no central ECS `World`. Each concern defines its own
identity, scope, storage, and cleanup. Layout uses Yjs. The other migrated
stores use reactive Pinia state.

## Work completed

| Concern              | Current result                                                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node shell           | `nodeDataStore` owns `NodeState`. `LGraphNode` adopts the registered reactive proxy; renderer-only node mirrors and `useGraphNodeManager` were removed.                                      |
| Link topology        | `linkStore` owns `LinkTopology` by root-wide `LinkId`, with owner, target, and origin indexes. `LLink` endpoint properties are compatibility accessors over the registered state.            |
| Slot connectivity    | Input and output connectivity is derived from `linkStore`. `input.link` and `output.links` are deprecated read-only compatibility accessors; writes are ignored.                             |
| Reroute chains       | `rerouteStore` owns parent/floating chain state. Link membership is derived from link parent chains rather than stored on reroutes.                                                          |
| Widget state         | `widgetValueStore` owns widget values, render metadata, and root-scoped per-node order. `BaseWidget` adopts registered state.                                                                |
| Layout               | Yjs-backed `layoutStore` owns persistent node, group, and reroute geometry. Entity lifecycle attaches geometry independently of renderer lifecycle, and layout writes use `LayoutOperation`. |
| Renderer integration | Vue and legacy renderers read the same persistent geometry. Renderer switches clear transient view geometry rather than reseeding entity layout.                                             |
| Badges               | Badge rows are derived by `badgeSystem`; the temporary badge store was removed. Badge data is transient and is not serialized or independently mutated.                                      |
| Identity             | Root graph allocation and import normalization enforce unique node, link, group, and reroute IDs across nested definitions. Owner indexes retain graph-local queries and teardown.           |
| Lifecycle            | Graph add, configure, replace, remove, subgraph release, and clear register, transfer, or release migrated state. Teardown handles reentrant and failing removal callbacks.                  |
| Persistence          | Serialization, subgraph conversion, copy/paste, and workflow insertion preserve the existing workflow format while normalizing conflicting identities.                                       |
| Compatibility        | Legacy graph, node, link, slot, widget, geometry, and callback surfaces remain available where practical. Changed behavior is documented in the extension migration references.              |

## Current boundaries

The following boundaries remain:

- `LGraph`, `LGraphNode`, `LLink`, `Reroute`, slot classes, and widget classes
  still contain behavior and coordinate mutations.
- Only layout has serializable operation-shaped writes. Topology uses validated
  store actions; node, reroute, widget, slot, and extension state still allow
  direct reactive or class mutation.
- No transaction spans Pinia stores, Yjs, legacy registries, callbacks, and
  undo history. Cross-store consistency relies on orchestration order.
- Undo and redo restore serialized snapshots. They do not replay or invert ECS
  commands.
- `NodeState.inputs` and `outputs` contain slot class instances. Slot data is
  not yet a plain component model.
- Widget order exists in both the store and `LGraphNode.widgets` during the
  compatibility period.
- Live graph object registries and store records coexist and must be attached
  and detached together.
- Link paths, slot bounds, and hit-test geometry are transient renderer caches,
  not persistent layout components.

## Work remaining

### 1. Prove the current bridge

Before broadening or removing compatibility paths:

- Add mixed undo/redo coverage for node replacement or removal involving
  links, reroutes, promoted widgets, and layout.
- Prove failed workflow configuration leaves no node, link, reroute, widget,
  or layout ownership behind.
- Exercise recursive mixed-ID collisions through load, insertion, copy/paste,
  save, and reload.
- Run a representative extension corpus against `LinkMap`, callback ordering,
  deprecated slot accessors, active-Pinia setup, node property enumeration,
  and geometry mutation.
- Establish measured renderer budgets for large-workflow drag, resize, link
  interaction, navigation, and renderer switching.

These are behavioral gates. Additional store-internal tests are lower priority
unless they cover a new invariant.

### 2. Establish mutation boundaries

- Define which graph-domain changes must become serializable commands and
  which transient or derived changes intentionally remain outside command
  history.
- Route topology rewires, reroute-chain edits, node shell changes, widget
  changes, subgraph edits, replacement, and promotion through explicit mutation
  boundaries instead of public proxy writes.
- Specify deterministic allocation, idempotency, rejection, and duplicate
  delivery behavior for each command or batch.
- Introduce a workflow-level transaction boundary, or documented compensation
  model, for changes spanning stores, layout, legacy registries, and callbacks.
- Define how command batches integrate with snapshot-based undo. Do not claim
  replayable or command-based undo until this is implemented and tested.

### 3. Extract remaining behavior

- Move connectivity orchestration out of graph/node classes while preserving
  synchronous validation and notification callbacks during the bridge period.
- Extract serialization only after stores contain sufficient authoritative
  data and parity can be checked against the existing wire format.
- Move legacy geometry projection ownership out of `LGraphNode` without
  changing `pos` and `size` extension behavior.
- Separate remaining link visual/runtime state when a renderer or interaction
  system can consume plain records directly.
- Extract plain slot state only when it removes a real class dependency; retain
  array order semantics and keep connectivity in `linkStore`.
- Move render and execution behavior incrementally rather than creating empty
  system abstractions ahead of consumers.

### 4. Retire compatibility paths

A compatibility path can be removed per concern only when:

- production reads and writes use the replacement API;
- serialization and undo parity are proven;
- extension usage has been measured and a migration is published;
- callback timing and rejection behavior are preserved or versioned;
- renderer performance meets the agreed budget; and
- rollback remains possible through the release containing the removal.

Likely retirement candidates include deprecated slot connectivity accessors,
indexed `graph.links[id]`, legacy layout aliases, duplicate widget-order
ownership, and class-owned component fields. They should not be removed as one
large final phase.

## Explicit non-goals

- Reintroducing a universal `World` registry.
- Creating a store for derived badge rows.
- Making transient renderer geometry persistent or CRDT-backed.
- Making every store Yjs-backed without a collaboration requirement.
- Adding a frontend-owned operation log or transport to `layoutStore`;
  collaboration belongs at the integration boundary with
  `@comfyorg/comfy-multi-player`.
- Creating slot IDs or component stores solely to match an abstract ECS model.
- Removing extension facades before migration evidence exists.

## Completion criteria

The migration is complete when, for every durable graph-domain concern:

1. One authority and one supported mutation boundary are documented.
2. Lifecycle registration, transfer, teardown, and failed-operation behavior
   are explicit and tested across nested graphs.
3. Serialization and undo restore the same authoritative state.
4. Derived and transient data cannot become competing persisted authorities.
5. Legacy classes no longer own domain behavior that has a store/system owner.
6. Remaining compatibility APIs are deliberate supported surfaces rather than
   synchronization bridges.
7. Extension and renderer compatibility meet documented correctness and
   performance gates.

## References

- [Executive summary](ecs-migration-summary.md)
- [Decision traceability](ecs-decision-traceability.md)
- [State authority audit](ecs-state-authority-audit.md)
- [Lifecycle audit](ecs-lifecycle-audit.md)
- [Mutation audit](ecs-mutation-audit.md)
- [Identity and scope audit](ecs-identity-scope-audit.md)
- [Extension compatibility audit](ecs-extension-compatibility-audit.md)
- [Verification audit](ecs-verification-audit.md)
- [Documentation audit](ecs-documentation-audit.md)
- [ECS target architecture](../ecs-target-architecture.md)
- [Link registration migration](../../extensions/link-registration-migration.md)
