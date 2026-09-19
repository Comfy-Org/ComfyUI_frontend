# ADR-CRDT-TITLE-0035: Session-Local Node Title Customization Flag

Date: 2026-09-19

## Status

Proposed

## Context

PM-1296/PM-1297: renaming a node on the canvas and then asking the in-app
agent to make an unrelated edit nearby silently reverts the rename. The next
agent-driven graph update — even one that never touches the renamed node's
title — overwrites it back to the node's registered display name or type.
[#18065](https://github.com/Comfy-Org/ComfyUI_frontend/pull/18065) adds a
`test.fail()` repro (`browser_tests/tests/agent/agentConversationReplay.spec.ts`,
`title reset on reconcile`) that renames the seed `KSampler` node through the
real canvas title editor, replays a recorded conversation turn whose only
graph edit is `set_widget('steps')` on that same node, and asserts the custom
title survives. It currently does not.

### Root cause

Two independent gaps compound:

1. **Title has no CRDT wire op.** The frozen op vocabulary from
   `@comfyorg/comfy-multi-player` (`add_node`, `connect`, `set_widget`,
   `delete_node`, `clear`) writes title only once, as part of `add_node`'s
   initial snapshot. Nothing in the vocabulary can update it afterward.
   `src/workbench/extensions/agent/crdt/ecsFollowerAdapter.ts` still lists
   `'title'` in `RESYNCED_NODE_FIELDS` (a doc-side by-key edit would trigger a
   resync), but no frontend write path ever produces that edit, so in
   practice the doc's `title` entry for a node is frozen at whatever
   `add_node` wrote.
2. **Reconcile always re-derives title from the doc, not from live state.**
   `ecsFollowerAdapter.ts` calls `readSemanticNode(doc, id, ...)` fresh on
   _every_ reconcile-triggering doc change — a widget edit, a link change, an
   unrelated scalar-field resync — regardless of which key actually changed.
   The resulting payload's `title` is therefore always the frozen add-time
   value. `src/workbench/extensions/agent/crdt/graphMutations.ts`'s
   `prepareNode()` feeds that payload straight into
   `nodePayload.ts`'s `nodeTitle(payload.title, payload.type)`
   (`title: nodeTitle(payload.title, payload.type)`, `graphMutations.ts:242`)
   with no fallback to the node's current/incumbent title. A rename made
   through the canvas UI (`LGraphNode.title = ...`) only ever reaches the
   local `nodeDataStore`; it is never written into the shared Yjs doc. The
   very next reconcile — triggered by anything — reads the doc's stale
   add-time title and overwrites the local rename.

Title is written from at least six call sites with no single choke point,
unlike widgets and links, which funnel through `isRemoteMutationContext`
gated store actions. Section
["Write-site audit"](#write-site-audit-user-rename-vs-default-assignment)
below classifies all six.

### Why "always fall back to the incumbent title" is wrong

An earlier draft (#16964) made `prepareNode` unconditionally keep
`existing.title` whenever the reconcile payload had none. This caused a real
regression (FE-2265): an untitled reconcile of a plain catalog node (e.g.
`CheckpointLoaderSimple`) kept a stale `configure()`-time display name
(`Load Checkpoint`) instead of resetting to the registered type default. A
draft follow-up, #17499 (`fix(graph): scope untitled reconcile title keep to
subgraphs`, branched from `fix/agent-subgraph-instance-reconcile`, **not
merged, not based on current `main`** — its file,
`src/core/graph/graphMutations.ts`, no longer exists; the code now lives at
`src/workbench/extensions/agent/crdt/graphMutations.ts`), narrows that
fallback to subgraph-instance nodes only, because a subgraph's `type` is a
UUID with no registered display name, so "reset to type" is meaningless there
in a way it is not for a catalog node.

The mechanism both PRs share — guessing "the user wants their title kept"
from "the payload happens to omit one" — is the actual defect. `payload.title`
being absent is not evidence of anything about user intent; it is evidence
only that a particular doc snapshot happened not to carry the key. The signal
this decision needs is explicit: _did a human deliberately set this title_,
independent of whatever the payload does or doesn't carry.

### Options previously scoped (see PR #18065 review comments)

- **A — New CRDT op** (`update_node`/`set_title`). The correct, general fix:
  extend the frozen op vocabulary, add an applier, bump `SCHEMA_VERSION` with
  a migration, add a title mint port mirroring `widgetMintPort.ts` /
  `linkMintPort.ts`. Requires cross-repo changes in `comfy-cli` and
  `@comfyorg/comfy-multi-player` that cannot be made from this repo alone.
  Out of scope here.
- **B — Local "customized" flag** (this ADR). Track, outside the CRDT
  document, that a node's title was deliberately human-set; consult it only
  in `prepareNode`. Fixes the common single-active-session case. Does not
  survive a reload or reach another collaborator's client, because the
  signal never enters the replicated document.
- **C — Session-local suppression set.** An in-memory "renamed this session"
  set of node ids that the reconcile _applier_ (rather than `prepareNode`)
  consults to skip re-applying a materializer title to already-known nodes.
  Strictly weaker than B for comparable effort: it is a parallel, narrower
  mechanism (skip re-title vs. explicitly compose with the existing
  subgraph-fallback branch) that still doesn't touch the wire protocol, so it
  buys nothing A doesn't already justify and B doesn't already provide more
  precisely.

**Decision: build Option B.** A is blocked on cross-repo work this repo
cannot unilaterally do; C is strictly weaker than B for the same rough
effort and gives up precision (a boolean per node vs. a bespoke suppression
set) for no offsetting benefit.

## Decision

### The signal: a dedicated Pinia store, not instance state

Per ADR-ECS-0008 rule 2 ("dedicated stores over instance state") and rule 3
("no god-object growth" — never add properties or methods to `LGraphNode`),
the "this node's title was deliberately human-set" fact lives in a new,
narrowly-scoped store, `nodeTitleCustomizationStore`
(`src/stores/nodeTitleCustomizationStore.ts`), not as a field on `LGraphNode`
or `NodeState`.

This is one authoritative fact per node — present or absent, nothing else —
so the store holds a `Set` of composite keys, not a boolean map (an absent
entry already means "not customized"; a map would let `false` entries
accumulate forever for every node that was ever reconciled). Per
`docs/guidance/state-and-effects.md` §6 and the existing `nodeDataStore` /
`widgetValueStore` convention, node ids are graph-local, so the key is a
root-graph-scoped composite, not a bare `NodeId`:

```ts
// src/stores/nodeTitleCustomizationStore.ts
import { defineStore } from 'pinia'
import { reactive } from 'vue'

import type { RootGraphId } from '@/types/graphScopeId'
import type { NodeId } from '@/types/nodeId'

export const useNodeTitleCustomizationStore = defineStore(
  'nodeTitleCustomization',
  () => {
    // rootGraphId -> set of NodeId whose title was deliberately human-set
    const customizedByRoot = reactive(new Map<RootGraphId, Set<NodeId>>())

    function markCustomized(rootGraphId: RootGraphId, nodeId: NodeId): void {
      let ids = customizedByRoot.get(rootGraphId)
      if (!ids) {
        ids = new Set()
        customizedByRoot.set(rootGraphId, ids)
      }
      ids.add(nodeId)
    }

    function isCustomized(rootGraphId: RootGraphId, nodeId: NodeId): boolean {
      return customizedByRoot.get(rootGraphId)?.has(nodeId) ?? false
    }

    function clearNode(rootGraphId: RootGraphId, nodeId: NodeId): void {
      const ids = customizedByRoot.get(rootGraphId)
      if (!ids) return
      ids.delete(nodeId)
      if (ids.size === 0) customizedByRoot.delete(rootGraphId)
    }

    function clearGraph(rootGraphId: RootGraphId): void {
      customizedByRoot.delete(rootGraphId)
    }

    return { markCustomized, isCustomized, clearNode, clearGraph }
  }
)
```

No new instance properties or methods on `LGraphNode`/`LGraphCanvas`/`LGraph`
result from this change (ADR-ECS-0008 rules 2–3). This is a plain boolean
fact per node id, so it needs no discriminated union or reducer per
`docs/guidance/state-and-effects.md` §1 — that guidance targets multi-step
workflows with several facts that must agree; here there is exactly one fact,
and a `Set` membership check already makes the "false" state unrepresentable
as anything other than absence.

### Write-site audit: user rename vs. default assignment

Six call sites write `LGraphNode.title` (or a static class `title`) today.
Each is classified by whether it represents a human deliberately choosing a
name, or code assigning a default:

| Site                                                                                             | What it does                                                                                                                                                                                                                                                                                           | Sets the flag?                                                                                                                          |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/extensions/vueNodes/composables/useNodeEventHandlers.ts` (`handleNodeTitleUpdate`) | Vue-canvas node title editor commit. The exact path #18065's repro uses.                                                                                                                                                                                                                               | **Yes**                                                                                                                                 |
| `src/components/rightSidePanel/RightSidePanel.vue` (`handleTitleEdit`)                           | Right-side-panel title field. Operates on `selectedGroups.value[0] \|\| selectedNodes.value[0]` — the target can be an `LGraphGroup`, which has no `NodeId`/CRDT representation.                                                                                                                       | **Yes, guarded**: only when the edited item is an `LGraphNode` (e.g. `'graph' in target` or an `isLGraphNode` check), never for a group |
| `src/components/breadcrumb/SubgraphBreadcrumb.vue` (`updateTitle`)                               | Renaming a subgraph via its breadcrumb tab applies the new name to **every** live `SubgraphNode` instance of that subgraph definition, via `forEachSubgraphNode`.                                                                                                                                      | **Yes**, once per instance visited by `forEachSubgraphNode`                                                                             |
| `src/lib/litegraph/src/LGraphCanvas.ts` (`fUpdate`, case `'Title'`, ~line 8421)                  | The legacy (non-Vue) canvas's node-properties panel title field. `LGraph.ts` already imports `clearNodeOwnedStoreState` (a Pinia store call) at this same layer, so a store call from litegraph-core is an established pattern, not a new architectural seam.                                          | **Yes**                                                                                                                                 |
| `src/services/litegraphService.ts` (~lines 527, 634)                                             | `node.title = nodeDef.display_name \|\| nodeDef.name` — assigns the **default** title on the node _type's constructor_ during node-type registration (`node` here is a class, not an instance). No `NodeId` exists to key on, and it is exactly the default this feature must remain free to reassert. | **No**                                                                                                                                  |
| `src/extensions/core/widgetInputs.ts` (~line 673)                                                | Auto-creates a `PrimitiveNode` when a widget input is double-clicked and names it after the input it feeds (`node.title = input.name`). This is a system-chosen default for a brand-new node, not a user editing an existing node's identity.                                                          | **No**                                                                                                                                  |

### What sets it and when

Only the four confirmed user-rename call sites call
`nodeTitleCustomizationStore.markCustomized(rootGraphId, nodeId)`, resolving
`rootGraphId` the same way `clearNodeOwnedStoreState` already does
(`graphScopeOf(node.graph)`, or `graph.isRootGraph ? graph.id : graph.rootGraph.id`
where a full `GraphScope` is not otherwise in scope). No new event or
composable is introduced for this — it is one extra call inside each existing
handler.

### What clears it: node deletion, via the existing removal choke point

`src/stores/clearNodeOwnedStoreState.ts` already exists precisely for this
purpose: "clear per-node-id local store state when a node is removed,
regardless of which removal path fired." It is called from exactly two
places, both of which cover every node-removal path in the app:

- `src/lib/litegraph/src/LGraph.ts`'s `fireNodeRemovalLifecycle()` — the
  function `LGraph.remove()` (and its callers) always goes through. This
  covers manual/UI deletion **and** the agent's CRDT-driven deletion: when
  `agentNodeMaterializer.ts` detects a node that is no longer present in the
  reconciled `nodeStore` records (an "orphan"), it calls
  `graph.remove(orphan, { preserveCanonicalState: true })`, which still fires
  this same lifecycle.
- `src/platform/nodeReplacement/useNodeReplacement.ts` — node-type
  replacement, which tears down and reconstructs the `LGraphNode` instance
  for the same id.

Adding `useNodeTitleCustomizationStore().clearNode(rootGraphId, nodeId)`
inside `clearNodeOwnedStoreState()` (alongside the existing
`widgetValueStore().clearNode(...)` and `previewExposureStore().clearHost(...)`
calls) gives the new store the same cleanup guarantee `widgetValueStore`
already has, with no new call sites and no risk of missing a removal path:
node ids are reused after deletion (`nodeDataStore` bucket eviction, layout
key reuse), so a stale entry is not just a leak — it would eventually flag an
unrelated future node at the same id as "customized" for no reason.

### Where the flag is read: `prepareNode` in `graphMutations.ts`

`prepareNode()` (`src/workbench/extensions/agent/crdt/graphMutations.ts:229`)
gains one additional condition ahead of the existing
`nodeTitle(payload.title, payload.type)` fallback:

```ts
function prepareNode(
  payload: SemanticNodePayload,
  scope: GraphScope,
  existing?: NodeState
): PreparedNode {
  const id = toNodeId(payload.id)
  const keepCustomizedTitle =
    existing !== undefined &&
    existing.type === payload.type &&
    useNodeTitleCustomizationStore().isCustomized(scope.rootGraphId, id)
  // ...
  const state: NodeState = {
    // ...
    title: keepCustomizedTitle
      ? existing.title
      : nodeTitle(payload.title, payload.type)
    // ...
  }
  // ...
}
```

Two details make this compose correctly with the existing/#17499 behavior
rather than fight it:

1. **The `existing.type === payload.type` guard.** `prepare()`'s caller
   already computes, _after_ `prepareNode()` returns, whether this upsert is
   really a `replaceNode` (`existing && existing.type !== node.state.type`).
   A type change means the id is being reused for what is semantically a
   different node — keeping the old type's human title on a freshly
   materialized different type would repeat the exact FE-2265 mechanism this
   ADR is designed to avoid, just gated by a different signal. Checking the
   type match _inside_ `prepareNode` (where both `existing` and `payload` are
   already in hand) means `prepareNode` alone decides correctly without the
   caller needing to unwind a title choice it already made.
2. **Independence from the (unmerged) subgraph-only fallback.** If/when
   #17499's `!hasTitle(payload) && isUuidShapedSubgraphId(payload.type)` gate
   lands (in whatever file it ends up in after rebasing off
   `src/workbench/extensions/agent/crdt/graphMutations.ts`), it becomes a
   second, independently-true-able condition guarding the same
   `existing.title` assignment — `keepCustomizedTitle || keepSubgraphTitle`.
   The two conditions never conflict: a customized subgraph instance
   satisfies both and keeps its title either way; an uncustomized, untitled
   subgraph instance is covered by #17499's gate alone; an uncustomized,
   untitled catalog node is covered by neither and correctly resets to type.
   This ADR's change does not depend on #17499 merging first, and does not
   need to change if #17499 merges after it — the two gates are additive,
   not sequential.

### The agent's own title-setting does not need to set the flag

`agentNodeMaterializer.ts`'s `materialize()` never sets a title
independently — it only _consumes_ `state.title`, which `prepareNode` has
already resolved, to instantiate the live node
(`LiteGraph.createNode(state.type, state.title)`, line 256). There is no
separate "the agent renamed this node" call site distinct from the
`add_node`/`reconcileNode`/`reconcileNodeFields` payload path already
covered above.

If the agent supplies an explicit `title` on `add_node`, that value is
written into the doc's node-map entry once and — per the root cause above —
is never overwritten by any later wire op. Every subsequent
`readSemanticNode` reconcile re-reads that same frozen value and
`nodeTitle(payload.title, payload.type)` returns it unchanged. There is
nothing here for a "customized" flag to protect against: the agent's own
title is already stable across reconciles by construction, because the doc
is the single source that both wrote it and keeps re-asserting it. Flagging
the agent's own writes as "customized" would blur what the flag means
(protection against the agent's _own_ future reconcile) without preventing
any loss, since there is no loss to prevent on that path. The flag is set
exclusively by the four human-rename UI call sites in the table above, so
the agent can never flag its own writes and therefore can never end up
"fighting itself" over a title it set.

## Consequences

### Positive

- Fixes the exact regression #18065 reproduces: a manual rename now survives
  the next unrelated agent reconcile, for the remainder of the live session.
- No change to the frozen CRDT op vocabulary, `SCHEMA_VERSION`, or any
  cross-repo contract (`comfy-cli`, `@comfyorg/comfy-multi-player`).
- Composes with, and does not block or get blocked by, #17499's narrower
  subgraph-instance fallback landing before or after this change.
- Follows ADR-ECS-0008: a dedicated, node-id-keyed store with an established
  cleanup hook, no new `LGraphNode`/`LGraphCanvas`/`LGraph` methods or
  properties.

### Negative

- **Does not survive a reload.** `nodeTitleCustomizationStore` is
  session-local Pinia state, not written to the Yjs doc. Reloading the page
  (or the agent's doc-host restarting) loses the flag, and the next reconcile
  will re-derive the title from the doc as if the rename never happened. This
  is explicitly Option A's job, not this ADR's.
- **Does not reach another collaborator's client.** The signal lives only in
  the browser tab that performed the rename; a second collaborator viewing
  the same live document has no way to learn "this title was deliberately
  set" and will see it reset on their own next reconcile-triggering event, if
  their client independently re-derives title from the doc.
- One more per-node store to keep in sync with node lifecycle, though it
  reuses the existing `clearNodeOwnedStoreState` hook rather than adding a
  new one.
- `RightSidePanel.vue`'s `handleTitleEdit` must special-case "is this an
  `LGraphNode`, not an `LGraphGroup`" to call the new store correctly; this
  is a small but real new branch in a call site that previously treated both
  targets identically for `.title = ...` assignment.

## Alternatives Considered

- **Option A — new CRDT op.** The correct long-term fix; tracked separately.
  Requires `comfy-cli` and `@comfyorg/comfy-multi-player` changes (new op in
  the frozen vocabulary, an applier, a `SCHEMA_VERSION` bump with migration,
  a title mint port) that a frontend-only PR cannot deliver. Revisit once
  that cross-repo work is scheduled; this ADR's flag can then be simplified
  away or left as a client-side optimization that avoids waiting on the
  round trip.
- **Option C — session-local suppression set consulted by the applier.**
  Narrower than B: an in-memory "renamed this session" set of node ids that
  the reconcile _applier_ (rather than `prepareNode`) checks to skip
  re-applying a materializer title. Rejected because it is a second,
  parallel mechanism with the same session-only limitation as B, but without
  B's precision — it has no analog to the `existing.type === payload.type`
  guard, so it either also needs that guard duplicated at the applier layer,
  or accepts the type-change edge case FE-2265 already burned the team on.
  Given equivalent effort, B is a strict improvement.

## Notes

### Related PRs

- [#18065](https://github.com/Comfy-Org/ComfyUI_frontend/pull/18065) — the
  `test.fail()` repro this ADR's implementation fixes.
- [#16964] (referenced in #18065's history, not independently verified here)
  — the original unconditional-fallback attempt that caused FE-2265.
- [#17499](https://github.com/Comfy-Org/ComfyUI_frontend/pull/17499) — draft,
  **not merged**, based on the stale `fix/agent-subgraph-instance-reconcile`
  branch and a file path (`src/core/graph/graphMutations.ts`) that no longer
  exists on `main`. Its logic (scope the untitled-reconcile keep to
  UUID-shaped subgraph types via `isUuidShapedSubgraphId`) is the precedent
  this ADR composes with; it will need rebasing onto
  `src/workbench/extensions/agent/crdt/graphMutations.ts` regardless of
  whether it lands before or after this ADR's implementation.

## Implementation Plan

### New files

- `src/stores/nodeTitleCustomizationStore.ts` — the store defined above.
- `src/stores/nodeTitleCustomizationStore.test.ts` — unit tests for
  `markCustomized` / `isCustomized` / `clearNode` / `clearGraph`, including
  the root-graph-scoping case (same `NodeId` under two different
  `RootGraphId`s must be independently customized/cleared).

### Modified files

- `src/workbench/extensions/agent/crdt/graphMutations.ts`
  - `prepareNode()`: add the `keepCustomizedTitle` condition and branch
    described above.
- `src/renderer/extensions/vueNodes/composables/useNodeEventHandlers.ts`
  - `handleNodeTitleUpdate()`: call
    `useNodeTitleCustomizationStore().markCustomized(rootGraphId, nodeId)`
    after `node.title = newTitle` (resolve `rootGraphId` via
    `graphScopeOf(node.graph)` or the existing
    `graph.isRootGraph ? graph.id : graph.rootGraph.id` pattern).
- `src/components/rightSidePanel/RightSidePanel.vue`
  - `handleTitleEdit()`: same call, guarded to only fire when the edited
    target is an `LGraphNode` (skip for `LGraphGroup`).
- `src/components/breadcrumb/SubgraphBreadcrumb.vue`
  - `updateTitle()`: call once per node visited inside the existing
    `forEachSubgraphNode(rootGraph, subgraph.id, (node) => { ... })`
    callback.
- `src/lib/litegraph/src/LGraphCanvas.ts`
  - `fUpdate`, case `'Title'`: same call, resolving `rootGraphId` from
    `node.graph` the same way `LGraph.ts` already does for
    `clearNodeOwnedStoreState`.
- `src/stores/clearNodeOwnedStoreState.ts`
  - Add `useNodeTitleCustomizationStore().clearNode(rootGraphId, nodeId)`
    alongside the existing `widgetValueStore().clearNode(...)` call.
- `docs/adr/README.md` — index entry for this ADR (done as part of this
  change).

### Test plan

- **New unit tests, `src/stores/nodeTitleCustomizationStore.test.ts`**: the
  store's four operations in isolation (see above).
- **Modified unit test,
  `src/workbench/extensions/agent/crdt/graphMutations.test.ts`**: the
  existing table-driven case
  `it.for([...])('titles a reconciled $type node with $title as $expected', ...)`
  (around line 236) currently only varies `title`/`type`/`expected`. It needs
  a `customized: boolean` column so it proves both branches of the new gate,
  e.g.:
  - `{ customized: false, title: undefined, type: 'ContractSampler', expected: 'Contract Sampler' }`
    (unchanged existing behavior)
  - `{ customized: true, title: undefined, type: 'ContractSampler', expected: 'Before' }`
    (new: customized node keeps its incumbent title even though the payload
    carries none)
  - `{ customized: true, title: 'FromPayload', type: 'ContractSampler', expected: 'Before' }`
    (new: customized node keeps its incumbent title even when the payload
    _does_ carry one — the flag means "ignore the payload's title", not
    merely "fill in when absent")
  - `{ customized: true, title: undefined, type: 'DifferentType', expected: 'Different Type' or type default }`
    (new: a type change resets title even when customized, proving the
    `existing.type === payload.type` guard)
    Each `customized: true` case calls
    `useNodeTitleCustomizationStore().markCustomized(scope.rootGraphId, toNodeId(1))`
    before the `batch.reconcileNode(...)` call, mirroring how `addNode` seeds
    the "Before" title in the existing cases.
    Add one more standalone test proving node deletion clears the flag: mark a
    node customized, delete it via `batch.deleteNode(...)`, re-add a node at
    the same id with no title, and assert it gets the type default rather than
    the stale customized title (the memory-leak/reused-id scenario the cleanup
    hook exists to prevent). This test belongs in `graphMutations.test.ts`
    because it is really exercising `clearNodeOwnedStoreState`'s effect through
    the same store the reconcile path reads; a note on the test should point
    back to `clearNodeOwnedStoreState.ts` so the two aren't read as unrelated.
- **Playwright**,
  `browser_tests/tests/agent/agentConversationReplay.spec.ts`: once the
  implementation above lands, the `title reset on reconcile` test's
  `test.fail(...)` call (line ~64) should be replaced with a plain `test(...)`
  and the test should pass. Its CI-run confirmation blocker noted in
  #18065's PR description (sandbox egress cannot reach the CI video/log
  storage host or GHCR to run this spec against a real backend locally) is a
  **separate, pre-existing** issue with verifying the _repro_ test itself on
  this branch — it does not block or get resolved by this implementation
  work, and should not be conflated with it. Flipping `test.fail()` to
  `test()` still needs a real CI run (not a local sandbox run) to confirm
  green, same as the repro PR itself needed for red.
