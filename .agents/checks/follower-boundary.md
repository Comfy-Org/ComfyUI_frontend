---
name: follower-boundary
description: Checks in-app-agent CRDT follower code against the load-bearing follower/distribution invariants in ADR-CRDT-FOLLOWER-0025 (and ADR-CRDT-LAYOUT-0003)
severity-default: high
tools: [Read, Grep, glob]
---

Check changes under `src/workbench/extensions/agent/**` (and anything importing
`@comfyorg/comfy-multi-player` or the agent CRDT seam) against the follower invariants in
[ADR-CRDT-FOLLOWER-0025](../../docs/adr/CRDT-FOLLOWER-0025-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md) and the CRDT
layout split in [ADR-CRDT-LAYOUT-0003](../../docs/adr/CRDT-LAYOUT-0003-crdt-layout-intent-and-local-measurement.md).

These are load-bearing: a low-context change that violates one can silently foreclose the
future P2P / offline / multi-writer / multi-agent story, reintroduce a second model of the
graph that then needs reconciling, or ship a follower that renders in one distribution and
fails as a product in another. Flag violations as `issue:` (blocking), name the exact
file/symbol, and link the ADR.

## Priority 1: the follower never writes the shared doc

The follower is read-only. Raw Yjs updates flow host to follower one-way only; a follower
integrates a host-produced `doc_update` and renders it, it does not author into the shared
document.

Flag:

- **Follower-side writes to the shared semantic doc** — any `Y.Doc` / `Y.Map` / `Y.Array`
  `.set(...)`, `.push(...)`, `.delete(...)`, or `Y.applyUpdate(sharedDoc, ...)` on the
  shared/semantic document in follower code paths (`useAgentCrdtFollower`,
  `agentCrdtProjection`, `liveGraphApplier`, `docChangeCollector`). The follower may only
  `applyUpdate` into the **local** follower doc that drives render, never into the shared
  doc that the host owns.
- **Sending struct/`update_b64` frames from the client** — the client emits stamped
  semantic ops (`doc_ops`) on the human path only; it never sends raw Yjs binary
  (`update_b64`) upstream. Flag any client code constructing/sending `update_b64`.
- **A second writer path smuggled in** — new code that lets a remote apply reach the doc
  or the wire, e.g. a remote-applied change that mints a `doc_ops` op (a remote write
  running outside `withGraphIntentSource('agent-remote', ...)` will), or a placement /
  layout correction that is sent back to the host.

## Priority 2: state seam — the graph API, not the stores; layout stays separate

Per FOLLOWER the follower is an adapter that replays the host's already-applied document
onto the live `LGraph` through litegraph's graph API (`graph.add`, `graph.remove`,
`node.configure`, `origin.connect`, `graph.removeLink`, widget `setValue`) with
call-carried provenance. The Pinia stores update as a consequence of those calls, exactly
as for a human edit. Writing the stores first and expecting litegraph to adopt the result
is the pattern FE-2504 removed; it creates a second model and an open-ended
reconciliation surface.

Flag:

- **Direct store writes from follower code** — `useNodeDataStore().registerNode/deleteNode/...`,
  `useLinkStore().registerLink/replaceLink/deleteLink/...`,
  `useLayoutStore().applyOperation({ type: 'createNode' | 'deleteNode' ... })`, or a
  `useWidgetValueStore().setValue` for a widget the live node exposes, called from
  `src/workbench/extensions/agent/crdt/**` for a remote change. The one accepted exception
  is `liveGraphApplier`'s promoted-widget write on a subgraph host, where the host node has
  no live widget instance to set.
- **Agent-only parameters or hooks on shared layers** — a trailing `context?` /
  `RemoteMutationContext`-style parameter on a store action, a `preserveCanonicalState` /
  successor option on `LGraph.remove`, an adapter-materialize helper on `LLink`, a
  "locally dirty" register in a store, or any method on `LGraph` / `LGraphNode` / `LLink`
  whose only caller is the follower. `src/lib/litegraph` and `src/stores` must not mention
  the agent, the follower, or remote apply (except `idAllocation.ts`'s `crdt-disjoint`
  policy and the generic `graphIntents.ts` funnel).
- **A store-level reconciliation pass** — any code that diffs a snapshot of the stores
  against the live graph or the document and patches one to match the other
  (`reconcile*`, `resync*`, snapshot-diff, slot-array merge). The applier reads the
  document's own change set (`DocChangeCollector`) for incremental frames. For catch-up,
  `syncFromDoc` drives the live graph to the document through the graph API: it adds,
  updates, and removes graph entities, sparing only the local human's pending edits
  (`PendingLocalEdits`). It never patches stores or "corrects" store state directly.
- **Remote writes outside the provenance scope** — a graph-API call for a remote change
  that runs outside `withGraphIntentSource('agent-remote', ...)` / `withRemoteActor`, or
  asynchronous work started inside that scope and finished later (it will be attributed
  `local` and minted back).
- **A second no-echo mechanism** — code that inspects ops, timestamps, or store deltas to
  guess whether a frame is the sender's own. The follower drops an own-actor,
  non-catch-up `doc_update` at its entry (`isOwnEcho`); everything past that point is
  remote by definition.
- **Layout/view fields written into the shared semantic doc** — `pos`, `size`, pan/zoom,
  live drags, or group geometry placed in the semantic doc. Layout is a separate FE-owned
  `Y.Doc` (LAYOUT, KEEP-ALIVE #8); the two docs are composed, not merged. The applier sets
  `node.pos` once at insertion and excludes `pos`/`size` from later field sync.
- **Presence/awareness persisted into the doc** — cursors/selection/hover belong on the
  awareness channel, never written into the shared or layout doc.
- **Optimistic overlay merged back as a Yjs update** — pending local ops are
  presentation-only, cleared on effect (the own-actor echo) not ack, and never encoded as
  a Yjs update or merged into the shared doc.

## Priority 3: op identity and a single applier

Flag:

- **`op_id` regeneration on retry** — `op_id` is minted once by the creator (uuid) before
  dispatch and never regenerated; it is the final LWW tiebreak. Flag any code that re-mints
  an `op_id` on resend/retry, or resolves conflicts by client-id instead of the
  `[base_version, actor, op_id]` stamp.
- **Full-document replace as the mutation primitive** — re-sending or reloading the whole
  doc per edit instead of applying ops/updates incrementally.
- **A second applier implementation** — op-to-doc / conflict-resolution logic reimplemented
  in the frontend instead of importing the single shared `@comfyorg/comfy-multi-player`
  package (pinned by SHA). `LiveGraphApplier` is a doc-to-graph adapter, not an applier;
  it must never decide what the document says, only replay it.
- **Minting from anything but `GraphIntent`** — `docOpMinter` mints from the graph-API
  funnel's `local` intents. Code that mints from store subscriptions, layout changes, or
  litegraph callbacks reintroduces the delta-inference path.
- **Branch-pinned catalog/vocabulary citation** — referencing the widget catalog by moving
  branch instead of a pinned SHA.

## Priority 4: distribution seam — one boundary, unified auth

Per FOLLOWER the follower APPLY path is distribution-agnostic; surface differences
(endpoint, ingest-vs-direct route, auth) live behind one small distribution-resolved
boundary keyed on `DISTRIBUTION`.

Flag:

- **`DISTRIBUTION` / `isCloud` / `isDesktop` checks scattered through follower core** —
  distribution conditionals inside the CRDT apply seam, `DocFrameClient`, or rendering.
  They belong only in the agent connection/configuration boundary.
- **Auth reduced to `isCloud`** — resolving credentials by distribution instead of
  delegating to the unified chain `authStore.getAuthHeader()`. Local and Desktop are
  authenticated product surfaces, not "anonymous / model-key-only".
- **Dev/Vite behavior treated as Local product behavior** — Vite proxy or dev credentials
  placed in the Local or Desktop path. Dev-only wiring stays in Vite/dev config.
- **A hardcoded agent base URL** — an agent HTTP/WS endpoint string literal instead of a
  centralized distribution-resolved resolver (the `AGENT_BASE_URL`-style seam). Today the
  follower rides the centralized `api.socket`; a new direct-to-agent connection must
  resolve its endpoint through the seam, not a literal.

## Enforcement expectation

Seam violations should also fail loudly at runtime via the centralized `assert(cond, msg)`
from `src/base/assert.ts` (DEV throws, prod reports to Sentry), with a message that names
the broken invariant and links this ADR, e.g. `assert(!isFollower, 'followers never write
the shared doc — see FOLLOWER')`. Flag a follower-boundary change that adds no such guard
where one is warranted.
