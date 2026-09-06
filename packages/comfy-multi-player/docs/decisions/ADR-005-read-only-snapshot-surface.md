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
5. **It is not a way around the KA-11 read gate.** `project()` refuses a
   document whose `meta.schema_version` this package cannot read (#38). This
   surface reads the same layout by the same key names, so without a gate a
   consumer could call `readGraph` instead of `project` and get exactly the
   mis-keyed v1-names-over-a-v2-document read KA-11 forbids. Every accessor
   therefore refuses — same `SchemaVersionError`, same message shape — **when
   the document carries content under a schema this package cannot read**, and
   returns its empty value **when the document carries nothing**. The second
   clause is not a softening: ADR-004's follower reads a document that has no
   roots at all before its first frame, there is no content there to mis-key,
   and the surface already reads it as empty on `main` with two tests pinning
   that. (`migrate()` *does* refuse that document — #30 — but that is a role
   split: migrating a document that says nothing about its own version is an
   incoherent WRITE request, while reading nothing out of it is not.)
   **This is the one place the disposition differs from `project()`'s**, and
   Amendment A5's consumer-impact note recorded the opposite disposition as a
   defect — a doc-host request whose snapshot folds to a root-less document
   moved from HTTP 200 with an empty graph to HTTP 400. The two paths share a
   PREDICATE and differ in what they do about one document class. Amendment
   A12 carries the normative version.
   The content question is deliberately **not** asked by enumerating the §1
   root names: those are v1's names, and §10/KA-11 make renaming them the
   canonical reason to bump `SCHEMA_VERSION`, so a name-keyed probe is blind to
   exactly the document the gate exists to refuse. It reads the struct store,
   which is vocabulary-free. A12 states this as a constraint on any second
   implementation. The comparison itself is not re-implemented; it delegates
   to `schema-version.ts`, so this surface, `project()` and `migrate()` share
   one definition of "readable".

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
- `readGraph` costs about **2x** a raw live-handle read of the same four
  fields. Re-measured on Node 25 at this commit over three runs each
  (`node scripts/bench-read.mjs <nodes>`): **1.90-2.24x, +0.055 to +0.066 ms
  per frame at 200 nodes**, and **1.91-1.97x, +0.285 to +0.300 ms at 1000
  nodes**, against a 16.6 ms frame budget — so ~0.4% of the budget at 200
  nodes. The rejected full-node copy measures **3.85-4.74x**, about twice
  `readGraph` again, in the same runs. (An earlier figure of +0.32 ms at 1000
  nodes is withdrawn: it does not reproduce at this base across eight runs
  spanning load average 1.8 to 8.1, and +0.29 is the median here.)
- The schema gate is free on `readGraph` — 0.1195 ms/call without it against
  0.1219 with it at 200 nodes, inside run-to-run spread. On the doc-host's
  per-op probes (`docCatalogPin`, `hasNode`, `hasAppliedOp`) it is not free but
  it is nanoseconds: 0.029-0.063 µs/call before the gate, 0.037-0.078 µs after
  — about 1.4x — and still O(1) in the document, because the content question
  is answered against the struct store (O(clients), and there are one or two)
  rather than by walking roots.
  **The cost is a reason the vocabulary-free probe is also the cheap one**, and
  that was not obvious in advance. The intermediate implementation asked each
  named root for a live key, which is O(1) only if you avoid `Y.Map#size` —
  `size` filters tombstones across the whole entry map, and keying on it cost
  3.15 µs/call at 200 nodes and grew with the document, on a path whose point
  is being O(1). Reading the struct store has no such cliff and needs no
  short-circuit in front of it (one was tried and measured at 0.046 vs 0.047
  µs/call — noise — so it was deleted rather than shipped as a line no test
  could hold).
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
- The read gate narrows this surface relative to a version of it without one: a
  document carrying content under an unreadable schema now throws from every
  accessor instead of returning mis-keyed data. **No PRODUCER is affected.**
  `mint()` writes `schema_version` as the first write of its single transaction
  and is the only document constructor in the system: the Go agent service
  never builds a document (it holds doc bytes opaquely and mints over HTTP),
  the frontend follower never writes `meta` at all, and comfy-cli — the
  normative op-vocabulary source — has no CRDT dependency and produces ops, not
  documents. A host that wants a structured error rather than a throw
  should **catch `SchemaVersionError`**, which is exact. `readSchemaVersion`
  alone is *stricter* than the gate — it is `undefined` for the pre-first-frame
  document too — so a host pre-checking on it refuses the document the empty
  clause exists to allow. Worth revisiting if a consumer ever needs to ask the
  gate's question without calling it: `carriesContent` is module-private
  today, deliberately, because an unread export is future reachability.
- **A producer survey is not the whole question, and one reachable state does
  hit the refusing clause.** The doc-host sidecar is stateless — a fresh
  `Y.Doc` and so a fresh clientID per request — and the deltas it returns are
  authored by that per-request client. The relay deliberately joins the fanout
  BEFORE it sends a new subscriber its catch-up, so a follower can integrate a
  delta whose structs have no missing predecessors *before* it has any `meta`:
  roots with content, no schema claim, and this gate refuses it. Refusing is
  the intended answer — it is the KA-11 posture, and the frontend's own
  `schemaGuard` already refuses that state today, more strictly than this gate
  does (it has no empty-document escape at all). What the empty-document clause
  covers is "no frame has arrived yet", not "a frame arrived out of order".
- **`readGraph` can throw where `nodesMap` could not**, so ADR-004's
  description of it as a migration target for the frontend follower now comes
  with that caveat; see the migration note below.
- **Migration note for the consumer that adopts this surface.** The frontend
  runs its schema guard at the bridge seam and that seam rethrows anything that
  is not its own error type. A consumer swapping a hand-rolled read for
  `readGraph` must keep an equivalent guard, or catch `SchemaVersionError` at
  the same seam — otherwise a typed, handled schema event becomes an unhandled
  throw on the render path.
