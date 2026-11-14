# ADR-ECS-0051: Entity Data Lives in Dedicated Stores as Plain Data

Date: 2026-11-02

## Status

Accepted

## Context

[ADR-ECS-0008](ECS-0008-entity-component-system.md) proposed one central
"World" registry with branded IDs for every entity kind, component schemas and
a full systems layer. Implementation took a different path: entity data moved
out of the litegraph classes into several focused stores, and the World was
never built. Its amendments recorded each step, which left a long proposal
whose rules readers had to reconstruct from the amendments.

This record states the rules that hold in the code today. ECS-0008 remains as
history.

## Decision

1. **Durable layout goes through commands.** Persistent node, group and reroute
   geometry changes flow through serializable `LayoutOperation` objects applied
   by the layout store. Renderer measurements stay outside that stream. Other
   entity stores expose direct actions; command coverage is not generalized to
   them.
2. **Entity data lives in dedicated stores.** Each concern has its own Pinia
   store (node data, links, reroutes, link presentation, widget values,
   preview exposure) rather than one registry. Data that belongs in a store is
   not added to an entity class as an instance property.
3. **Stores key by the branded IDs in `@comfyorg/graph-model`.** Node, link
   and reroute records are bucketed by `RootGraphId`. `NodeId` is a branded
   string; `LinkId`, `RerouteId` and `GroupId` are branded numbers. Widgets key
   by `WidgetId`, which `widgetId()` builds by URI-encoding the node ID and
   widget name and joining them as `graphId:nodeId:name`. The duplicate-name
   rules in ECS-0008's
   [Widget identity keys on `name`](ECS-0008-entity-component-system.md#widget-identity-keys-on-name)
   still apply.
4. **Components are plain data.** A component has no methods and no
   back-reference to its entity; behavior lives in systems and composables.
   Node slot records are the known exception: `NodeState` still holds the live
   slot instances.
5. **No god-object growth.** New behavior does not become a method on
   `LGraphNode`, `LGraphCanvas`, `LGraph` or `Subgraph`, and new entity data
   does not use class inheritance. The existing class hierarchies remain for
   extension compatibility.
6. **Extension-facing surfaces change with migration guidance.** Entity
   callbacks (`onConnectionsChange`, `onRemoved`, `onAdded`,
   `onConnectInput`/`onConnectOutput`, `onConfigure`, `onWidgetChanged`),
   `node.widgets`, `node.serialize` and `graph._version` are used by custom
   nodes; changing them needs a migration path.

Derived presentation data, such as node badges, is computed on demand by a
system rather than materialized in a store.

## Consequences

### Positive

- Readers get the binding rules without reading ECS-0008's amendments.
- Stores stay small and independently testable.

### Negative

- There is no single entity registry; cross-concern queries combine stores.
- Slot records are not yet plain data, so rule 4 has an open exception.

## Notes

Slot records follow
[ADR-ECS-SLOTS-0017](ECS-SLOTS-0017-slot-records-as-the-source-of-truth.md).
