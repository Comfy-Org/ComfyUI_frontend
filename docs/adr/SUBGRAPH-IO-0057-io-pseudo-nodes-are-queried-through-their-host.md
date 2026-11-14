# ADR-SUBGRAPH-IO-0057: IO pseudo-nodes are queried through their host

Date: 2026-11-13

## Status

Proposed

## Context

A SubgraphNode's inputs and outputs are a contract between the exterior graph
and its definition. Inside the definition, `SubgraphInputNode` and
`SubgraphOutputNode` present the two halves of that contract: the input node
offers the exterior inputs as link sources, and the output node accepts links
that become the exterior outputs. They are pseudo-nodes. They are not graph
nodes, they do not execute, and they are not serialized as nodes.

Every definition gives them the same fixed IDs, -10 and -20. A saved definition
stores their bounds as `inputNode` and `outputNode`, and its links name them
through `origin_id` and `target_id`.

Registering them as node entities fails on identity. `nodeDataStore` and
`layoutStore` key graph nodes by root graph and expect an ID to be unique
across a workflow and all of its subgraph definitions. The fixed IDs repeat in
every definition, so a root-keyed entry would give two definitions one
pseudo-node.

The data a pseudo-node shows has two owners. Its values belong to a host:
ADR-SUBGRAPH-INPUTS-0056 renders the selected SubgraphNode's widgets, so two
hosts of one definition show different values. Its geometry belongs to the
definition, which saves one rectangle per pseudo-node for every host.

## Decision

### No node entity

Pseudo-nodes register no `NodeState` and stay out of every graph's node list.
-10 and -20 remain their IDs in memory and on disk.

### Values are a query by host

`subgraphInputValuesStore` resolves the selected host, and its `sourcesFor`
query takes a host and returns each input's value source. The panels read
pseudo-node values only through that query, so two hosts of one definition
yield two results without per-host state. Without a resolved host, the panels show slots without values. The
classic canvas draws no values and reads slots from the pseudo-node.

### Geometry is a layout entry keyed by the definition

A pseudo-node's position and size are a `layoutStore` node entry keyed by the
definition ID and the fixed ID. `SubgraphIONodeBase.pos` and `size` are views
of that entry through the same attachment projection graph nodes use, so moves
and resizes are `LayoutOperation`s. They sync through the layout document like
any node entry. Undo snapshots serialize the entry, and reconfiguring restores
it. Panel measurements and slot offsets use the same key and stay transient.

The size that fits the slots when no panel is measured is derived, not
written. `arrange` keeps it on the pseudo-node, `boundingRect` renders it, and
`asSerialisable` saves it, so drawing never issues a `LayoutOperation`.

The entry is created when the definition is configured, and renaming an empty
definition moves it to the new key. `detachGraphLayouts`
deletes it, with its measurements, whenever it visits the definition. Root
`clearGraph` matches keys by the root graph ID, so it never covers a
definition-keyed entry.

The panels render outside `TransformPane`, so they still apply the camera
transform each frame. Their size reads the entry reactively.

## Alternatives considered

- **Node entities with IDs qualified by the definition.** Unique and stable,
  but it puts pseudo-nodes in stores that mean graph nodes. Every consumer that
  lists a graph's nodes would have to filter them out, and extensions that
  compare link endpoints with -10 or -20 would stop matching.
- **Layout entries qualified by the SubgraphNode instance.** Values are per
  instance, but geometry is per definition. Instance keys fork one saved
  rectangle into several entries that can drift apart, and entering a
  definition with no resolved host leaves no key.
- **Pseudo-nodes as `LGraphNode` graph members, plus an exclusion check.**
  Serialization, execution, node commands, and extensions that walk the node
  list would all have to skip them, and a missed check could serialize,
  execute, delete, or copy one half of a contract.
- **Rendering pseudo-nodes through `LGraphNode.vue`.** It resolves layout,
  widgets, and slots by node ID in the root scope. Reusing it needs a
  data-driven variant, which is a separate decision. The panels keep composing
  the shared node frame components.

## Consequences

Saved workflows, the `inputNode` and `outputNode` fields, and link endpoint IDs
do not change, so neither files nor extensions need a migration.

Pseudo-node geometry follows the layout command rules of
ADR-CRDT-LAYOUT-0003. The resize exception in ADR-SUBGRAPH-INPUTS-0056 is
removed.

Layout entries exist outside any root graph's key range. Code that iterates
`layoutStore` node entries by root graph does not see them, and code that
iterates every entry must expect them.

The node stores keep meaning graph nodes only. Pseudo-nodes stay outside node
features such as search, selection commands, and node menus.

## References

- [Internal editors share host widgets](SUBGRAPH-INPUTS-0056-internal-editors-share-host-widgets.md)
- [Entity component system](ECS-0008-entity-component-system.md)
- [Entity ID collision policy](ECS-IDENTITY-0016-entity-id-collision-policy-and-recovery.md)
- [Layout intent and local measurement](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md)
