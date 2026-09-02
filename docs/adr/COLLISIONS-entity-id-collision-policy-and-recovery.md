# ADR-COLLISIONS: Entity ID Collision Policy and Recovery

Date: 2026-08-24

## Status

Proposed

## Context

Entity IDs from serialized workflows, paste operations, imports, and CRDT
updates are observed input. They can collide with IDs that are already
registered in memory. A store can detect the collision, but it cannot know
whether its caller has enough context to recover from it.

This distinction matters because registration failures do not all describe the
same condition:

- A distinct node state that collides with an existing node ID is recoverable
  input during workflow load or paste. `nodeDataStore` rejects the registration,
  and `LGraph.add()` can re-mint the ID.
- Re-registering the same node under a different root, or unregistering a state
  identity that the store does not own, indicates lifecycle corruption.
- Identity-keyed entity registries and structural registries do not necessarily
  have the same collision semantics. A structural widget ID can be recycled
  when a node ID is reused, for example.
- Distributed conflicts can often be reconciled at a CRDT or import boundary
  before an entity is committed to an in-memory registry.

Calling `assert()` on an ordinary recovery path changes load behavior because
assertions throw in development builds. Conversely, silently accepting every
collision can hide lifecycle corruption. The contract therefore needs to
distinguish recoverable input from violated invariants and stable identity keys
from recyclable structural keys.

## Decision

1. Resolve distributed and import conflicts at the earliest boundary with
   enough context to reconcile them, including normalization at CRDT merge
   boundaries where possible.
2. Stores keyed by stable entity identity never overwrite an incumbent with a
   distinct entity. They return an explicit rejection for a conflict while
   allowing idempotent re-registration of the same entity or state object. A
   distinct object with the same identity key remains a conflict.
3. Callers that own ID allocation may recover from a rejected registration by
   re-minting the ID. Emit diagnostics at that recovery site, where both the old
   and new IDs and any downstream consequences are known.
4. Cross-root re-registration of the same registered object and deletion using
   an identity the store does not own are invariant violations and assert.
5. Registries with structural or otherwise recyclable keys may use a different
   resolution policy, but that policy must be documented next to the registry.
6. Evolve registration APIs toward an explicit discriminated result such as
   `registered | alreadyRegistered | conflict` instead of relying indefinitely
   on proxy-or-`undefined` return values.

### Current Registry Contracts

The ECS branch has these intentionally distinct contracts. Here, "same object"
means equality after Vue proxy unwrapping.

| Registry           | Key                                                 | Collision result                                                                | Idempotence                                             | Diagnostic behavior                                                     |
| ------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------- |
| `nodeDataStore`    | Root graph plus `NodeId`                            | A distinct state returns `undefined`; the incumbent is unchanged                | Same state object under the same owner returns it       | The store is silent; an ID-owning caller diagnoses any re-mint          |
| `linkStore`        | Root graph plus `LinkId`; owner-scoped target slot  | A duplicate ID or occupied non-floating target returns `undefined`              | Same topology object under the same owner returns it    | The store logs ID and target-slot conflicts                             |
| `rerouteStore`     | Root graph plus `RerouteId`                         | A distinct chain returns `undefined`; the incumbent is unchanged                | Same chain object under the same owner returns it       | The store logs the incumbent and requesting owners                      |
| `widgetValueStore` | Structural `WidgetId` (`graphId:nodeId:widgetName`) | The same widget type keeps the incumbent; a different type replaces stale state | Matching key and widget type returns the existing state | Type recycling is expected and silent; an un-keyable ID emits a warning |

## Alternatives Considered

- **Assert on every collision.** Rejected because normal configure,
  serialization-copy, subgraph, and paste paths can produce collisions that
  their callers can recover from. Treating untrusted input as an invariant
  violation would turn those paths into development-time throws.
- **Log inside every store.** Rejected because a store lacks the caller's
  recovery context. Store-level logging would report false errors for ordinary
  input and could not include the resulting replacement ID.
- **Return or adopt the incumbent universally.** Rejected because adopting an
  unrelated entity can hide distinct-identity bugs and is incorrect for stable
  entity IDs.
- **Use one collision policy for every store.** Rejected because stable entity
  identity and recyclable structural key spaces have different semantics.

## Consequences

### Positive

- Workflow load, paste, import, and distributed updates remain robust when
  presented with colliding IDs.
- Lifecycle corruption still fails loudly at the point where an invariant is
  violated.
- Recovery diagnostics include actionable old and replacement identity
  context.
- CRDT implementations have a documented boundary at which to reconcile
  conflicts before in-memory commitment.

### Negative

- Store contracts intentionally differ according to their key semantics.
- Callers must handle registration rejection explicitly.
- Existing proxy-or-`undefined` APIs remain less expressive until they are
  migrated to discriminated results.

## Notes

This decision consolidates the registration behavior and review outcomes in
[#13963](https://github.com/Comfy-Org/ComfyUI_frontend/pull/13963),
[#14443](https://github.com/Comfy-Org/ComfyUI_frontend/pull/14443),
[#15702](https://github.com/Comfy-Org/ComfyUI_frontend/issues/15702),
[#15720](https://github.com/Comfy-Org/ComfyUI_frontend/pull/15720),
[#15726](https://github.com/Comfy-Org/ComfyUI_frontend/pull/15726),
[#15707](https://github.com/Comfy-Org/ComfyUI_frontend/pull/15707),
[#15743](https://github.com/Comfy-Org/ComfyUI_frontend/issues/15743), and
[#15706](https://github.com/Comfy-Org/ComfyUI_frontend/issues/15706).
