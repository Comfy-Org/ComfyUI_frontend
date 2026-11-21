# 26. Target-graph addressing and offscreen command queues

**Status**: accepted
**Date**: 2026-08-28

> **Folded into the broader frontend abstraction (2026-08-28).** This ADR remains the
> authoritative narrow contract for explicit target addressing, per-target queues, and
> replay safety. Its implementation vehicle is now the FE `GraphDocument` and explicit
> graph-activation model in FE ADR-0024, which adds document lifecycle, renderer
> attachment, persistence, and V1/ECS sequencing. Do not implement ADR-015 as a
> singleton offscreen queue detached from that document model.

## Context

An agent turn is not necessarily about the graph the user is looking at. A user can keep
graph A in one tab, switch to graph B, and continue editing B while the agent reads and
writes A. The agent can also have more than one target graph in flight. Therefore active-tab
identity is presentation state, not a valid address for an agent mutation.

The V1 document protocol already carries `workflow_id` on document frames, but the FE
adapter must preserve that identity through the whole apply path. The target must not be
replaced by `canvasStore.rootGraphId`, `app.graph`, or any other render-attached singleton.
This is also needed for recovery: each target has its own follower document, state vector,
sequence baseline, pending effects, and lineage. A state vector or queued batch from graph A
must never be used to recover graph B.

The current FE adapter audit found two different states. The worker4 predecessor samples
the active graph scope through `getScope()` when a batch is applied. The `fixes` branch adds
`bindScope()` and a test for switching the active canvas after a scope is bound, but still
constructs one `EcsFollowerAdapter`, has no target-keyed registry or queue, and calls
`app.canvas?.setDirty(true, true)` from the composition root. Its target scope is also a
direct `workflow_id` → `GraphScope` conversion rather than a resolver for loaded and
offscreen graph registrations. Details are in
`reports/review-queue/offscreen-graphs-gap.md`.

## Decision

Every remote or agent mutation batch carries an explicit target document/workflow identity,
and the FE applies it through a target-keyed ECS mutation path regardless of which canvas is
active.

The target identity is the canonical `workflow_id` on the V1 wire. The document registry
resolves it through a stable one-to-one `workflow_id` → `GraphDocument.document_id` mapping
and rejects duplicate or stale mappings. Target sessions are keyed by `document_id`; a
nested `GraphId`, including the root graph ID, identifies a scope inside that document and
cannot create another target session. The wire identity is mandatory on the agent command
record, emitted document frame, and adapter dispatch. The adapter rejects a frame whose
resolved document does not match the receiving target session; it never falls back to the
active graph.

The FE end shape is a registry of target sessions:

```text
 agent command batch
 { workflow_id, stamped ops, ... }
             │
             ▼
      target-session registry
   ┌─────────┴─────────┐
   │ workflow A        │ workflow B
   │ doc + state vector│ doc + state vector
   │ GraphScope + ECS  │ GraphScope + ECS
   │ pending queue     │ pending queue
   └─────────┬─────────┘
             │ target session only
             ▼
      ECS mutation path
             │
             ├── active canvas render, if A or B is visible
             └── no focus, selection, or active-canvas side effects
```

Each session resolves `workflow_id` to a registered graph/document scope. If the target is
loaded, its remote batch is applied immediately to the ECS stores, even when that graph is
not active. If the target is not loaded, the session retains the received target-scoped
batch and its provenance until the graph/document registration becomes available. Queue
drain preserves target order and the original `[base_version, actor, op_id]` stamps; it does
not re-mint, reorder the interior of a batch, or derive an `add_node` payload again. If the
target cannot be resolved, the adapter reports a target-resolution failure and keeps the
batch recoverable or requests a target-scoped state-vector resync. It must not apply the
batch to the active graph.

Loaded application and queue drain use the same atomic prepare/commit boundary. Prepare
stages the follower Y.Doc, ECS/domain stores, target `ChangeTracker`, state vector, and
applied sequence without exposing any component independently. Commit publishes that
complete target tuple together. A queued batch is removed and acknowledged only after the
commit succeeds. If preparation or commit fails, the prior tuple remains visible and the
batch retains its target ordering and remains recoverable.

The queue is a delivery/application buffer, not a second merge authority. The host and
shared `@comfyorg/comfy-multi-player` applier remain authoritative. A bounded queue overflow,
process restart, or lost target session is recovered by a target-scoped state-vector
resubscribe, not by applying a different graph's bytes or wiping an ordinary follower doc.
An explicit `doc_reset` is the only event that permits replacing that target session's
follower document. Before replacement or eviction, the FE dispatches reset and waits at an
acknowledgement or observation barrier until every projector/store consumer has processed
it. The new lineage cannot become visible before that barrier completes.

Target sessions also carry the document lineage needed by reconnect/replay. DQ-11(c)'s
`node_incarnation` is semantic payload data produced by the shared applier: the adapter
preserves it and does not infer it from the active canvas, collapse it into a client id, or
mint a replacement. A same-node-id re-add is applied in the target session that received
the frame; stale widget stamps from another incarnation must not cross target or lineage
boundaries. Retries resend the original operation and `op_id`.

Remote application commits the target document's `ChangeTracker` update with its ECS/domain
and target-aware layout state. This target-aware dirty-tracking seam is required before
target sessions can be enabled. Remote application must not focus a tab, alter
selection/hover/presence, call active-canvas-only APIs, or depend on a renderer-attached
graph object. Active-canvas rendering is a downstream projection of store state. Presence
stays on awareness, and layout remains in the separate FE-owned Y.Doc as required by
KEEP-ALIVE #8.

## Consequences

### Positive

- Agent work remains correctly addressed when the user changes tabs or edits another graph.
- Multiple target graphs can progress concurrently without sharing a Y.Doc, sequence
  baseline, ECS scope, or pending-effect queue.
- Offscreen work can be materialized into domain stores without stealing focus or requiring a
  mounted renderer.
- Reconnect and replay are naturally partitioned by target identity and preserve the
  existing state-vector, `doc_reset`, and DQ-11(c) rules.
- Target identity is explicit at the API/frame/adapter seams, making authorization,
  observability, and future hostless peers easier to audit.

### Negative

- The FE needs a target-session registry and lifecycle for loaded, unloaded, detached, and
  reset targets instead of one process-local follower.
- Offscreen queues need bounded storage, retry/resync telemetry, and a clear registration
  handshake. This ADR does not choose durable browser persistence for that queue.
- Target-session enablement requires target-aware store notifications and `ChangeTracker`
  updates; active-canvas calls such as `app.canvas?.setDirty(...)` cannot serve this path.
- A workflow ID to graph ID cast is not sufficient for nested graphs, reloads, or multiple
  representations. Resolution must be an explicit registry boundary.
- This does not make semantic conflict resolution client-owned. The shared applier and its
  stamp contract remain the merge authority.

## Amendment 2026-08-29: alignment with the per-workflow transient-state TDD

The FE already has a Christian-authored TDD covering exactly the state-scoping problem
this ADR's target sessions must live inside: "TDD: Per-workflow transient state scoping vs
snapshot restore" (Notion `3bf6d73d-3650-8103-9130-ed0a48763184`, draft 2026-08-17/18,
reviewers Terry Jia and DrJKL, prompted by FE PR #14941 review). This amendment folds its
findings into the target-session contract so the CRDT adapter does not invent a fifth
hand-rolled scoping scheme.

### Status quo the target-session registry must coexist with

- Per-workflow FE state today lives in **process-global containers**; isolation is achieved
  after the fact by a **ChangeTracker swap on tab activate/deactivate**. ChangeTracker is
  the de facto document object for persisting transient, unactivated graph state.
- `app.clean()` wipes six things per workflow load; ChangeTracker restores one. The
  asymmetry is why at least four independent hand-rolled graph-scoped-keying
  implementations exist (two written the same week: FE PRs #15360/#15361 both chose
  graph-scoped keying independently).
- Root-graph `NodeLocatorId` is a bare node id (no graph prefix), so cross-workflow key
  collisions are structural, not incidental (documented in
  `docs/architecture/ecs/ecs-identity-scope-audit.md`, merged to `feature/ecs-migration`).

### What the TDD decides that this ADR now adopts

1. **Key graph-scoped containers by root graph ID and evict explicitly on workflow close**
   (TDD option 6, workflow-scoped containers) — not a provider registry (rejected: only
   justified when state crosses the reload boundary with a serializable payload), not new
   ChangeTracker fields. The target-session registry composes with this pattern rather than
   reusing its scope key: it keys one session by stable `GraphDocument.document_id`, resolves
   the canonical wire `workflow_id` through the registry's one-to-one mapping, and then
   resolves root and nested graph scopes inside that document. Tab switches, reloads, and
   nested scopes therefore cannot create duplicate sessions for one workflow.
2. **The missing primitive is a workflow-close hook.** `LGraph.clear()` fires on every tab
   switch, so nothing that must survive tab switches can use it for eviction. Target
   sessions have the same need: a queue for an offscreen target must survive tab switches
   and be evicted only on workflow close (or explicit `doc_reset` lineage replacement).
   When the FE close hook lands (TDD phase P1), target-session teardown must subscribe to
   it rather than to any render-attached lifecycle.
3. **Isolation vs survival is a real axis.** Stores that can re-hydrate from workflow JSON
   (widgetValueStore, previewExposureStore) need isolation only; state that cannot
   re-hydrate (node outputs, previews, compositor cache) needs isolation _and_ survival.
   Target-session contents — follower doc, state vector, sequence baseline, pending
   queue, lineage — are all in the survival class: none of them can be re-derived from
   workflow JSON, so they must never be keyed to, or evicted by, tab activation.
4. **Compat constraints are frozen.** `app.nodeOutputs` is read by the ecosystem with bare
   node-id keys; the TDD's P3 migration keys nodeOutputStore internally by
   `${rootGraphId}:${locator}` while preserving a bare-id compat view for the active
   graph. Remote application through target sessions must write through the same
   graph-scoped internal path and must not extend the frozen bare-id surface.
5. **Non-goals carried over.** No splitting ChangeTracker, no `NodeLocatorId` format
   change, and no coupling to a speculative ECS v2 rewrite. Target sessions integrate with
   the containers as they exist per TDD phase, not with an imagined end state.

### Consequence for implementation sequencing

The fec-9 adapter's target-session registry should land keyed by stable `document_id` from
the start, after resolving the canonical wire `workflow_id`; graph-scoped containers remain
keyed by root graph ID inside that document. Eviction is wired to `doc_reset` now and to the
workflow-close hook when P1 lands. Interim tab-switch behavior: retain, never evict. This
keeps the adapter aligned with the TDD's migration path (P1 close hook → P2 migrate
15360/15361 → P3 nodeOutputs) instead of requiring a re-key later.

## Alternatives Considered

- **Always apply to the active canvas** — rejected; it corrupts the graph the user is
  viewing when the agent target is elsewhere and cannot support concurrent targets.
- **Open or focus the target tab before applying** — rejected; it couples correctness to
  presentation, interrupts the user, and still leaves no queue for an unloaded target.
- **One global follower with a mutable current workflow** — rejected; document, sequence,
  lineage, and pending effects can leak across target switches.
- **Queue whole-document replacements** — rejected; it clobbers concurrent edits and violates
  the op-based replication contract. Queued items are target-scoped semantic batches/frames.

## References

- `AGENTS.md`, CRDT / Multiplayer Invariants, KEEP-ALIVE #1, #2, #4, #6, #8, #10, #13 and
  FORECLOSE #4, #5, #7, #11.
- `decisions/ADR-007-op-based-crdt-v1.md` — stamped semantic operations and shared applier
  direction.
- `decisions/ADR-010-fe-follower-yjs-backed-ecs.md` — ECS/store follower seam.
- `decisions/ADR-011-seq-gap-recovery-is-replay-never-wipe.md` — ordinary gap recovery keeps
  the target follower document.
- `reports/review-queue/offscreen-graphs-gap.md` — exact FE branch audit.
- `CONTEXT.md`, `DQ-11 incarnation-stamp enactment` — `node_incarnation` and lineage context.
- Notion TDD `3bf6d73d-3650-8103-9130-ed0a48763184` — "Per-workflow transient state scoping
  vs snapshot restore" (Christian, 2026-08-17/18): workflow-scoped containers, close hook,
  isolation-vs-survival axis, `app.nodeOutputs` compat freeze.
- FE PRs #14941 (provider registry, rejected pattern), #15360/#15361 (independent
  graph-scoped keying prior art), #15330 (`ecs-identity-scope-audit.md`), umbrella #3377.

## Glossary

- **Target graph** — the workflow/document selected by the agent command, identified by its
  stable `workflow_id`; it is independent of the graph currently visible to the user.
- **Target session** — the FE registry entry holding one target's follower Y.Doc, scope,
  queue, sequence baseline, and lineage lifecycle.
- **Offscreen graph** — a target that is loaded in domain state or queued for materialization
  but is not the active canvas.
- **ECS mutation path** — the typed, graph-scoped domain-store batch that applies remote
  effects and provenance; it is not a LiteGraph imperative mutation.
- **State vector** — Yjs's compact description of a replica's known updates, used for
  target-scoped delta resync.
- **Lineage** — the history identity of a document; an explicit `doc_reset` starts a new
  lineage and permits replacing the follower Y.Doc.
- **`node_incarnation`** — the DQ-11(c) token that namespaces widget stamps across a
  delete/re-add of the same node ID.
- **Active-canvas side effect** — focus, selection, dirty marking, viewport, or other
  behavior that changes the user's currently visible canvas rather than target domain state.
- **ChangeTracker** — the FE object swapped on tab activate/deactivate that persists
  transient graph state today; the de facto document object until `GraphDocument` lands.
- **Workflow-close hook** — the missing FE lifecycle primitive (TDD phase P1) that fires
  only when a workflow is actually closed, unlike `LGraph.clear()` which fires on every tab
  switch; the correct eviction point for target sessions and survival-class state.
- **Isolation vs survival** — the TDD's axis for per-workflow state: isolation-only state
  can re-hydrate from workflow JSON; survival state (including all target-session contents)
  cannot and must outlive tab switches.
