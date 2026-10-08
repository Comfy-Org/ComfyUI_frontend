# ADR-021: Doc-derived Lamport clock store (winning stamps + reservations) - Option A locked

- **Status:** Accepted
- **Date:** 2026-08-29
- **Decider:** Christian (in-thread ruling, approximately 12:20Z)
- **Supersedes:** narrows ADR-020 to a concrete mechanism; complements ADR-0004 and ADR-0005

## Context

The package's Lamport helpers must remain pure and portable. A producer may need a counter floor
after restart, but putting a durable producer counter in the shared package would create hidden
state and violate the stateless doc-host boundary. The document already persists winning stamp
keys in `__stamps` as `[counter, actor, op_id]`; DQ-11 qualifies the target key by node
incarnation, so every entry belongs to the document lineage while retaining its target lifetime.

## Decision

`DocDerivedLamportClockStore` derives the producer's floor by scanning the caller-supplied
document's `__stamps` and `__clock_reservations` on every transaction (CLK-3):

```text
caller Y.Doc / {__stamps, __clock_reservations} -> max observed counter -> producer tick -> op stamp
          (no package-owned counter or database)
```

The store validates every ledger entry and fails closed on malformed counters. Calls submitted
through any store wrapping the same `Y.Doc` are serialized by a document-scoped queue. After a
successful callback and counter validation, the store writes a reserved clock row to `__stamps`
before returning in the original implementation; CLK-3 moves that write to
`__clock_reservations`. This makes the advanced floor
visible to the next transaction and durable in a Yjs snapshot. The row is not a semantic graph
operation. A caller that has not observed any authoritative stamp may require
a seed with `persistLamportTick(..., { requireSeed: true })`.

## Acceptance gate

The clock matrix replays identical semantic streams under three test schemes: the historical
`base_version` plus actor fallback, doc-derived Lamport ordering, and a test-only vector-clock
reference. It records application order, canonical projected-state hash, and divergence class for
each named product scenario and each generated seed. A divergent final graph fails the test unless
an explicit allowlist entry carries a written justification. The vector implementation is test-only
and is not exported or used by the applier.

## Consequences

- Restart/reconnect can reseed from committed document state without package-owned persistence.
- DQ-11 remains load-bearing: old-incarnation stamps cannot compete with a new-incarnation write.
- Calls wrapping the same document share a counter sequence even across separate store instances.
  A successful tick reserves
  its counter in `__clock_reservations` even before the semantic operation is applied; an unapplied operation
  remains a caller recovery concern.
- Cross-document monotonicity is not promised. The floor is scoped to one document lineage.
- Vector clocks remain available as a comparison oracle if product policy later needs explicit
  concurrency detection.

## Invariants

This decision preserves the shared-package invariants in `docs/INVARIANTS.md`: semantic ops remain
the replication unit (KA-1), ordering identity remains inside the op (KA-2), the applier remains
portable and yjs-only (KA-3), application is deterministic/idempotent (KA-4), and the package owns
no caller-independent merge or durable state (KA-13).

## Glossary

- **Lamport counter:** a logical number advanced beyond observed causal events.
- **`__stamps`:** the document's internal winning-stamp ledger, not part of projected workflow JSON.
- **`__clock_reservations`:** caller-document producer reservations, separate from semantic write targets.
- **Lineage:** one document history; an explicit reset starts a new lineage.
- **Incarnation:** one lifetime of a node identity between create and delete/re-add.
- **DQ-11:** the decision to namespace node-scoped stamps by incarnation.
- **Vector clock:** a test reference mapping each actor to its observed counter, able to distinguish
  ordered pairs from true concurrency.
- **KA-13:** the package statelessness invariant guarded by `check:stateless`, registered in
  [`docs/INVARIANTS.md`](../INVARIANTS.md).

## Amendment: CLK-1 transaction serialization and commit

The adversarial CLK-1 finding was fixed in comfy-multi-player commit
[`0ecab83f`](https://github.com/Comfy-Org/comfy-multi-player/commit/0ecab83feb2ffa6006d56e58e95207b6f5074056).
The regression test exercises two concurrent `persistLamportTick` admissions through one
`DocDerivedLamportClockStore`, verifies counters `1` and `2`, checks the two committed reservation
rows and document floor, and verifies the next admission receives `3`. The shipped guarantee is
limited to the document-scoped admission boundary.

## Amendment: CLK-2 document-scoped serialization

The serialization boundary is keyed by `Y.Doc` identity in a module-level `WeakMap`, so separately
constructed stores cannot bypass admission ordering for the same document. The two-instance
regression test concurrently admits one tick through each store and verifies counters `1` and `2`,
two reservation rows, and document floor `2`. Different documents remain independent. KA-13's
static gate permits only the named `documentTransactionTails` weak registry; all other module-level
mutable collections remain rejected. Weak keys keep the queue scoped to caller-owned document
identity and do not create durable or cross-document package state.

## Amendment: CLK-3 separate reservation storage (2026-09-18, schema v4)

**Original finding:** coderabbitai[bot], **2026-09-04T18:54:52Z**,
[frontend PR #16644 review](https://github.com/Comfy-Org/ComfyUI_frontend/pull/16644#pullrequestreview-5116820123).
`commitCounter()` polluted the `ROOT_STAMPS` map exposed by `readStamps()` with
non-write-target reservations. The original author, date and source are retained
here; CLK-1/CLK-2 QA describes the prior implementation, not approval of CLK-3.

Store the unchanged key `JSON.stringify(["__lamport_clock", workflow_id, lineage_id, producer_id])`
and unchanged `[counter, producer_id, key]` tuple in a dedicated caller-document
`__clock_reservations` map. A successful admission creates it lazily. Scan both
ledgers before invoking the callback, validating exact tuples, counters and
reservation identities. Type roots arriving from a snapshot without adding
structs, and reject wrong root types or sequence content instead of overlooking
their counters. Failed callbacks, invalid results, unseeded refusals and overflow
consume no reservation and do not poison the document queue.

**KA-11 requires v4:** a v3 reader scans only `__stamps` and can reuse a reserved
counter if the new root is introduced silently. Clock reads/admissions require
the current schema, including on an empty document. v1–v3 and unknown layouts
are refused without mutation; private alpha re-mints source workflows into a
new lineage rather than migrating old reservation rows. Hosts must settle old
pending queues at cutover. Schema A20 and the wire-layout vector specify this
layout; FE sign-off and coordinated consumer rollout are still required.

`test/clock.test.ts` checks public stamp isolation, the unchanged reservation
tuple, restart via a fresh module and snapshot, winning-stamp/reservation maxima,
multiple wrappers, and byte-identical rejection plus retry. These are bounded
contract cases, not a claim of exhaustive concurrency or cross-process admission
serialization. The CLK-2 weak registry and KA-13 state-ownership rule remain
unchanged; KA-1/KA-2 semantic op identity and KA-3/FC-3 portability are preserved.
