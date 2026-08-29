# 24. Link Presentation Store Owns Hidden/Label State

Date: 2026-08-29

## Status

Proposed

## Context

The hideable-links feature adds durable, per-link presentation state: whether a
link's curve is replaced by endpoint badges (`hidden`) and a custom badge text
(`label`). This state must survive save/load, undo snapshots, and subgraph
`definitions`, and it must ride the workflow JSON so it round-trips through
released clients unchanged.

[ADR 0008](0008-entity-component-system.md) requires new cross-cutting entity
state to be plain component data in a dedicated graph-scoped store rather than
instance state on entity classes, and `LLink` is already a compatibility shell
over the link topology store. Several homes were considered and rejected:

- **Fields on `LLink`** (the original PR #15167 shape): creates a second
  authority beside the store-backed shell and was blocked in review.
- **Widening `extra.linkExtensions`**: released clients validate those entries
  with a required `parentId`; one hidden, non-rerouted link would make the
  whole workflow fail schema validation there.
- **The CRDT layout store**: presentation must serialize into the workflow
  document itself, not the layout document, and reveal/badge geometry is
  transient render state that the migration plan explicitly excludes from
  stores.

## Decision

1. A dedicated Pinia store, `linkPresentationStore`, is the single runtime
   authority for `hidden`/`label`. It is partitioned by root graph, keyed by
   `LinkId`, and every entry records its owning graph. Entries exist only for
   links with non-default presentation, so the store's contents are exactly
   the serialization set.
2. Ownership follows [ADR 0016](0016-entity-registration-collision-and-recovery-boundaries.md)
   semantics for a value map: the first-writing graph owns an entry, a
   different owner cannot overwrite or take it, and reads are owner-scoped the
   same way writes are.
3. `LLink` gains no persistent fields. `hidden`/`label` are delegating
   accessors through the link's registered graph scope. A detached link
   buffers writes in a pending slot: registration flushes the buffer into the
   store, and unregistration stashes the store entry back onto the link, so
   presentation follows the link object across ownership transfers.
4. The wire format is `extra.linkPresentation`
   (`Record<linkId, { hidden?, label? }>`) for the 0.4 schema and optional
   `hidden`/`label` on serialized link objects for schema 1 and subgraph
   definitions. `extra.linkExtensions` is untouched byte-for-byte. `extra` is
   wire format only; the generated key is deleted after configure.
5. Flows that recreate links instead of transferring them (clipboard paste,
   endpoint moves, subgraph convert/unpack, workflow insertion, duplicate-link
   normalization) must carry presentation across the old→new link mapping via
   `transferLinkPresentation`. Fan-out merges move presentation onto a merged
   boundary link only when every grouped link agrees. (The transfer wiring and
   its regression tests land in the transfer slice of this stack.)
6. Mutations are validated store actions; the first-party mutation helpers
   that arrive with the canvas slice bracket them with the existing
   before/after-change lifecycle. Wrapping them in a serializable
   `setLinkPresentation` command is deferred until a command executor exists
   (per the ECS migration plan, commands are outside the current phase).

## Consequences

**Positive**

- One authority: renderers, serialization, and Vue affordances read the same
  reactive records; the store bucket doubles as the hidden-link render index.
- The wire format survives unrelated store refactors, and zero-hidden
  workflows serialize byte-identically to before the feature.
- Registration collision losers cannot plant presentation over an incumbent's
  link id.

**Negative**

- Every future link-recreation path must remember the transfer helper; a
  missed path silently resets presentation to defaults. Regression tests in
  the transfer slice pin the known flows.
- A visible link's canonical state is _no entry_ (`hidden` reads `false`, and
  `hidden: false` is never stored or serialized).
- `hidden`/`label` become live prototype accessors on `LLink`: an extension
  that previously used those names as inert expando properties now mutates
  core presentation state. Ecosystem usage has not been verified; this needs a
  release note.

## Additional Notes

Transient reveal state (hover-to-reveal) and badge frame geometry are
deliberately not part of this store: they are per-owner reference-counted
module state and per-canvas derived render data, matching the migration plan's
non-goal of persisting derived badge rows.
