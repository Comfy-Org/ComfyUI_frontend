# 28. Link Presentation Store Owns Hidden/Label State

Date: 2026-08-29

## Status

Proposed

## Context

Hideable links introduce durable per-link presentation state: whether a link's
curve is replaced by endpoint badges (`hidden`) and the text those badges show
(`label`). The state must survive save/load and undo, appear in subgraph
`definitions`, and ride the workflow JSON so a workflow round-trips through
released clients unchanged.

[ADR 0008](0008-entity-component-system.md) places new cross-cutting entity
state in a dedicated graph-scoped store as plain component data rather than on
entity classes, and `LLink` is already a compatibility shell over the link
topology store. Three homes were considered:

- **Fields on `LLink`.** Rejected: an owned field beside a store-backed shell
  creates a second authority for the same entity, which the ECS model exists
  to eliminate.
- **Widening `extra.linkExtensions`.** Rejected: released clients validate
  those entries against a schema that requires `parentId`. A hidden link with
  no reroute would fail that validation and reject the whole workflow.
- **The CRDT layout store.** Rejected: presentation belongs to the workflow
  document rather than the layout document, and persisting it is not the
  layout store's concern.

## Decision

1. `linkPresentationStore` is the single runtime authority for `hidden` and
   `label`. Mirroring the link topology store, each root graph holds entries
   keyed by `LinkId` alongside an index of ids per owning graph, so ownership
   checks stay keyed by link id while owner-scoped queries never scan an
   unrelated graph's entries. An entry exists only for a link with non-default
   presentation, so the store's contents are exactly the set that serializes.

2. Ownership follows [ADR 0016](0016-entity-registration-collision-and-recovery-boundaries.md)
   value-map semantics: the first writing graph owns an entry, another owner
   can neither overwrite nor take it, and reads are owner-scoped exactly as
   writes are.

3. `LLink` gains no persistent field. `hidden` and `label` are accessors
   delegating to the store through the link's registered graph scope. A link
   registered in no scope buffers writes in a pending slot; registration
   flushes that buffer into the store and unregistration moves the entry back
   onto the link, so presentation follows the link object across ownership
   transfers.

4. The wire format is `extra.linkPresentation`
   (`Record<linkId, { hidden?, label? }>`) for schema 0.4, and optional
   `hidden`/`label` fields on serialized link objects for schema 1 and
   subgraph definitions. `extra.linkExtensions` is unchanged. `extra` is wire
   format only: the generated key is removed after configure.

5. A flow that recreates a link rather than transferring the object carries
   presentation across the old-to-new mapping. Where one link becomes several,
   every resulting link receives the presentation. Where several links merge
   into one, the merged link receives presentation only when all sources
   agree; disagreement yields the default rather than an arbitrary winner.
   Removing a link's topology removes its presentation in the same operation.

6. Mutation goes through validated store actions carrying graph scope and
   mutation provenance. Presentation mutation is not expressed as a
   serializable command: no entity store in this codebase dispatches commands,
   and adding an executor for a single store would fork the mutation model.
   Presentation moves onto [ADR 0003](0003-crdt-based-layout-system.md)'s
   command boundary when that boundary is implemented for entity stores.

7. Hover-reveal state and badge geometry are outside this store. Reveal is
   per-owner, reference-counted, and scoped to a root graph; badge rows are
   derived render data recomputed from presentation and layout. Neither
   serializes.

## Consequences

**Positive**

- Renderers, serialization, and UI affordances read one reactive source, and
  the root-graph bucket is the query surface for hidden links.
- The wire format is independent of the store's internal shape, and a workflow
  with no hidden links serializes exactly as it did before the feature.
- A link that loses a registration collision cannot write presentation onto
  the incumbent's id.

**Negative**

- Every link-recreation path must carry presentation explicitly. A path that
  omits it resets presentation to defaults silently rather than failing, so
  each such flow needs its own regression test.
- A visible link's canonical state is the absence of an entry: `hidden` reads
  `false`, and `hidden: false` is never stored or serialized.
- `hidden` and `label` become live accessors on `LLink`, so an extension that
  used those names as inert expando properties would now write durable state.
  A survey of published ComfyUI extensions (2026-08) found no reader or writer
  of either name, and the accessors are non-enumerable prototype members, so
  `JSON.stringify(link)` and `for..in` output are unchanged. The behavioral
  change still warrants a release note.
- The owner index is a second structure to keep consistent with the entry map.
  A missed update does not corrupt presentation, but it can attribute a link
  to a graph that no longer owns it, so every removal path must maintain both.
- Badge geometry and text are recomputed each frame rather than cached, so
  cost grows with the number of hidden links on screen.
