# ADR-ECS-LINK-PRESENTATION-0028: Link Presentation Store Owns Hidden/Label State

Date: 2026-08-29

## Status

Proposed

## Context

Hideable links add two durable presentation fields: `hidden` replaces the
curve with endpoint badges, and `label` sets their text. These fields must
survive save, load, and undo; appear in subgraph definitions; and round-trip
through workflow JSON.

[ADR-ECS-0008](ECS-0008-entity-component-system.md) requires new entity state
to use plain data in a dedicated store. Existing object accessors preserve
legacy extension APIs; they are not precedent for adding new fields to
`LLink`.

Two existing stores are unsuitable:

- `extra.linkExtensions` requires `parentId`, so released clients would reject
  presentation for a link without a reroute.
- [ADR-CRDT-LAYOUT-0003](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md)
  keeps layout in a separate document from workflow presentation.

## Decision

1. `linkPresentationStore` owns `hidden` and `label`. Each root graph has a
   sparse map keyed by `LinkId` and an index of IDs by owning graph. Default
   presentation has no entry.

2. Ownership follows
   [ADR-ECS-IDENTITY-0016](ECS-IDENTITY-0016-entity-id-collision-policy-and-recovery.md).
   The first writing graph owns an entry. Other owners cannot read, overwrite,
   or take it.

3. Consumers address presentation through `GraphScope` and `LinkId`. `LLink`
   does not expose presentation accessors. Serialization and loading adapters
   translate between store state and workflow data at the format boundary.

4. Schema 0.4 stores presentation in `extra.linkPresentation` as
   `Record<linkId, { hidden?, label? }>`. Schema 1 and subgraph definitions use
   optional `hidden` and `label` fields on serialized links. Configure removes
   the generated schema 0.4 key from `extra`.

5. Link recreation transfers presentation through the old-to-new ID mapping.
   A split copies it to every resulting link. A merge keeps it only when all
   source links agree. Removing link topology also removes its presentation.

6. Hover state and badge geometry are transient derived data. They do not
   belong in this store or in workflow serialization.

## Consequences

- The wire format does not depend on the store's internal shape. Workflows with
  default presentation serialize as they did before this feature.
- Every link-recreation path must transfer presentation explicitly. Omitting
  that step silently restores the defaults, so each path needs a regression
  test.
- New presentation behavior does not expand the `LLink` compatibility API.
- The owner index must remain consistent with the entry map on every removal
  path.
