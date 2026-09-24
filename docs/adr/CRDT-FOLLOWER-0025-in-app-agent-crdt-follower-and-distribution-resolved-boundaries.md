# ADR-CRDT-FOLLOWER-0025: In-App Agent CRDT Follower and Distribution-Resolved Boundaries

Date: 2026-08-21

## Status

Accepted (2026-09-24)

Revised 2026-09-24 by
[FE-2504](https://linear.app/comfyorg/issue/FE-2504/agentcrdt-remove-store-first-remote-apply-and-every-reconciliation).
The original 2026-08-21 text decided the follower writes remote state into the
Pinia stores, not litegraph, and the 2026-09-18 amendment blessed
`graphMutations` as durable.
Both are withdrawn; the store-first apply and every reconciliation layer built
on it were deleted. The distribution-boundary decision, the one-way follower
invariant, the human write path, and the product gate map are unchanged and
carried forward below.

## Context

The In-App Agent runs server-side and needs to read a user's live workflow and
write graph changes back into the canvas. The agent's doc-host runs the single
authoritative applier (`applyOps` in `@comfyorg/comfy-multi-player`) over a
shared Yjs document, and broadcasts the resulting update to every subscriber.
The frontend's job is to **follow**: integrate that update into the live graph
and re-render. Human canvas edits reach the document only as stamped semantic
`doc_ops` toward that host applier, never as raw Yjs writes.

The frontend is delivered to four product surfaces — **Cloud** (`agent.comfy.org`
and cloud PR previews), **Desktop** (Comfy-Desktop Electron), **Local** (ComfyUI
on the user's own machine — a real product surface, not a dev rig), and
**Dev/ephemeral** (a Vite dev server against a selected backend). The build
models this in `src/platform/distribution/types.ts`
(`Distribution = 'desktop' | 'localhost' | 'cloud'`, `DISTRIBUTION`, `isCloud`,
`isDesktop`), resolved by `vite.config.mts` into the compile-time
`__DISTRIBUTION__` define.

The follower **apply** path has no product-specific graph semantics — every
surface receives the same host-made `doc_update` and applies it the same way.
Only the boundaries around it differ: the transport endpoint (Cloud reaches
the agent through same-origin ingest; Local and Desktop connect directly to
the agent binary) and authentication (every surface uses the unified chain in
`authStore.getAuthHeader()`; Cloud ingest additionally enforces M2M
server-side). The model provider is never a distribution fork.

### What went wrong with writing the stores first

The first durable follower (`ecsFollowerAdapter` + `graphMutations`, landed
2026-09) wrote remote state into the Pinia domain stores (`nodeDataStore`,
`linkStore`, `widgetValueStore`, `layoutStore`) and expected litegraph to adopt
it afterwards through a materializer. The stores were chosen because the
store migration was replacing the imperative litegraph layer, and because the
applier "runs identically in the Node sidecar" ([#16652](https://github.com/Comfy-Org/ComfyUI_frontend/pull/16652)):
if the frontend and a headless sidecar share one store-shaped model, the
same apply code serves both.

That premise was false in two ways. The sidecar never needed frontend stores:
it runs the same `applyOps` the host runs, over the same Y.Doc, and has no
canvas to project onto. And in the browser the stores were never the source of
truth for the canvas — `LGraph`/`LGraphNode`/`LLink` still owned node
identity, slot arrays, link tables, widget instances, undo, `isModified`, and
every extension callback. Writing the stores first created a second model that
the live graph then had to be reconciled with, and every reconciliation
(snapshot diff, `updateNodeSlots`/`replaceNodeSlots` slot merges, the
`preserveCanonicalState` successor swap in `LGraph.remove`, a
`materializeLinkAdapter` on `LLink`, `RemoteMutationContext` on every store
action, locally-dirty widget tracking) was a patch over one more way the two
models had drifted. The visible symptoms were duplicated nodes after a tab
switch, links stranded at slot `-1`, resurrected human deletes, and echoes of
the user's own edits re-recorded as local changes.

## Decision

**The follower writes the live graph, not the stores.** The frontend follower
is an adapter that replays the host's already-applied document onto the live
`LGraph` through litegraph's graph API, carrying provenance. There is exactly
one applier, and it is not in the frontend.

- **`applyOps` in `@comfyorg/comfy-multi-player` is the shared applier.** The
  frontend imports it (pinned by SHA) for the human write leg's local
  bookkeeping only; op-to-doc semantics and conflict resolution are never
  reimplemented here.
- **The follower writes the graph API, not the stores.** Per delivered frame,
  `DocChangeCollector` records which document nodes, widgets, and links changed;
  `LiveGraphApplier` turns that into `graph.add`, `graph.remove`,
  `node.configure`, `origin.connect(...)`, `graph.removeLink`, and widget
  `setValue` calls on the live `LGraph`. The Pinia stores update as they do
  for a human edit: as a consequence of the graph API, through the same
  litegraph callbacks. No store action takes a remote-context parameter.
- **Provenance is call-carried.** Every remote write runs inside
  `withGraphIntentSource('agent-remote', ...)` (`src/lib/litegraph/src/graphIntents.ts`)
  and `layoutStore.withActor(actor, ...)`. `LGraph.add/remove/_addLink/_removeLink/clear`
  and the widget value setter announce `GraphIntent` events tagged with that
  source; `docOpMinter` mints `doc_ops` only from `local` intents. Layout
  operations recorded while the applier writes are stamped with the remote
  actor instead of this session's, so layout listeners can tell a remote
  insertion from a local one. Minting no longer keys on layout source.
- **No echo, by construction.** The host echoes every applied `doc_ops` batch
  as a `doc_update` stamped with the sender's actor. `useAgentCrdtFollower`
  drops a non-catch-up frame whose `actor` equals its own
  (`human:<user>:<tab>`) before it reaches the applier, and settles the
  optimistic overlay for that workflow. The live graph already holds the edit;
  applying the echo would only re-run the change tracker. The no-echo
  acceptance criterion of the original text is met by this entry-point check
  plus the `agent-remote` source on everything the applier does write.
- **One frame is one change.** The applier brackets each frame in the
  canvas's `emitBeforeChange`/`emitAfterChange`, so a remote batch is one undo
  entry and flips `isModified` once, exactly like a multi-step human edit.
- **Catch-up makes the live graph match the document, sparing the local
  human's in-flight edits.** On subscribe, tab return, or a sequence gap the
  host resends the document; `LiveGraphApplier.syncFromDoc` creates or updates
  every document node and link and removes the live nodes and links the
  document lacks. The only exceptions are the local human's own ops the
  document has not reflected yet (`PendingLocalEdits`: in-flight batches from
  `opSender.pendingOps()` plus acknowledged ops whose echo frame has not
  arrived, exposed to the projection as `LocalIntent`). A pending add keeps its
  node, a pending delete stays deleted, a pending widget write keeps its value,
  and a pending connect or disconnect keeps its link state, so the
  result-to-effect window can neither resurrect nor undo a human edit. A
  `doc_reset` clears the graph (`graph.clear()` under the remote source) and
  replays.
- **Layout stays its own frontend-owned Y.Doc**
  ([CRDT-LAYOUT-0003](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md)).
  `pos`, pan/zoom, live drags, and groups do not go in the shared semantic doc.
  The applier sets `node.pos` once at insertion (after batch placement,
  [CRDT-PLACEMENT-0035](CRDT-PLACEMENT-0035-agent-inserted-nodes-land-near-existing-content.md))
  and excludes `pos`/`size` from later field sync.
- **The follower never writes the shared doc.** Raw Yjs updates flow host to
  follower one-way only. Human edits go up as `doc_ops` through `opSender`;
  `op_id` is minted once and never regenerated on retry.
- **`LGraph`, `LGraphNode`, `LLink`, and the shared stores stay
  agent-unaware.** The only litegraph-side additions the agent relies on are
  `graphIntents.ts` (a generic provenance-tagged mutation announcement) and
  the `crdt-disjoint` id allocation policy. Anything that only the follower
  would call does not belong on those classes or stores.

```text
 human canvas edit ──▶ graph API ──▶ GraphIntent(local) ──▶ docOpMinter ──▶ doc_ops ──▶ host applyOps
                                                                                            │
                                            ┌── own actor? drop, settle overlay ◀── doc_update ◀──┘
                                            │
 host doc_update ──▶ followerDoc ──▶ DocChangeCollector ──▶ LiveGraphApplier ──▶ graph API
                                                            (agent-remote source,   │
                                                             remote layout actor)   ▼
                                                                          stores + canvas follow
```

### Rejected alternatives

- **Store-first apply with litegraph adoption** (the 2026-08-21 decision and
  its 2026-09-18 amendment). Rejected for the reasons in Context: it creates a
  second model of the graph and an unbounded reconciliation surface. The
  premise that store-first code is shared with a Node sidecar was false; the
  sidecar shares `applyOps`, not the frontend stores.
- **Snapshot-diff into `GraphMutation[]` via a `LitegraphMutator`** (the
  original POC). Rejected earlier and still rejected: it reverse-engineered
  intent from serialized snapshots instead of reading the document's own
  change set.
- **Dedupe echoes by `op_id` set instead of actor string.** Would tolerate a
  future host that coalesces several actors' ops into one update, but the
  host stamps one actor per update today and `op_id`s are not yet carried on
  `doc_update`. Revisit if the wire changes.
- **Whole-graph replace as the mutation primitive.** Clobbers concurrent agent
  edits mid-turn and kills op-log replay.

**Distribution boundaries.** Keep one branch and one follower implementation,
with surface differences isolated behind a small distribution-resolved boundary
(rejecting both separate per-surface branches and distribution checks scattered
through the follower core). Introduce a narrow agent connection/configuration
module **when direct-to-agent product wiring is implemented** — it resolves the
agent HTTP/WS base URL (an `AGENT_BASE_URL`-style value), whether the route is
same-origin through cloud ingest or direct to the local/Desktop agent binary,
and credentials by delegating to `authStore.getAuthHeader()`. Use
`DISTRIBUTION`/`isCloud`/`isDesktop` **inside that boundary only**; do not
scatter distribution checks through the follower apply path or rendering, and never
reduce auth to `isCloud` (Local and Desktop are authenticated product
surfaces). Dev-only Vite proxy/credential behavior stays in Vite config and is
never treated as Local product behavior.

Today the follower uses the centralized ComfyUI `api` transport (`api.socket`
in `src/scripts/api.ts`), which is already distribution-resolved, so no
`AGENT_BASE_URL` is wired yet; this ADR records the module as the shape to
introduce when the follower stops using `api.socket`.

```text
                         compile-time __DISTRIBUTION__
             ┌────────────────────────┼────────────────────────┐
        Cloud build             Desktop build           localhost build
             │                        │                        │
      same-origin ingest       direct agent binary      direct agent binary
             └────────────┬───────────┴───────────┬────────────┘
                          ▼                        │
              distribution-resolved agent module   │
              endpoint + route + unified auth ◄─────┘
                          │
                          ▼   host → follower only
              shared follower APPLY (graph API) / render path
                          │
                          ▼
                        canvas

 All four surfaces ───────────────────────► comfy-api proxy ─► remote model
```

**Enforcement.** Guard these boundaries with the centralized `assert(cond, msg)` from
`src/base/assert.ts` (DEV throws, prod reports to Sentry); the message must
name the broken invariant and link this ADR. The `.agents/checks/follower-boundary.md`
profile flags direct shared-doc mutation, follower-side store writes, a second
applier, reconciliation passes, `op_id` regeneration, and layout fields in the
semantic doc. Keep the op-layer package DOM/litegraph-free via the import-graph
guard.

## Consequences

### Positive

- One model of the graph. The live `LGraph` is the canvas's source of truth
  for both human and remote edits; the stores derive from it the same way in
  both cases, so there is nothing to reconcile.
- Remote edits get undo, `isModified`, extension callbacks
  (`onAdded`, `onRemoved`, `onConnectionsChange`, `onConfigure`,
  `onWidgetChanged`), autogrow, and slot realignment without follower code,
  because they run the same code a human edit runs.
- Litegraph and the stores carry no agent-specific hooks; the agent extension
  is deletable without touching them.
- One shared apply/render path means shared fixes and tests protect all four
  surfaces at once; distribution conditionals stay auditable in one layer.

### Negative

- Every graph mutation must go through `LGraph.add/remove/_addLink/_removeLink`
  or the widget value setter. A new mutation path that bypasses them emits no
  `GraphIntent`, so the minter never sends it and the applier's provenance
  scope never labels it.
- Provenance is ambient (a synchronous innermost-wins scope), not a parameter.
  Asynchronous work started inside an `agent-remote` scope and completed later
  is attributed `local`. The applier does no asynchronous work today.
- Echo detection keys on the actor string. Two tabs of one user are two actors
  (`tabId` is part of the actor), so a second tab applies the first tab's edits
  as remote, which is correct; but a host that ever coalesces actors would
  defeat the check.
- Widget "locally dirty" protection was removed with the store-first layer and
  nothing replaces it: a catch-up `syncFromDoc` overwrites a live widget value
  with the document's while a human edit's op is still in flight. If that
  window matters in practice, the fix is in `LiveGraphApplier.syncFromDoc`
  (skip widgets with pending own `set_widget` ops), not in the store.
- The largest distribution risk is unchanged: accidental cloud coupling in the
  same-origin `/ws` transport. Boundary tests plus at least one
  browser-observable E2E per shipping topology are required.

## Human write path (amended 2026-08-22, unchanged by the 2026-09-24 revision)

Concurrent human+agent co-editing of one shared doc is the product goal, so the
write path ships with the follower. The frontend adds, all on the critical
path:

1. **Mutation-to-op minting** — `docOpMinter` listens to `GraphIntent` events
   with `source === 'local'` and mints semantic ops stamped
   `[base_version, actor, op_id]`; `op_id` is minted once and never regenerated
   on retry.
2. **`doc_ops` sender** — `opSender` sends stamped ops with `base_version`
   tracking; retries re-send the same op. A paused tab parks batches rather
   than dropping them ([CRDT-WRITE-0035](CRDT-WRITE-0035-hold-pending-human-ops-across-tab-suspension.md)).
3. **Optimistic overlay** — pending local ops are presentation-only, cleared on
   _effect_ (the echoed `doc_update`, which the follower recognises by actor),
   never encoded as a Yjs update or merged into the shared doc.
4. **Echo-attribution guard** — the own-actor drop at the follower entry plus
   `agent-remote` provenance on everything the applier writes.

## Product gate and developer diagnostics (amended 2026-09-12)

The runtime product flag, not a build flag, controls follower transport. The
source of truth is `agentPanelStore.enabled`, also consumed by the docked panel
and the doc-op minter. `useAgentCrdtFollower` observes that store: disabled
means no client, applier, subscription or operation sender; enablement starts
one scoped follower; revocation synchronously disposes it, including listeners,
retries and graph watchers. Re-enabling starts a new lifetime against the
current workflow.

```text
PostHog agent-in-app-experience ─┐
existing development override ──┴─> agentPanelStore.enabled
                                      ├─> docked panel mount
                                      ├─> follower lifetime / transport
                                      └─> doc-op minting

crdtDebug URL / saved choice ─> diagnostics resolver ─┐
agentPanelStore.enabled ──────────────────────────────┴─> debug panel

host document updates ─> follower ─> live graph API ─> stores / canvas
human semantic operations ─> host applier (never raw shared-doc writes)
```

| Surface       | Product transport control                               | Diagnostics                                              |
| ------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| Cloud         | `agentPanelStore.enabled`                               | Existing production-hostname denial on `cloud.comfy.org` |
| Desktop       | Same store; no distribution bypass                      | Existing `crdtDebug` resolver                            |
| Local ComfyUI | Same store; no distribution bypass                      | Existing `crdtDebug` resolver                            |
| Dev/ephemeral | Same store, including the existing development override | URL-controlled; existing development default retained    |

`?crdtDebug=1` enables diagnostics on allowed hosts; `?crdtDebug=0` disables
them. Diagnostics cannot enable follower transport, and disabling diagnostics
does not disable product transport. The debug panel consumes a read-only
snapshot callback; the `doc_update` dev event carries an `echo` flag for frames
dropped as own echoes.

This frontend gate is not a server authorization boundary. No Local or Desktop
transport is claimed operational solely because its feature gate is enabled.

## Notes

This ADR mirrors two cross-repo workspace decisions (ADR-010 follower
direction, ADR-011 one-branch distribution strategy) into the repository they
govern. It relates to [CRDT-LAYOUT-0003](CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md)
and [ECS-0008](ECS-0008-entity-component-system.md). Linear FE-1330 tracked
the store-migration dependency the original text had; that dependency no
longer exists.

[PM-1293](https://linear.app/comfyorg/issue/PM-1293) proposed a competing
redesign of widget ownership and node replacement between the agent applier
and litegraph, built on the store-first layer. FE-2504 resolves it by removing
the store-first layer that redesign would have reshaped; the widget-in-flight gap it identified survives
as the locally-dirty consequence above.

Files under `src/workbench/extensions/agent/crdt/` that carry this decision:
`docFrameClient`, `followerDoc`, `schemaGuard`, `docChangeCollector`,
`liveGraphApplier`, `agentCrdtProjection`, `docOpMinter`, `opSender`,
`opCoalescer`, `batchPlacement`, `layoutFollowerBridge`, and the
`useAgentCrdtFollower` orchestrator. `ecsFollowerAdapter`, `graphMutations`,
`agentNodeMaterializer`, `pendingOpLedger`, and `followerGate` were deleted.

### Glossary

- **Product gate:** the existing agent feature flag resolved into the panel store.
- **Follower lifetime:** resources between product enablement and disablement or unmount.
- **Diagnostics:** the optional debug panel, snapshot and logging controls.
- **CRDT:** conflict-free replicated data type; here, the host-produced Yjs document.
- **Distribution:** the build's cloud, desktop or localhost endpoint/configuration category,
  not a rollout decision.
- **Provenance:** the `GraphIntentSource` (`local` | `agent-remote` | `load`) and layout actor
  under which a graph-API call runs.
