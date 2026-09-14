# ADR-021: Doc-derived Lamport clock store (`__stamps` reseed) - Option A locked

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
document's `__stamps` on every transaction:

```text
caller Y.Doc / __stamps -> max observed counter -> producer tick -> op stamp
          (no package-owned counter or database)
```

The store validates every ledger entry and fails closed on malformed counters. Calls submitted
through any store wrapping the same `Y.Doc` are serialized by a document-scoped queue. After a
successful callback and counter validation, the store writes a reserved clock row to `__stamps`
before returning; this makes the advanced floor
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
  its counter in `__stamps` even before the semantic operation is applied; an unapplied operation
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
