---
name: follower-boundary
description: Checks in-app-agent CRDT follower code against the load-bearing follower/distribution invariants in FOLLOWER (and LAYOUT)
severity-default: high
tools: [Read, Grep, glob]
---

Check changes under `src/workbench/extensions/agent/**` (and anything importing
`@comfyorg/comfy-multi-player` or the agent CRDT seam) against the follower invariants in
[FOLLOWER](../../docs/adr/FOLLOWER-in-app-agent-crdt-follower-and-distribution-resolved-boundaries.md) and the CRDT
layout split in [LAYOUT](../../docs/adr/LAYOUT-crdt-layout-intent-and-local-measurement.md).

These are load-bearing: a low-context change that violates one can silently foreclose the
future P2P / offline / multi-writer / multi-agent story, or ship a follower that renders in
one distribution and fails as a product in another. Flag violations as `issue:` (blocking),
name the exact file/symbol, and link the ADR.

## Priority 1: the follower never writes the shared doc

The follower is read-only. Raw Yjs updates flow host to follower one-way only; a follower
integrates a host-produced `doc_update` and renders it, it does not author into the shared
document.

Flag:

- **Follower-side writes to the shared semantic doc** — any `Y.Doc` / `Y.Map` / `Y.Array`
  `.set(...)`, `.push(...)`, `.delete(...)`, or `Y.applyUpdate(sharedDoc, ...)` on the
  shared/semantic document in follower code paths (`useAgentCrdtFollower`, projector,
  bridge). The follower may only `applyUpdate` into a **local** follower doc that drives
  render, never into the shared doc that the host owns.
- **Sending struct/`update_b64` frames from the client** — the client emits stamped
  semantic ops (`doc_ops`) on the human path only; it never sends raw Yjs binary
  (`update_b64`) upstream. Flag any client code constructing/sending `update_b64`.
- **A second writer path smuggled in** — new code that lets the agent-follow path mutate
  graph state directly (e.g. `app.graph` mutation outside the disposable POC mutator, or a
  new "apply remote → mutate" path that bypasses the store seam).

## Priority 2: state seam — stores, not litegraph; layout stays separate

Per FOLLOWER the durable follower integrates updates into the yjs-backed FE domain stores
(the `layoutStore` pattern), and litegraph is a render target, not the state seam.

Flag:

- **New durable dependence on `LitegraphMutator` / snapshot-diff / `SemanticProjector`** —
  these are the disposable POC stopgap mounted with the flag-gated agent panel. New code
  that treats them as the permanent seam, or extends them instead of routing state into a
  domain store, should be questioned against FOLLOWER.
- **Layout/view fields written into the shared semantic doc** — `pos`, `size`, pan/zoom,
  live drags, or group geometry placed in the semantic doc. Layout is a separate FE-owned
  `Y.Doc` (LAYOUT, KEEP-ALIVE #8); the two docs are composed, not merged.
- **Presence/awareness persisted into the doc** — cursors/selection/hover belong on the
  awareness channel, never written into the shared or layout doc.
- **Optimistic overlay merged back as a Yjs update** — pending local ops on a shadow are
  presentation-only, cleared on effect not ack, and never encoded as a Yjs update or merged
  into the shared doc.

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
  package (pinned by SHA). There must be exactly one applier.
- **Branch-pinned catalog/vocabulary citation** — referencing the widget catalog by moving
  branch instead of a pinned SHA.

## Priority 4: distribution seam — one boundary, unified auth

Per FOLLOWER the follower APPLY path is distribution-agnostic; surface differences
(endpoint, ingest-vs-direct route, auth) live behind one small distribution-resolved
boundary keyed on `DISTRIBUTION`.

Flag:

- **`DISTRIBUTION` / `isCloud` / `isDesktop` checks scattered through follower core** —
  distribution conditionals inside the CRDT apply seam, domain stores, `DocFrameClient`, or
  rendering. They belong only in the agent connection/configuration boundary.
- **Auth reduced to `isCloud`** — resolving credentials by distribution instead of
  delegating to the unified chain `authStore.getAuthHeader()`. Local and Desktop are
  authenticated product surfaces, not "anonymous / model-key-only".
- **Dev/Vite behavior treated as Local product behavior** — Vite proxy or dev credentials
  placed in the Local or Desktop path. Dev-only wiring stays in Vite/dev config.
- **A hardcoded agent base URL** — an agent HTTP/WS endpoint string literal instead of a
  centralized distribution-resolved resolver (the `AGENT_BASE_URL`-style seam). Today the
  POC rides the centralized `api.socket`; a new direct-to-agent connection must resolve its
  endpoint through the seam, not a literal.

## Enforcement expectation

Seam violations should also fail loudly at runtime via the centralized `assert(cond, msg)`
from `src/base/assert.ts` (DEV throws, prod reports to Sentry), with a message that names
the broken invariant and links this ADR, e.g. `assert(!isFollower, 'followers never write
the shared doc — see FOLLOWER')`. Flag a follower-boundary change that adds no such guard
where one is warranted.
