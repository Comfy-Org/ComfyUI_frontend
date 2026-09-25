# ADR-CRDT-STORES-0036: Yjs-Backed Semantic Stores and the Remote Merge Seam

Date: 2026-09-22

## Status

Proposed

<!-- [Proposed | Accepted | Rejected | Deprecated | Superseded by [ADR-IDENTIFIER](IDENTIFIER-title.md)] -->

## Context

[CRDT-FOLLOWER-0025](CRDT-FOLLOWER-0025-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md)
decided _where_ the In-App Agent follower writes: remote Yjs updates merge directly into
yjs-backed frontend domain stores, the canvas re-renders from store state, and litegraph is a
render target rather than the state seam. It left open _how_ the semantic stores become
yjs-backed, and which module owns the seam a remote update enters through.

At the commit this ADR was written against (`main@bdf94b498f`) that end state is not met:

| artifact                                                    | yjs-backed? | role today                                                                                 |
| ----------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| `src/renderer/core/layout/store/layoutStore.ts`             | yes         | owns a private `Y.Doc`; the pattern this ADR extends                                       |
| `src/stores/nodeDataStore.ts`                               | no          | plain `reactive(Map)` buckets per root graph                                               |
| `src/stores/linkStore.ts`                                   | no          | plain reactive buckets plus hand-maintained indexes                                        |
| `src/stores/widgetValueStore.ts`                            | no          | plain refs, dirty tracking via suppression flags                                           |
| `src/workbench/extensions/agent/crdt/followerDoc.ts`        | yes         | retained `Y.Doc` per subscribed workflow, receives host updates                            |
| `src/workbench/extensions/agent/crdt/ecsFollowerAdapter.ts` | reads yjs   | observes the follower doc and _translates_ Y events into `GraphMutations.batch(...)` calls |
| `src/workbench/extensions/agent/crdt/graphMutations.ts`     | no          | imperative writer into the three plain stores and litegraph                                |

`rg -l "from 'yjs'" src/stores` returns nothing. The CRDT therefore stops at `FollowerDoc`;
everything below it is re-derived imperatively by the adapter, so remote/local merge semantics
are whatever the translation happens to do, not what Yjs guarantees. The op stamp that the
program treats as authoritative for ordering is enforced by hand in the adapter's frame context
instead of by the document. This translation boundary is the defect this ADR removes.

```text
 today                                        target

 host update ──► FollowerDoc (Y.Doc)          host update ──► applyRemote(update, ctx)
                     │ observeDeep                                │
                     ▼                                            ▼
             EcsFollowerAdapter                          SemanticDoc (one Y.Doc per root graph)
             diff Y events → intents                     nodes: Y.Map<id, Y.Map>
                     │ mutations.batch(...)              links, definitions, meta, __bookkeeping
                     ▼                                   nodes.<id>.widgets: Y.Map<name, value>
             GraphMutations (imperative)                          │ Y observers (read-only)
                     │                                            ▼
                     ▼                              nodeDataStore / linkStore / widgetValueStore
        plain Pinia stores (no yjs)                 (same public API; state is a projection)
                                                                  │
 layoutStore (Y.Doc) ── separate ──►                layoutStore (Y.Doc) ── still separate ──►
```

## Decision

1. **One semantic `Y.Doc` per root graph, owned by a new `src/stores/semanticDoc.ts`.** Its root
   shares are the multiplayer schema v1 root maps as exported by `@comfyorg/comfy-multi-player`
   (`nodes`, `links`, `definitions`, `meta`, and the `__`-prefixed doc-host bookkeeping maps),
   with each node's widget values in a per-node `widgets` `Y.Map`. The stores project only
   `nodes`, `links` and `definitions`. No pan/zoom, group, reroute or viewport root is ever added
   to this document: layout remains the separate frontend-owned document from
   [CRDT-LAYOUT-0003](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md), and the two
   documents are composed, not merged.

2. **`nodeDataStore`, `linkStore` and `widgetValueStore` become projections of that document.**
   Their public APIs are unchanged. Their reactive state, indexes (`idsByOwner`, link origin and
   target indexes) and `revision` counters are derived from Y observers, not maintained by
   imperative writers. Store-local UI state that is not document state (widget restorations,
   value-change listener registries) stays store-local.

3. **Remote updates enter through `applyRemote(update, { source: 'agent-remote', actor })`.**
   `FollowerDoc.applyRemoteUpdate` forwards to the semantic document; the follower binding no
   longer translates Y events into `GraphMutations.batch`. The follower never writes the shared
   document; raw updates flow host to follower one-way, exactly as
   [CRDT-FOLLOWER-0025](CRDT-FOLLOWER-0025-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md)
   requires. Provenance is carried on the call (as the Yjs transaction origin), never on an ambient
   singleton such as `layoutStore.setSource`.

4. **Local human edits write the same document under a local origin** that carries the existing
   op stamp (`actor`, `opId`). The stamp is not replaced by any store command layer's own IDs; it
   travels as transaction metadata so outbound frames encode the same op identity the host will
   see. There are no shadow copies of semantic state, so there is nothing that could drift from
   the document.

5. **Pure merge, with one documented pivot.** The read path is a CRDT merge and emits no
   synthetic local-authored commands. If the store owners decide that stores may mutate only
   through commands, `applyRemote` instead emits one synthetic, externally-tagged, non-echoing
   command batch per applied update; the seam's call sites and tests do not change, only the
   seam's body. Decisions 1 to 4 are identical under both outcomes.

6. **The end state is enforced by an architecture guard test**,
   `src/workbench/extensions/agent/crdt/semanticStoreArchitecture.guard.test.ts`. It asserts that
   the three semantic stores import `yjs` and that a remote update applied through the follower
   binding never reaches `GraphMutations.batch`. Both assertions ship marked `it.fails` (the vitest
   "known bug" convention already used in this repository) so CI stays green while the slices
   below land; the last slice removes the marker. The guard also asserts today, and keeps
   asserting, that `layoutStore` owns its own Yjs document and that a follower document filled
   from a minted host carries the schema v1 semantic roots and no layout root.

### Delivery

The change lands as a stacked series of small pull requests, each independently reviewable:
this ADR and the guard test; `semanticDoc.ts` with unit tests and no store wired to it; each
store re-based onto the document one at a time (`nodeDataStore`, then `linkStore`, then
`widgetValueStore`); the `applyRemote` seam replacing the adapter translation (guard flips green
and the `it.fails` markers are removed); and finally the human write path carrying the op stamp.
Existing follower tests (`agentCrdtProjection.*.test.ts`, `agentDeleteTabSwitchRace.test.ts`,
`agentSubgraphFollower.test.ts`, `applierConformance.test.ts`, `crossWorkflowPending.test.ts`)
must stay green at every step.

## Consequences

### Positive

- Remote/local merge semantics are Yjs semantics, not adapter behaviour; the op stamp is carried
  by the document rather than re-enforced by hand.
- The three semantic stores share one proven pattern with `layoutStore`, so fixes, schema changes
  and tests protect every store and every product surface at once.
- `ecsFollowerAdapter.ts` and `graphMutations.ts` shrink to litegraph materialisation glue and
  the human write path; the second semantic model (Y-event diff vocabulary) disappears.
- The guard test makes the architecture a checked property of `main`, not a document.

### Negative

- Every write into the three stores becomes a Yjs transaction; hot paths that today mutate a
  reactive `Map` directly pay for transaction bookkeeping and observer fan-out. Measure on the
  widget-value path before removing the compatibility shims.
- Dirty-tracking semantics in `widgetValueStore` move from suppression flags to
  transaction-origin checks; callers in `graphMutations.ts` that rely on
  `withLocalDirtyTrackingSuppressed` need a compatibility shim until they migrate.
- Until the last slice lands, `main` carries two known-failing guard assertions. A contributor who
  makes them pass early must remove the `it.fails` markers in the same change or the guard turns
  red.
- A later split of the semantic document into per-concern subdocs is a real migration (subdocs
  change load, sync and gc semantics and the wire format), not an accessor swap. Keep every read
  behind the `semanticDoc` accessors so moving keys between root maps stays cheap.

## Alternatives Considered

- **Keep the adapter translation and harden it.** Rejected: it keeps a second semantic model and
  keeps Yjs merge semantics out of the stores, which is the defect
  [CRDT-FOLLOWER-0025](CRDT-FOLLOWER-0025-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md)
  already rejected.
- **One `Y.Doc` per store.** Rejected: the doc-host schema v1 is one document with `nodes` and
  `links` root maps; a per-store split would need a translation layer on every frame and would
  break the direct contract test against the host document.
- **Fold layout into the semantic document.** Rejected: layout is local intent and measurement,
  frontend-owned, and must not travel to the host (CRDT-LAYOUT-0003).
- **Replay remote updates as local commands.** Retained only as the documented pivot in
  decision 5; it is not the default because a peer applies remote state by merge, not by
  replaying another actor's commands under its own authorship.

## References

- [CRDT-FOLLOWER-0025](CRDT-FOLLOWER-0025-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md):
  follower state seam and distribution boundaries (parent decision).
- [CRDT-LAYOUT-0003](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md): layout stays a
  separate frontend-owned document.
- [GRAPH-DOCUMENT-0024](GRAPH-DOCUMENT-0024-graph-activation-and-document-objects-for-in-app-agent-targets.md): graph document identity
  the per-root-graph document is keyed by.
- [ECS-0008](ECS-0008-entity-component-system.md), [ECS-WIDGETS-0023](ECS-WIDGETS-0023-widget-entities-with-a-legacy-layer.md),
  [ECS-SLOTS-0017](ECS-SLOTS-0017-slot-records-as-the-source-of-truth.md): the store migration whose targets this ADR
  makes yjs-backed.
- `src/renderer/core/layout/store/layoutStore.ts`: the reference implementation of a yjs-backed
  store, including the `TypedYMap` helper the semantic document reuses.
- `@comfyorg/comfy-multi-player`: the single shared applier and the schema v1 root maps
  (`nodesMap`, `linksMap`).
