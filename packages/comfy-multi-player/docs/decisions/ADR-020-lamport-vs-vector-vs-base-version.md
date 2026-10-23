# ADR-020: Lamport vs vector clocks vs `base_version` for graph ordering

**Status:** Proposed (Christian rules; pending shadow-comparison verification)
**Date:** 2026-08-29
**Decider:** Christian Byrne
**Verification owner:** shadow-comparison lane

> **Mirror note (superseded in part):** [ADR-021](ADR-021-doc-derived-lamport-clock-store.md)
> (accepted) supersedes and narrows this ADR to a concrete doc-derived Lamport clock store.
> The `Proposed` status and shadow-comparison verification gate below are preserved as the
> historical decision record; the current decision state is ADR-021 together with the
> portability constraints (KA-2) and foreclose rules (FC-2, FC-9) it operates under.

## Context

The In-App Agent graph is an op-based CRDT. A semantic operation carries its identity and
ordering metadata; the shared applier uses that metadata for deterministic, idempotent
last-writer-wins (LWW) decisions. The current scalar model uses `base_version`, the document
revision observed when a producer minted the operation, with `actor` and immutable `op_id` as
deterministic tie-breakers. This converges, but the scalar does not faithfully represent all
causal relationships across reconnects and independently edited branches.

The decision is not whether the package should grow a second applier. There is one pure,
portable `@comfyorg/comfy-multi-player` applier. At pinned cmp commit
[`8636af3e`](https://github.com/Comfy-Org/comfy-multi-player/tree/8636af3e42e1f81d942bd861aa604f770de73769),
`clock.ts` contains pure Lamport helpers and a `LamportClockStore` interface; state is supplied by
the caller. cmp ADR-0005 settles the package shape: Lamport is the smallest creator-owned clock,
the total key is `[counter, actor, op_id]`, there is no concurrency detection, and there is no
schema-v3 or compatibility reader. This ADR is the program-level ordering and rollback decision;
it must not contradict or replace that package decision.

The practical causal example is an agent adding node A, followed by a human who sees A and
connects B to A. A creator-owned Lamport counter can guarantee that the connect carries a later
ordering value than the observed add, without waiting for a shared revision to advance. Two
`base_version` producers can instead carry the same revision N and fall through to actor order,
which may put the dependent edit before its producer edit. Lamport therefore preserves observed
before relationships, but it gives up the direct stale-base signal that `base_version` provides.

The alternatives have different state and future-topology costs:

- A `base_version` producer is stateless relative to the shared revision. That is valuable while a
  central doc host serializes admission, but the scalar is a weak causal model for offline or
  independently edited branches.
- Lamport makes the producer *caller* stateful: it needs a durable counter, seed/bootstrap, and
  restart recovery. With a central doc host, the counter can be doc-derived by observing
  `__stamps` (`[counter, actor]`) on reconnect and refusing to mint until seeded when required.
  That leaves the sidecar itself stateless modulo the document. The residual risk is an operation
  that was minted but not durably applied when a producer reconnects.
- A vector clock adds true concurrency detection. It can distinguish a collision from an
  intentional overwrite and support concurrency-specific policy, but every producer carries a
  per-participant map and the system must define participant identity, pruning, lineage, and
  persistence rules. “Causal state” is the long-term concept; vector clocks are one possible
  later mechanism, not a commitment made here.

Rollback means returning the ordering comparator to `base_version` while the feature remains
private alpha. It requires no data migration or compatibility surface, but semantic safety must
be demonstrated rather than assumed.

### Where causal state lives

```text
base_version
  producer ── reads shared revision N ──> op.base_version
       (no local causal state)             │
                                            ▼
                                      central doc host

Lamport-as-merged
  producer caller ── durable counter / doc-derived seed ──> [counter, actor, op_id]
       package stays pure                                  │
                                                            ▼
                                      doc host + __stamps / lineage

vector clock
  producer caller ── durable {actor: counter} context ──> op causal context
       per-participant state                                │
                                                            ▼
                                      every future peer merges the context
```

The topology guard remains unchanged: semantic ops are the replication unit; the ordering key
travels inside each op; the applier is portable, deterministic, and idempotent; raw Yjs updates
flow host to follower only; layout and awareness remain outside the semantic document; and an
ordinary gap or reconnect uses state-vector replay on the same follower `Y.Doc`. A server-assigned
sequence may coordinate persistence, but it is not the permanent conflict key.

## Decision

The proposal is to use **Lamport-as-merged for V1**, conditional on the shadow-comparison gate
below, while retaining the cmp ADR-0005 package contract. The Lamport numeric component remains
the creator-owned counter in the existing tuple `[counter, actor, op_id]`; `op_id` is minted once
by the creator and never regenerated. DQ-11 incarnation-qualified target keys remain required:
Lamport ordering chooses a winner *within* the correct incarnation namespace; it does not replace
incarnation semantics.

No vector clock is adopted for V1. It becomes the next candidate only if a verified product
requirement needs to distinguish concurrency from intentional overwrite or needs a
concurrency-specific conflict policy. No mixed scalar/Lamport representation is permitted, and
the package remains stateless: the doc host or cloud agent producer owns the `LamportClockStore`
boundary. Reconnect recovery must observe the authoritative document floor before minting after
producer-state loss; a mid-flight unapplied operation remains an explicit residual risk for the
vertical slice.

### Decision matrix

| Option | Dependent-edit correctness | Producer state | Doc-host coupling | Rollback cost | Path to distributed/offline peers |
| --- | --- | --- | --- | --- | --- |
| `base_version` | Converges and directly exposes the minting revision, but causally dependent ops can share N and actor fallback can order them contrary to observed intent. | Stateless off the shared revision. | Best fit for a central host; producers only need the shared revision. | Lowest: current comparator and no migration. | Weak: scalar metadata loses long offline causal detail and leaves arbitrary concurrent fallback. |
| Lamport-as-merged | Preserves seen-before relationships when a producer observes and advances its counter; does not detect concurrency. | Caller owns durable counter, bootstrap, restart recovery, and fail-closed reseeding. Doc-derived `__stamps` can keep the sidecar stateless modulo the document. | Moderate: host must expose authoritative floor/seed and protect the persist-before-dispatch boundary, but the applier remains host-independent. | Low in private alpha: no migration or compatibility reader; comparator rollback still requires the three checks below and handling of unapplied ops. | Strong: creator-owned ordering survives reconnect and does not make the server the permanent allocator. |
| Vector clock | Detects true concurrency and can support collision-versus-intentional-overwrite policy, but needs a causal context for every relevant participant. | Per-participant durable map plus participant lifecycle, pruning, lineage, and restart rules. | Highest: host and every peer must preserve and merge causal contexts. | Highest: comparator, schema, storage, and policy migration; not justified by a current V1 oracle. | Strongest for explicit causal/concurrent policy, at the cost of metadata and operational complexity. |
| **RECOMMENDED: Lamport-as-merged, conditional** | **Use creator-owned ordering for observed dependencies; retain DQ-11 namespaces; prove rollback equivalence with shadow comparison before broad rollout.** | **State in the caller, not cmp; seed from the document on reconnect and refuse unsafe unseeded minting.** | **Central-host compatible without making the host the permanent order allocator.** | **Private-alpha rollback is reversible without migration, subject to the open checks.** | **Leaves a clean upgrade path to richer causal state if concurrency policy becomes a product need.** |

### Rollback-safety checks

These are explicit open verification items, owned by the **shadow-comparison lane**:

1. **Shared base check:** can two causally dependent operations ever share a `base_version` in
   real producer, reconnect, and doc-host paths?
2. **Fallback-order check:** if they can, can actor/op-id fallback produce an invalid application
   order for any supported graph operation or dependency?
3. **Applier-recovery check:** if it can, does the semantic applier independently recover through
   buffering or topological reference ordering, yielding the intended final graph?

If every real path collapses to the same final state, Lamport is distributed metadata rather than
a semantic behavior change and rollback to `base_version` is safe. A final-document divergence is
a blocking failure. An application-order divergence must also be flagged: it may be harmless when
the final projection is equivalent, but it requires review for side effects, observability, or
future operations that depend on intermediate state.

### Shadow-comparison validation

The validation instrument computes both orderings over the same semantic op streams without
changing production behavior:

1. Extend the `crdt-case/harness/merge-semantics.mjs` families with captured and generated streams
   for dependent producer edits, equal bases, reconnect/restart, duplicate delivery, actor ties,
   DQ-11 incarnation boundaries, and stale branches.
2. For each stream, run both the Lamport comparator and the `base_version` comparator against the
   same op set and both arrival orders. Record the per-op application order, accepted/no-op
   outcomes, projected graph, and relevant stamp/idempotency ledgers. Flag either an order
   divergence or final-document divergence; do not silently normalize one result to the other.
3. Replay the same semantic streams through the real doc-host harness, including durable restart,
   document-floor reseeding, and the mid-flight-unapplied-op reconnect case. This checks the caller
   state boundary as well as the shared applier.
4. Publish a deterministic seed, exact package/doc-host SHAs, stream fixture, and result for every
   divergence. Zero divergence, or only reviewed order differences with equivalent final state,
   is strong rollback-safety evidence; it is not a claim that Lamport detects concurrency.

The comparison is observational only: it does not dual-write, does not exchange raw Yjs structs
between independently edited documents, does not regenerate `op_id`, and does not put the
optimistic overlay into the shared document.

**DEFAULT-IF-NO-ANSWER:** keep the Lamport candidate private-alpha and on hold for broad rollout;
do not migrate to vector clocks or advertise rollback safety until the shadow-comparison checks
are complete. Existing scalar behavior remains the fallback at already-shipped boundaries.

**Deadline:** 2026-09-02.

## Consequences

**Positive:** V1 preserves observed causal ordering for dependent edits; producer counters remain
creator-owned rather than server-assigned; reconnect/restart can be monotonic; cmp stays pure and
portable; and a future distributed topology can reuse the same tuple and op identity model. The
private-alpha boundary makes a comparator rollback reversible without a migration.

**Negative:** the Lamport caller must persist and recover causal state, seed from authoritative
lineage state, and fail closed after state loss. Lamport cannot distinguish concurrency, and it
does not retain the direct stale-base information of `base_version`. A producer reconnect with an
unapplied operation is a residual correctness risk. Vector clocks remain a later, more expensive
choice if product semantics require concurrency-specific decisions.

**Operational:** DQ-11 remains a prerequisite, because ordering metadata cannot repair a stale
cross-incarnation register. The first implementation proof must cross producer admission, the
shared Node applier, durable restart, and follower state-vector replay before implementation
widens. Any rollout must preserve the host-is-writer and semantic-op replication invariants.

## Alternatives Considered

- **Keep `base_version` as the V1 ordering key.** It is stateless and cheap to operate with a
  central host, and it keeps direct stale-base information. It is rejected as the recommendation
  because it can collapse dependent edits onto one revision and let actor fallback violate
  observed intent; it remains the rollback baseline.
- **Adopt Lamport without the shadow gate.** It is rejected because the package feasibility result
  is conditional on DQ-11 and does not by itself prove cloud admission, durable caller state,
  or rollback equivalence. Lamport is the recommendation only with those boundaries explicit.
- **Adopt vector clocks for V1.** They provide the strongest concurrency information, but no
  current V1 product oracle requires it. Per-participant metadata, pruning, lineage, and migration
  costs are disproportionate while the primary need is preserving observed-before order.
- **Use HLC or another physical-time hybrid.** It adds wall-clock skew and rollback rules without
  supplying concurrency detection; it is not a better answer to the current causal-ordering need.

## References

- Workspace [ADR-007: Op-based CRDT for in-app-agent graph state](https://github.com/christian-byrne/in-app-agent-program/blob/main/decisions/ADR-007-op-based-crdt-v1.md)
  (workspace repo, `decisions/ADR-007-op-based-crdt-v1.md` — not mirrored here), especially its
  portability, semantic-op, and logical-clock constraints.
- [`comfy-multi-player` ADR-0005 at `8636af3e`](https://github.com/Comfy-Org/comfy-multi-player/blob/8636af3e42e1f81d942bd861aa604f770de73769/docs/adr/0005-lamport-ordering-v1-migration.md),
  the package-level Lamport decision this ADR preserves.
- [DQ-10 Lamport feasibility evidence](https://github.com/christian-byrne/in-app-agent-program/blob/main/reports/spikes/dq10-lamport-feasibility.md)
  (workspace repo), including the DQ-11 conditional result and persistence-loss boundary.
- [Lamport, “Time, Clocks, and the Ordering of Events in a Distributed System”](https://lamport.azurewebsites.net/pubs/time-clocks.pdf),
  the primary logical-clock reference.
- [Fidge, “Timestamps in Message-Passing Systems That Preserve the Partial Ordering”](https://fileadmin.cs.lth.se/cs/Personal/Amr_Ergawy/dist-algos-papers/4.pdf),
  the primary vector-clock reference.
- [AGENTS.md CRDT invariants](https://github.com/christian-byrne/in-app-agent-program/blob/main/AGENTS.md)
  (workspace repo), the keep-alive and foreclose constraints for portability, op identity,
  host/follower direction, and replay.

## Glossary

- **Lamport stamp:** A creator-owned logical ordering value that advances beyond observed values;
  here the numeric component of `[counter, actor, op_id]`.
- **Vector clock:** A map of participant identifiers to counters. Comparing two maps can show
  whether events are causally ordered or concurrent.
- **Causal state:** Metadata needed to preserve or inspect happened-before relationships. A
  Lamport counter is a compact ordering mechanism; a vector clock is a richer causal mechanism.
- **`base_version`:** The shared document revision a producer observed when minting an op. In the
  scalar model it is the first LWW ordering component and a direct stale-base signal.
- **Producer:** The caller that mints an op and its immutable `op_id`; in V1 this may be the agent
  or human path, not necessarily the doc host.
- **Doc host:** The always-on process that owns the live room document and currently serializes
  application/persistence; it is an operational authority, not a permanent distributed allocator.
- **Lineage:** One document history. An explicit `doc_reset` starts a new lineage; ordinary gaps
  and reconnects replay against the same follower document.
- **Incarnation:** The lifetime namespace of a node identity between creation and deletion/re-add.
  DQ-11 qualifies target stamps by incarnation so a stale prior life cannot defeat a new life.
- **`__stamps`:** Internal shared-document ledger entries recording the winning stamp for a target;
  they are implementation state and excluded from the user-facing graph projection.
- **Shadow comparison:** An observational run that evaluates two ordering policies over identical
  semantic op streams and reports order or final-state divergence without changing behavior.
- **LWW:** Last-writer-wins selection using a deterministic total ordering key.
- **`op_id`:** The creator-minted immutable operation identifier used for idempotency and as the
  final ordering tie-break; retries never mint a replacement.

