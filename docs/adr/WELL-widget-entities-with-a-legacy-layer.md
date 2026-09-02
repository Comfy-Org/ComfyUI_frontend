# ADR-WELL: Widget Entities with a Legacy Layer

Date: 2026-08-26

## Status

Proposed

## Context

[ADR-ECS](ECS-entity-component-system.md) separates entity identity, plain
component data, and system behavior. Widgets only partly follow that model.
`WidgetId` and widget values are store-backed, but `BaseWidget` still combines
identity, mutable state, rendering, input handling, serialization hooks, and a
back-reference to its node.

Extensions also treat `node.widgets` as a public JavaScript API. They add object
literals and class instances, retain references to those objects, define
prototype methods and accessors, and mutate the array directly. For example,
`comfy_mtb` passes a `CurveWidget` instance with prototype methods for drawing,
pointer handling, and sizing to `addCustomWidget`.

The classic canvas can use these objects directly. A store-backed renderer
cannot see a widget until it has been registered with the stores. This can leave
the two renderers with different widget sets.

Converting every extension object to `BaseWidget` would close the registration
gap, but it would also change behavior visible to extensions. Replacing a
prototype can remove inherited methods, break retained-reference assumptions,
and fail for objects that cannot be modified. Widget registration therefore
needs a compatibility boundary that preserves foreign objects while making
their state available to core systems.

## Decision

Represent a widget as a `WidgetId` plus plain data held in dedicated stores.
Keep behavior supplied by extensions behind a compatibility adapter. Do not
replace the prototype of an extension object during registration.

### Identity and state

1. Stores, systems, renderers, serialization adapters, diagnostics, and tests
   identify widgets by `WidgetId`. JavaScript object identity and class
   membership do not define widget identity.
2. This ADR keeps the current derived `WidgetId` format,
   `graphId:nodeId:name`. Changing that format requires a separate decision that
   addresses persistence, lifecycle, collisions, and migration.
3. Authoritative widget state belongs in plain-data components keyed by
   `WidgetId`. Components have no methods, prototype requirements, or
   back-references to `LGraphNode`.
4. Core systems and renderers read those components. New core behavior must not
   require a `BaseWidget` subclass or an `instanceof` check.

### Extension behavior

An extension object may implement drawing, pointer handling, sizing, callbacks,
or accessors that are not represented in components. One compatibility adapter
registry maps each `WidgetId` to its original extension object and invokes the
supported hooks on that object.

The compatibility adapter must:

- keep extension objects out of serialized entity state;
- preserve the original object and its prototype;
- expose supported behavior to core code only through the adapter; and
- leave the legacy collection, component stores, indexes, and adapter registry
  unchanged if registration cannot complete.

`BaseWidget` remains part of the migration, but it is not the target entity
model or a new requirement for extensions.

### Compatibility contract

Until a capability is deprecated, supported legacy widgets must have the same
presence, order, value, visibility, and socket or control classification in the
legacy collection and store-backed queries. Retained extension references must
continue to reach supported state and behavior, including prototype methods and
accessors.

Before implementing the adapter, record which `node.widgets` mutations and
reflection operations the current API supports. Turn that inventory into a
compatibility matrix and tests. Do not use broad terms such as "array-like" as
a substitute for naming the supported operations.

Registration and removal must update the legacy collection, component stores,
indexes, and adapter registry as one operation. On failure, none of those views
may retain a partial registration or removal.

## Migration

1. Record the current API's supported operations and extension object shapes
   using ecosystem code search and extension fixtures.
2. Run those operations against the legacy collection, store-backed queries,
   and both renderers.
3. Add the adapter without replacing prototypes, then move core consumers from
   `BaseWidget` state to store components.
4. Remove a legacy path only after serialization, restore, subgraphs, both
   renderers, and extension fixtures produce equivalent results.
5. Deprecate extension behavior only after documenting its replacement and
   measuring remaining use over a stated observation window. Define the
   threshold and rollback condition in the deprecation proposal.

Removing the compatibility adapter requires a follow-up ADR or an amendment to
this one.

## Alternatives Considered

### Convert every widget to `BaseWidget`

This would simplify registration, but converting foreign objects can change
their prototypes, descriptors, identity, and behavior. It would also make the
class model permanent when ADR-ECS intends to separate state from behavior.

### Keep extension objects in stores

This would preserve their references, but mutable foreign objects would then
control serialization and reactivity. Core systems could not rely on plain,
deterministic component data.

### Clone or proxy extension objects

This would avoid prototype replacement but change object identity and some
reflection behavior. Existing extensions have not opted into that contract.

### Remove direct widget mutation now

This would avoid a compatibility adapter, but it would break existing
extensions before a replacement API and migration path exist.

### Mint a new widget identifier

A minted identifier could survive a definition rename, but it would reopen the
persistence and reattachment questions settled by ADR-ECS. It is not required
to establish the behavior boundary.

## Consequences

If implemented, this decision will let both renderers use the same component
state without requiring extensions to inherit from `BaseWidget`. Foreign
objects will retain their existing identity and prototypes behind a defined
compatibility boundary.

The migration will temporarily require stores, a legacy collection, and an
adapter registry to remain synchronized. Some JavaScript mutations may not be
safe to support and will need explicit deprecation. Opaque extension behavior
will also limit serialization, collaboration, and worker isolation until
extensions move to declarative APIs.

The current `WidgetId` format still cannot distinguish duplicate names and does
not preserve state across definition renames. This ADR accepts those limits
from ADR-ECS rather than changing widget identity as part of the behavior
migration.

## Notes

This ADR narrows the widget portion of
[ADR-ECS](ECS-entity-component-system.md). It follows
[ADR-FAR](FAR-frame-atomic-rendering.md) by keeping compatibility work at
the registration boundary instead of adding it to renderer inner loops.

Bevy's [ECS callback example](https://bevy.org/examples/ecs-entity-component-system/callbacks/)
shows a related behavior boundary: a component holds a registered system ID,
and the ECS runs that system on demand.
