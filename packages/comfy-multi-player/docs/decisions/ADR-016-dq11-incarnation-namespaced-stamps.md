# ADR-016: Namespace widget LWW stamps by node incarnation

**Status:** accepted
**Date:** 2026-08-28
**Decider:** Christian Byrne
**Decision queue:** DQ-11, option (c)

> **Mirror note:** This ADR is mirrored from the
> [`christian-byrne/in-app-agent-program`](https://github.com/christian-byrne/in-app-agent-program)
> workspace. Paths such as
> `program/…` and `reports/…` in the text and references below are workspace-repo paths, not
> paths in this repository; they do not resolve here.

## Context

The op-based graph model resolves node presence and widget values through separate stamped
registers. A `delete_node` can therefore remove a node while leaving a widget stamp in the
document. If the same normalized node ID is later re-added, a life-1 widget stamp can defeat a
valid life-2 write. The arrival order of the old update and delete changes the hidden stamp
residue, so the replicas can diverge after the re-add.

This is the failure recorded in `reports/spikes/spike-5-merge-suite.md` and
`reports/audit/current-node-conflict-matrix.md`. It violates KEEP-ALIVE 4: equivalent causal op
sets must converge, while preserving the old stamp would make a deleted node's history compete
with a new node lifetime.

## Decision

Use a durable incarnation namespace for every node lifetime.

1. Every node map carries an internal `__incarnation` token. Imported nodes and v1 documents use
   the deterministic legacy token `"0"`. A winning modern `add_node` carries its creator-supplied
   `node_incarnation`, normally the immutable `op_id`, as the token.
2. Node-scoped widget operations carry the same `node_incarnation`. A write for a non-current
   incarnation is a consumed no-op and must not write into the current incarnation's stamp
   namespace. Missing fields translate to the legacy token for replay compatibility.
3. Widget target keys include the normalized node ID, incarnation, and widget name. Same-life
   writes continue to use the total-order stamp `[base_version, actor, op_id]`.
4. `SCHEMA_VERSION` is 2. The v1-to-v2 migration assigns token `"0"` and inserts it into legacy
   widget target keys. Old readers fail closed; the migration is explicit and host-side.

```text
life 1: node 7 ── set_widget(token=0) ── delete ──┐
                                                    │ old stamp cannot compete
life 2: node 7 ── add(token=op-id-2) ── set_widget(token=op-id-2) ── winner
```

The shared package governs the semantic document and op contract. It does not by itself change
the WebSocket envelope version; cloud and FE integration must gate `node_incarnation` semantics
as a transport-v2 compatibility requirement, with legacy translation only where explicitly
documented.

## Invariants preserved

- KEEP-ALIVE 2: the creator-minted `[base_version, actor, op_id]` stamp remains load-bearing.
- KEEP-ALIVE 4: the same op set converges independent of arrival order.
- KEEP-ALIVE 10: migrations and replicas derive from one seeded snapshot.
- KEEP-ALIVE 11: persisted layout changes bump the schema, fail closed on old readers, and provide
  a migration path.
- FORECLOSE 7 and 8: retries keep the original `op_id`, and replay copies `add_node` payloads
  verbatim rather than re-deriving defaults.

## Consequences

- Delete/re-add no longer permits stale life-1 widget stamps to affect life-2 writes.
- The persisted document, target-key layout, and semantic op payload gain a migration boundary.
- The shared package needs migration, golden-vector, and both-order parity coverage; FE and cloud
  consumers must not silently mix v1 and v2 semantics.
- The legacy token keeps imported workflows and historical ops replayable, but does not pretend
  that an old operation belongs to a newly created incarnation.

## Alternatives considered

- **Clear descendant widget stamps on delete:** smaller change, but rejected because it changes
  delete/update residue semantics and does not provide a durable identity for a new lifetime.
- **Preserve residue and define cross-kind supersession:** rejected because node creation would
  have to reason across the independent presence and widget registers.
- **Leave the behavior unchanged:** rejected because spike-5 demonstrates arrival-order-dependent
  post-re-add projections.

## References

- [`program/decision-queue.md`](https://github.com/christian-byrne/in-app-agent-program/blob/main/program/decision-queue.md)
  — DQ-11 resolution (workspace repo).
- [`program/dq-11-primer.md`](https://github.com/christian-byrne/in-app-agent-program/blob/main/program/dq-11-primer.md)
  — problem and alternatives before the ruling (workspace repo).
- [`reports/spikes/spike-5-merge-suite.md`](https://github.com/christian-byrne/in-app-agent-program/blob/main/reports/spikes/spike-5-merge-suite.md)
  — minimized failure and required enactment shape (workspace repo).
- `comfy-multi-player`
  [`docs/multiplayer-schema.md`, Amendment A16](https://github.com/Comfy-Org/comfy-multi-player/blob/main/docs/multiplayer-schema.md)
  — the enacted DQ-11 incarnation-namespaced widget stamps amendment (A15 governs promoted
  subgraph host writes, not DQ-11).
- `comfy-multi-player`
  [`docs/INVARIANTS.md`](https://github.com/Comfy-Org/comfy-multi-player/blob/main/docs/INVARIANTS.md)
  — KA-11 amendment and enforcement mapping.

## Glossary

- **Incarnation:** one lifetime of a normalized node ID between creation/re-add and deletion.
- **LWW:** last-writer-wins register selected by the total-order stamp.
- **Stamp residue:** a widget-register stamp that remains after its node is deleted.
- **Consumed no-op:** an accepted operation recorded for idempotency that produces no state write.
- **DQ-11:** the decision-queue item selecting incarnation-namespaced stamps.
