# ADR-CRDT-FOLLOWER-0025: In-App Agent CRDT Follower and Distribution-Resolved Boundaries

Date: 2026-08-21

## Status

Proposed

<!-- [Proposed | Accepted | Rejected | Deprecated | Superseded by [ADR-NNNN](NNNN-title.md)] -->

## Context

The In-App Agent runs server-side and needs to read a user's live workflow and write
graph changes back into the canvas. On the frontend this arrives as a Yjs document
update produced by a single authoritative writer (the agent's doc-host, running the
shared `@comfyorg/comfy-multi-player` applier). The frontend's job is to **follow**:
integrate that update into frontend state and re-render. It does not author semantic
operations in V1.

The POC (originally branch `poc/fe-crdt-follower`, now mounted with the
flag-gated agent panel) ships an interim follower that diffs the
semantic Y.Doc into a `GraphMutation[]` and applies them to `app.graph` through a
`LitegraphMutator` (`src/workbench/extensions/agent/crdt/`). That path renders, but it
writes the imperative litegraph layer that the store migration
([#14246](https://github.com/Comfy-Org/ComfyUI_frontend/pull/14246) and the
`layoutStore` pattern from [CRDT-LAYOUT-0003](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md)) is replacing,
and it introduces a second semantic model parallel to the frontend domain stores. It is
a disposable stopgap, not the durable seam.

This ADR records two coupled decisions the follower work depends on:

1. **What the follower writes into** (the state seam), and
2. **How one codebase serves four product surfaces** without forking follower semantics.

The frontend is delivered to four product surfaces — **Cloud** (`agent.comfy.org` and
cloud PR previews), **Desktop** (Comfy-Desktop Electron), **Local** (ComfyUI on the
user's own machine — a real product surface, not a dev rig), and **Dev/ephemeral** (a
Vite dev server against a selected backend). The build models this in
`src/platform/distribution/types.ts` (`Distribution = 'desktop' | 'localhost' | 'cloud'`,
`DISTRIBUTION`, `isCloud`, `isDesktop`), resolved by `vite.config.mts` into the
compile-time `__DISTRIBUTION__` define. Existing code already branches on these constants
(for example `isCloud` in
`src/platform/workflow/persistence/composables/useWorkflowPersistenceV2.ts`, `isDesktop`
in `src/views/GraphView.vue`).

The follower **apply** path has no product-specific graph semantics — every surface
receives the same host-made `doc_update` and applies the same Yjs update. Only the
boundaries around it differ: the transport endpoint (Cloud reaches the agent through
same-origin ingest; Local and Desktop connect directly to the agent binary; ingest is a
cloud-only relay that does not exist locally), and authentication (every surface uses the
unified chain in `authStore.getAuthHeader()`; Cloud ingest additionally enforces M2M
server-side). The model provider is never a distribution fork — every surface reaches the
model remotely through the comfy-api proxy.

## Decision

**Follower state seam.** The durable follower merges remote Y.Doc updates directly into
the yjs-backed frontend domain stores (the `layoutStore` pattern extended to the semantic
stores); the canvas re-renders reactively from store state. No projector, no
snapshot-diff, no `LitegraphMutator` in the end state.

- litegraph is a **render target / compatibility boundary**, not the state seam. State
  lives in the stores; litegraph is painted from them.
- **Layout stays its own frontend-owned Y.Doc** ([CRDT-LAYOUT-0003](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md)).
  `pos`, pan/zoom, live drags, and groups do not go in the shared semantic doc; the two
  docs are composed, not merged.
- **The follower never writes the shared doc.** Raw Yjs updates flow host to follower
  one-way only.
- The op stamp `[base_version, actor, op_id]` is load-bearing for the eventual
  human-write / merge path and is not replaced by any store command layer's own IDs.
- The applier is the single shared package `@comfyorg/comfy-multi-player`, pinned by SHA.
  There must be no second applier implementation in the frontend.
- ~~V1 is follow-only and needs no public graph-mutations API; the "internal API" is the
  Yjs binding into the domain stores. The human write-back path (canvas edit to op to
  host) is a later, separate step.~~ **Amended 2026-08-22 — see the Amendment section
  below: the human write path co-ships with the follower.** The "no public
  graph-mutations API" half stands; the sequencing half does not.

This supersedes the ADR-009-style `LitegraphMutator`/snapshot-diff/semantic-projector
direction recorded in the workspace; that code remains only as the interim POC behind the
env gate.

**Distribution boundaries.** Keep one branch and one follower implementation, with
surface differences isolated behind a small distribution-resolved boundary (rejecting
both separate per-surface branches and distribution checks scattered through the follower
core). Introduce a narrow agent connection/configuration seam **when direct-to-agent
product wiring is implemented** — it resolves the agent HTTP/WS base URL (an
`AGENT_BASE_URL`-style value), whether the route is same-origin through cloud ingest or
direct to the local/Desktop agent binary, and credentials by delegating to
`authStore.getAuthHeader()`. Use `DISTRIBUTION`/`isCloud`/`isDesktop` **inside that
boundary only**; do not scatter distribution checks through the CRDT apply seam, domain
stores, or rendering, and never reduce auth to `isCloud` (Local and Desktop are
authenticated product surfaces). Dev-only Vite proxy/credential behavior stays in Vite
config and is never treated as Local product behavior.

Today the POC follower rides the centralized ComfyUI `api` transport (`api.socket` in
`src/scripts/api.ts`), which is already distribution-resolved, so no `AGENT_BASE_URL` is
wired yet; this ADR records the seam as the shape to introduce when the follower stops
riding `api.socket` and connects to the agent directly.

```text
                         compile-time __DISTRIBUTION__
             ┌────────────────────────┼────────────────────────┐
        Cloud build             Desktop build           localhost build
             │                        │                        │
      same-origin ingest       direct agent binary      direct agent binary
             └────────────┬───────────┴───────────┬────────────┘
                          ▼                        │
              distribution-resolved agent seam     │
              endpoint + route + unified auth ◄─────┘
                          │
                          ▼   host → follower only
              shared follower APPLY / store / render path
                          │
                          ▼
                        canvas

 All four surfaces ───────────────────────► comfy-api proxy ─► remote model
```

**Enforcement.** Guard the seams with the centralized `assert(cond, msg)` from
`src/base/assert.ts` (DEV throws, prod reports to Sentry); the message must name the
broken invariant and link this ADR (for example: "breaks CRDT follower invariant:
followers never write the shared doc — see FOLLOWER"). A `.agents/checks/` profile should
flag direct shared-doc mutation, peer raw-update ingestion, optimistic-overlay-as-update,
layout fields written into the shared semantic doc, and `op_id` regeneration. Keep the
op-layer package DOM/litegraph-free via the import-graph guard.

## Consequences

### Positive

- The follower writes into the same store layer the codebase is migrating to, so it does
  not hard-code a seam onto litegraph, the layer being deleted.
- One shared apply/store/render path means shared fixes, hardening, schema changes, and
  tests protect all four surfaces at once.
- Distribution conditionals stay auditable in one configuration layer instead of becoming
  a core-version × surface-version matrix.
- Build-time distribution supports dead-code elimination; if endpoint selection must
  change post-build, the same seam can consume validated runtime config without touching
  the follower core.

### Negative

- The end-state follower depends on the semantic domain stores becoming Yjs-backed; only
  `layoutStore` is Yjs-backed today, so the real dependency is extending that pattern per
  store. Until then the interim `LitegraphMutator` POC remains behind the env gate.
- The largest risk is accidental cloud coupling in the existing same-origin `/ws`
  transport: if ingest-specific paths, M2M assumptions, or Vite proxy behavior leak past
  the seam, Local/Desktop can pass contract tests while failing as products. Boundary
  tests plus at least one browser-observable E2E per shipping topology are required.
- No-echo (an agent-applied change must not round-trip as a local edit) is **not** a
  solved property today: the ambient `LayoutSource.External` guard is defeated by the
  unconditional `setSource(LayoutSource.Canvas)` in `LGraphNode`'s `pos` setter. Treat
  call-carried provenance (`applyRemote(update, { source, actor })`) as an acceptance
  criterion of the seam, and do not ship a human write-back path before a test that drives
  a real `LGraphNode.pos` asserts the recorded source.

## Amendment (2026-08-22) — the human write path co-ships with the follower

The original text scoped V1 as follow-only, with the human write-back path as a later,
separate step. That sequencing is superseded: concurrent human+agent co-editing of one
shared doc is the product goal, so the write path ships with the follower, not after it.
This is a sequencing amendment, not an architecture change — every contract above is
unchanged, and the server side of the write path (the `doc_ops` ingress, actor
validation, batch caps, sole applier, and echo broadcast) already exists.

What the frontend adds, all on the V1 critical path:

1. **Mutation-to-op minting** — a canvas edit mints a semantic op stamped
   `[base_version, actor, op_id]`; `op_id` is minted once and never regenerated on retry.
2. **`doc_ops` sender** — stamped semantic ops go up on the `doc_ops` frame with
   `base_version` tracking; retries re-send the same op, never re-mint it.
3. **Optimistic overlay** — pending local ops render from a presentation-only shadow,
   cleared on _effect_ (the echoed `doc_update`), not on ack; never encoded as a Yjs
   update, never merged into the shared doc.
4. **Echo-attribution guard** — call-carried provenance
   (`applyRemote(update, { source, actor })`) so the editor's own echo is not re-recorded
   as a local edit. Already an acceptance criterion above; it is now the gating item on
   the critical path rather than a precondition for deferred work.

The follower boundary is unchanged: raw Yjs updates still flow host to follower one-way
only, and the follower still never writes the shared doc. Human edits reach the doc via
semantic `doc_ops` toward the host's sole applier — never via raw Yjs writes — so the
write path and the follower invariant coexist by design. Whole-graph replace as the
mutation primitive (client re-sends the full graph, server diffs and re-mints ops)
remains rejected: it clobbers concurrent agent edits mid-turn and kills op-log replay.

## Notes

This ADR relates to [CRDT-LAYOUT-0003](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md)
(CRDT layout) and [ECS-0008](ECS-0008-entity-component-system.md) (whose unified `World` was
dropped in favor of dedicated Pinia stores). Migrating the stores remains a separate
dependency.

## Addendum (2026-08-21): spike classification of the follower files

The follower code on this branch splits into a durable core and a disposable spike:

- **Keep (durable, may receive further tests/E2E):** `docFrameClient`, `followerDoc`,
  `docSchema` + `schemaGuard`, `layoutFollowerBridge`,
  and the `useAgentCrdtFollower` orchestrator shell.
- **Dispose (spike-only, no further investment):** `semanticProjector`, `diffSnapshots`,
  `graphMutations`, `litegraphMutator`, and `followerSeam.integration.test.ts`. These are
  the interim snapshot-diff render path and are deleted when the
  apply-remote-update→store adapter lands. Coverage or review findings on these files
  route to the store-adapter work, not to polishing the spike.
