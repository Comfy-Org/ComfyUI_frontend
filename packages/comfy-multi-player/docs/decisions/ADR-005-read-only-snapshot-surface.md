# ADR-005: Reads get a snapshot surface, not the document handles back

**Status:** Accepted
**Date:** 2026-08-20
**Invariant:** KA-1, KA-2, KA-4, KA-6, KA-12, FC-5 (and KA-3 — the surface is pure)
**Supersedes in part:** ADR-004 §Context, third bullet

## Context

Issue #18 stopped the entrypoint wholesale re-exporting `src/doc.ts`. ADR-004's
`nodesMap`, `linksMap`, and `OPAQUE_WIDGETS_KEY` remain public for follower
compatibility. The vulnerability
was reachability, not intent: the same import that hands a caller `nodesMap` for
a read hands back a live `Y.Map`, and a `.set()` on it is an unstamped write —
invisible to the `[base_version, actor, op_id]` ordering (KA-2), to the LWW
tiebreak, and to the `__applied` dedupe ledger (KA-4). The replica diverges from
every other replica with no diagnostic (KA-1, FC-5). The old guarantee — "a
follower never writes the shared doc" — was defended only by consumer intent.

That change breaks four real call sites in two shipped consumers, and **all four
are reads**:

| Call site | Reads | Why `project()` does not serve it |
|---|---|---|
| cloud `services/agent/dochost/src/server.ts` `requirePin()` | `meta.catalog_version` | It is the KA-12 guard that decides whether projecting under the request's catalog is safe at all — it must run *before* `project()`. |
| cloud `server.ts` `detectIDCollision()` | `nodes.has(id)`, `__applied.has(op_id)` | Two `has()` probes per op on the pre-apply path; projecting the whole document per op is the wrong shape and needs a catalog it may not trust yet. There is no projection of `__applied`. |
| cloud `scripts/introspect-state.mjs` | `__applied` keys, `__stamps`, `meta` | The cross-language conformance harness compares the bookkeeping ledgers. No projection contains them. |
| frontend `crdt/docSchema.ts` `readDocSnapshot()` | `nodes`, `links`, `__widgets_opaque` | The follower holds no catalog for the document it renders, so it cannot call `project()` — and ADR-004 records that it deliberately does not. |

The op layer is for writes. "Migrate the consumers to ops" is not available for
any of these.

## Decision

Add a narrow **read-only snapshot surface** (`src/read.ts`), exported from the
entrypoint: `readGraph`, `readMeta`, `docCatalogPin`, `hasNode`,
`hasAppliedOp`, `appliedOpIds`, `readStamps`, and the `OPAQUE_WIDGETS_KEY`
constant. Every entry maps to a demonstrated call site above; nothing was added
for symmetry.

The surface is enforced, not conventional. Four mechanical properties, each
proved by attempting the violation in `test/readonly-surface.test.ts`:

1. **No live handle escapes.** Nothing reachable from a return value is a
   `Y.AbstractType`, at any depth. Values are primitives or plain
   objects/arrays this module constructed.
2. **Copy, not view.** `Y.Map#get` and `#toJSON` return the *same object
   reference* stored inside the Yjs item for a plain value. Returning it would
   let `snapshot.nodes["7"].pos[0] = 9` edit the document in place — an
   unstamped write through a read API. The test demonstrates that hazard on the
   internal accessor before showing the snapshot does not carry it.
3. **Deep-frozen.** Every constructed object and array is `Object.freeze`d, so
   under ES-module strict mode a write attempt throws `TypeError` rather than
   silently no-oping.
4. **A read is not a write.** `Y.Doc#getMap(name)` *creates* the root it names.
   A follower's document between construction and its first frame has no roots
   at all, so every accessor gates on `doc.share.has(name)` and a full pass of
   the surface leaves both `doc.share` and `encodeStateAsUpdate` untouched.

`test/public-api.regression.test.ts` keeps deriving the forbidden set from
`src/doc.ts` at runtime, with ADR-004's exact three-entry follower allowlist
plus the KA-1 `encodingLosses` diagnostic retained by main.
`test/readonly-surface.test.ts`
additionally fails on any entrypoint export it has not been told how to
classify, so a future export cannot widen the surface unreviewed.

## Alternatives rejected

- **A `./doc` subpath export.** One line, no consumer logic changes — and it
  restores `mset`/`mdel`/`initDoc`/`createNodeMap` reachability behind a longer
  specifier, which is exactly what #18 exists to remove.
  `.agents/checks/api-contract.md` already classifies it as a blocking finding.
- **Using the retained raw accessors for new consumers.** ADR-004 keeps these
  public for compatibility, but property 2 above shows why they are not the
  preferred surface: even a caller who only reads gets a mutable reference into
  the document's own storage.
- **`ReadonlyMap` / `Readonly<>` views over live types.** Type-level only.
  `readonly` is erased at runtime and a `Map` ignores `Object.freeze`, so this
  is intent again, in a costume.
- **A faithful full-node copy.** Symmetric and future-proof, but it copies
  `inputs`, `outputs`, `flags`, `properties`, `size`, … that no consumer reads,
  at roughly twice the per-frame cost of the field subset (`scripts/bench-read.mjs`),
  and every extra field is surface a consumer can come to depend on. `project()`
  remains the full-fidelity read for a caller that has the catalog.
- **Exposing subgraph definitions.** No consumer reads them today. An unread
  export is future reachability.

## Consequences

- The pin bump is unblocked: the FE follower and the cloud doc-host can both
  move past #18 without hand-mirroring schema v1 in raw `yjs`, which is what
  ADR-004 closed. The migration is import-level; see the PR body for the exact
  before/after per call site.
- `readGraph` costs about **2x** a raw live-handle read of the same four fields
  — measured at +0.06 ms per frame at 200 nodes and +0.32 ms at 1000 nodes on
  Node 25 (`node scripts/bench-read.mjs <nodes>`), against a 16.6 ms frame
  budget. Reads on the doc-host guard path (`docCatalogPin`, `hasNode`,
  `hasAppliedOp`) are O(1) and allocation-free, so that path pays nothing.
- `readGraph` returns a fixed subset of node fields. A consumer that needs
  another field needs a one-line package change and a pin bump. That friction is
  deliberate: it keeps each widening reviewable.
- `initDoc` stays private. The one consumer that used it to *construct* a
  document (an FE integration test) constructs with `mint()` instead —
  construction is a write, and `mint()` is the sanctioned one (KA-10: replicas
  fork from one seeded snapshot, they never re-seed).
- The snapshot walk has a depth ceiling (64) and throws `RangeError` past it,
  so a corrupt or hostile document is a loud bounded failure rather than a hung
  render loop.
