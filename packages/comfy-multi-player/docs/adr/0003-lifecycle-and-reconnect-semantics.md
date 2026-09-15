# ADR-0003: Lifecycle and reconnect semantics — three lifetimes, atomic batches, resync as authority

**Status**: accepted
**Date**: 2026-08-21

## Context

The system spans processes with radically different lifetimes: browser tabs come and go, the Go
agent worker runs turns that can crash mid-flight, the doc-host sidecar answers single HTTP calls,
and Postgres rows outlive everything. Without named lifetime classes and explicit reconnect rules,
each component invents its own recovery story and clients cannot reason about what survives what.

Grounding: the Lifecycle & Reconnect Semantics TDD subpage
(https://www.notion.so/3c26d73d365081948262e2470878eb38, bundle `reports/lifecycle/`), the verified
CRDT source `cloud@8d062714` — since merged to `main` (superset; re-pointed 2026-08-21 to
`main@070dce96`) — (`services/agent/internal/docstore/docstore.go`,
`services/agent/internal/loop/crdt.go`), and `research/architecture/kishore-crdt-architecture.md`.

## Decision

1. **Three lifetimes, explicitly named.** Every piece of state belongs to exactly one class:
   - **Ephemeral (one agent turn, seconds–minutes):** scratch dir, `workflow.json` projection,
     model rounds, in-memory tool context. Vanishes with the turn.
   - **Stateless (one doc-host call, milliseconds):** the sidecar folds a fresh Y.Doc from
     snapshot+updates, applies ops / projects / mints, answers, and forgets everything.
   - **Durable (survives every restart):** `workflow_docs` (snapshot + `seq` + applied op_ids),
     `agent_threads` / `agent_messages` / `agent_tool_calls` (full session history), and
     `workflow_draft` as a projection cache.

2. **No half-applied batch.** The Go writer advances `doc_state`+`seq` in one predicate-guarded
   CAS per tool commit. A lost CAS triggers a fresh read and re-derivation of the same ops, never
   a blind retry. A crash therefore interrupts a turn but can never leave the durable document
   with a partially applied batch.

3. **Resync is the authority path.** Reconnect never depends on the broadcast channel. Redis
   fanout is fire-and-forget; missed frames never matter because the client's own local doc is
   its resume token (Yjs state vector) and the durable doc row is the catch-up source. Tab
   switches keep the socket and room membership; tab close drops them, and the next open resyncs
   from durable state exactly like any cold start.

4. **No transparent turn resume — an explicit NON-guarantee.** When an agent worker dies
   mid-turn, thread/message/tool-call rows and the doc survive, but the interrupted turn does not
   transparently resume. Any future resumption is a new turn reading durable state. Components
   must not be designed as if mid-turn worker resume exists.

## Consequences

- Recovery logic is uniform for every client class (browser, phone, agent process, multi-client):
  reconnect ⇒ state-vector resync against the durable doc; no per-transport replay protocol.
- The doc host stays horizontally trivial (stateless per call); scaling and crash-recovery
  concerns concentrate in the single Go writer and the database.
- Durable-but-not-transparent turn recovery means UX must surface "turn interrupted" rather than
  pretend continuity; conversely no distributed checkpointing machinery is required.
- Offline/queued-edit semantics remain a separate concern: this ADR covers reconnect catch-up,
  not durable client-side edit queues or conflict UX (see risk register R-9 family).

## Alternatives Considered

- **Transparent mid-turn worker resume** (checkpoint the loop, resume on a new worker): rejected
  for V1 — high machinery cost, and the atomic-CAS + durable-history design already bounds the
  blast radius of a crash to one turn.
- **Broadcast-replay recovery** (buffer and replay missed Redis frames): rejected — makes an
  ephemeral transport load-bearing and duplicates what state-vector resync already guarantees.
- **Stateful doc-host sessions** (keep folded docs in sidecar memory across calls): rejected —
  reintroduces affinity and cache-invalidation problems for microsecond-scale savings.

## References

- Lifecycle & Reconnect Semantics subpage: https://www.notion.so/3c26d73d365081948262e2470878eb38
- `reports/lifecycle/*.mmd` (diagram sources), especially `01-three-lifetimes.mmd`, `02-agent-turn.mmd`, `04-reconnect-catchup.mmd`
- `cloud@8d062714`: `services/agent/internal/docstore/docstore.go:101-131` (CAS), `services/agent/internal/loop/crdt.go:401-455` (lost-CAS re-derivation).
  On `main@070dce96` (2026-08-21) these live at `docstore.go:109-129` (`Advance` CAS, `ErrSeqConflict`) and `crdt.go:416-457`.
- ADR-004 (state authority & sync), ADR-007 (op-based CRDT V1), ADR-008 (local persistence)
- Persistence & Data Model subpage: https://www.notion.so/3c36d73d365081759641d9b80600f9cc
