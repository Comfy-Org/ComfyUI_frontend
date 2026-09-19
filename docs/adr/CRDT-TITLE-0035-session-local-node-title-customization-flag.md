# ADR-CRDT-TITLE-0035: Session-Local Node Title Customization Flag

Date: 2026-09-19

## Status

Accepted

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

| Site                                                                                             | What it does                                                                                                                                                                                                                                                                                           | Sets the flag?                                                                                                                       |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/renderer/extensions/vueNodes/composables/useNodeEventHandlers.ts` (`handleNodeTitleUpdate`) | Vue-canvas node title editor commit. The exact path #18065's repro uses.                                                                                                                                                                                                                               | **Yes**                                                                                                                              |
| `src/components/rightSidePanel/RightSidePanel.vue` (`handleTitleEdit`)                           | Right-side-panel title field. Operates on `selectedGroups.value[0] \|\| selectedNodes.value[0]` — the target can be an `LGraphGroup`, which has no `NodeId`/CRDT representation.                                                                                                                       | **Yes, guarded**: only when `selectedGroups.value[0]` is absent and `selectedNodes.value[0]` is the edited target, never for a group |
| `src/components/breadcrumb/SubgraphBreadcrumb.vue` (`updateTitle`)                               | Renaming a subgraph via its breadcrumb tab applies the new name to **every** live `SubgraphNode` instance of that subgraph definition, via `forEachSubgraphNode`.                                                                                                                                      | **Yes**, once per instance visited by `forEachSubgraphNode`                                                                          |
| `src/lib/litegraph/src/LGraphCanvas.ts` (`fUpdate`, case `'Title'`, ~line 8421)                  | The legacy (non-Vue) canvas's node-properties panel title field. `LGraph.ts` already imports `clearNodeOwnedStoreState` (a Pinia store call) at this same layer, so a store call from litegraph-core is an established pattern, not a new architectural seam.                                          | **Yes**                                                                                                                              |
| `src/services/litegraphService.ts` (~lines 527, 634)                                             | `node.title = nodeDef.display_name \|\| nodeDef.name` — assigns the **default** title on the node _type's constructor_ during node-type registration (`node` here is a class, not an instance). No `NodeId` exists to key on, and it is exactly the default this feature must remain free to reassert. | **No**                                                                                                                               |
| `src/extensions/core/widgetInputs.ts` (~line 673)                                                | Auto-creates a `PrimitiveNode` when a widget input is double-clicked and names it after the input it feeds (`node.title = input.name`). This is a system-chosen default for a brand-new node, not a user editing an existing node's identity.                                                          | **No**                                                                                                                               |

**Adversarial-review correction on the `RightSidePanel.vue` guard.** The
initial draft proposed `'graph' in target` (or an `isLGraphNode` check) to
tell an `LGraphNode` apart from an `LGraphGroup` in `handleTitleEdit`.
`LGraphGroup` also declares a public `graph` field, so that guard is always
true and never actually excludes a group. The fix branches on which selection
array actually held the edited target, mirroring the precedence
`handleTitleEdit` already uses to pick it (group over node): resolve
`group = selectedGroups.value[0]` and `node = selectedNodes.value[0]`
separately, keep the existing `target = group || node` for the rename itself,
and call `markCustomized` only in the `!group && node` branch — a group edit
never sets the flag, a node edit always does.

### What sets it and when

Only the four confirmed user-rename call sites call
`nodeTitleCustomizationStore.markCustomized(rootGraphId, nodeId)`, resolving
`rootGraphId` the same way `clearNodeOwnedStoreState` already does
(`graphScopeOf(node.graph)`, or `graph.isRootGraph ? graph.id : graph.rootGraph.id`
where a full `GraphScope` is not otherwise in scope). No new event or
composable is introduced for this — it is one extra call inside each existing
handler.

### What clears it: node deletion, via the existing removal choke point — plus one gap the review found

`src/stores/clearNodeOwnedStoreState.ts` already exists precisely for this
purpose: "clear per-node-id local store state when a node is removed,
regardless of which removal path fired." It is called from exactly two
places:

- `src/lib/litegraph/src/LGraph.ts`'s `fireNodeRemovalLifecycle()` — the
  function `LGraph.remove()` (and its callers) always goes through.
- `src/platform/nodeReplacement/useNodeReplacement.ts` — node-type
  replacement, which tears down and reconstructs the `LGraphNode` instance
  for the same id.

Adding `useNodeTitleCustomizationStore().clearNode(rootGraphId, nodeId)`
inside `clearNodeOwnedStoreState()` (alongside the existing
`widgetValueStore().clearNode(...)` and `previewExposureStore().clearHost(...)`
calls) gives the new store the same cleanup guarantee `widgetValueStore`
already has for **ordinary** removal (manual/UI deletion, and an agent
deletion where nothing later reoccupies the id): node ids are reused after
deletion (`nodeDataStore` bucket eviction, layout key reuse), so a stale entry
is not just a leak — it would eventually flag an unrelated future node at the
same id as "customized" for no reason.

**Blocking gap found in adversarial review: this hook does not fire on an
agent type-change reconcile.** `LGraph.ts`'s private `removeNode()` computes:

```ts
const successor =
  options.preserveCanonicalState &&
  this._nodes_by_id[node.id] !== node &&
  this._nodes_by_id[node.id] != null
    ? this._nodes_by_id[node.id]
    : undefined
// ...
if (!successor) clearNodeOwnedStoreState(node)
```

`agentNodeMaterializer.ts`'s `materialize()` — the exact `replaceNode`/
type-change path `prepareNode`'s `existing.type !== payload.type` guard
targets — builds the new-type node, sets `node.id = state.id` (the same id as
the stale node it is replacing), and calls `graph.add(node)`, which writes
`this._nodes_by_id[node.id] = node` immediately. Only afterward does
`reconcile()` remove the old orphan via
`graph.remove(orphan, { preserveCanonicalState: true })`. By then the id slot
already holds the new node, so `removeNode()`'s `successor` check is truthy
for the orphan's removal and `clearNodeOwnedStoreState` is skipped entirely.
The old node's customization flag for that id survives and wrongly protects
whatever new, differently-typed node the agent has just materialized at the
same id — precisely the case `prepareNode`'s `existing.type === payload.type`
guard exists to rule out, undermined at the layer below it.

This "successor" skip is deliberate and correct for the stores it was written
for: `widgetValueStore` and `previewExposureStore` must **not** be cleared
here, because by the time the orphan is removed, `graphMutations.ts`'s
`commit()` has already deleted the old node's entries and registered the new
node's own widgets under the same id (see `deleteNode()` →
`widgetStore.clearNode(...)` and the `replaceNode` branch's
`nodeStore.registerNode(...)` in `graphMutations.ts`); clearing again here
would wipe the brand-new data instead of the stale data. (This is exactly
what `agentNodeMaterializer.test.ts`'s existing
`'runs stale-node lifecycle without clearing successor-owned state'` test
guards.) The customization store is different in kind: nothing in
`graphMutations.ts`'s commit path knows about it or re-marks a node
customized on the agent's behalf (by design — see "The agent's own
title-setting does not need to set the flag" below), so there is no
freshly-written replacement value for a generic clear to protect. The correct
fix is therefore **not** to touch `LGraph.ts`'s successor-skip logic (that
would risk widening the blast radius onto stores that correctly rely on it
staying narrow), but to clear the flag at the one place that actually knows a
type-change replace is happening: `agentNodeMaterializer.ts` itself.

**Decision: fix at the materializer (Option a), not at `LGraph.ts` (Option
b).** `materialize()` already receives the stale node as its `orphan`
parameter precisely when this id is being reused for a replacement (as
opposed to a genuine delete, where no record shares the id and `orphan` is
`undefined`). Right after `graph.add(node)` succeeds — so a failed add,
whose rollback restores the orphan, does not prematurely clear a flag that
still correctly protects the still-live old node — `materialize()` calls
`useNodeTitleCustomizationStore().clearNode(scope.rootGraphId, state.id)`
whenever `orphan` is defined. This is small, targeted, colocated with the
exact code path that creates the ambiguity, and touches no logic any other
store depends on. The alternative (Option b: change `removeNode()`'s
successor-skip to still clear node-keyed store state even when a successor
exists) was rejected: it would either clear `widgetValueStore` and
`previewExposureStore` too (a real regression, undoing the "keep
successor-owned state" guarantee `graphMutations.ts`'s replace path relies
on) or require threading a "which stores are node-identity-scoped vs.
id-slot-scoped" distinction into `LGraph.ts` — solving a one-store problem by
adding a new concept to shared removal logic every other store must now
reason about.

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
- **Accepted limitation, found in adversarial review: an undo/redo clears
  every customization flag for the document, not just the undone rename.**
  `changeTracker.ts`'s `undo()`/`redo()` both call `updateState()`, which
  calls `app.loadGraphData(prevState, ...)` regardless of the `clean` flag
  undo/redo pass; `loadGraphData` unconditionally calls
  `this.rootGraph.configure(graphData)` with no `keep_old` argument, so
  `configure()`'s `clearGraph` is always `true` there. `configure()` then
  calls `this.clear()` → `resetAfterClear()`, which — for a root graph —
  unconditionally mints a fresh id: `this.id = createUuidv4()`. Since
  `nodeTitleCustomizationStore` is keyed by `RootGraphId` (per the
  established `nodeDataStore`/`widgetValueStore` convention, to avoid
  cross-document node-id collisions), every undo or redo action orphans the
  entire customization map for that document under the old id: the map entry
  under the old `RootGraphId` becomes unreachable (a harmless memory leak,
  not a correctness bug — a later different document reuses a different
  fresh id, so it can never read the orphaned entry back), and the document's
  customization state, wanted or not, resets to empty under the new id. The
  title text itself is unaffected (it is baked into the serialized snapshot
  `configure()` restores), so #18065's repro — which does not undo/redo —
  still passes; the failure mode is specifically "rename, then undo/redo
  anything, then trigger an unrelated agent reconcile" silently losing the
  rename's protection, with no error or warning.

  **This ADR accepts this as a known, deliberate limitation rather than
  fixing it**, for three reasons. First, `resetAfterClear()` cannot tell "the
  same document, restored by undo/redo" apart from "a genuinely different
  document being loaded" — both go through the identical generic
  `LGraph.clear()`/`configure()` path with no caller context, so any fix
  belongs at a call site that knows which case it is, not in `LGraph.ts`;
  the only such call site is `changeTracker.ts`'s `updateState()`. Second,
  the correct fix at that call site — capture the root graph id before
  `loadGraphData`, and afterward migrate the old id's customized-node-id set
  onto the new id — is a new `migrateRoot(oldId, newId)` store method plus a
  new cross-file call site outside the write/clear pattern every other
  consumer of this store follows, for a scenario the reported bug
  (PM-1296/PM-1297) does not exercise. Third, and most importantly, this
  entire feature (Option B) is already an explicitly session-local,
  best-effort mitigation — it does not survive a reload and does not reach a
  collaborator, both accepted above for the same reason: the durable,
  fully-correct fix is Option A's CRDT title op, tracked separately. Adding
  undo/redo-survival to a stopgap that is not expected to survive far more
  common events (a reload) is disproportionate scope for this fix; a test
  (`nodeTitleCustomizationStore.test.ts`) locks in this exact behavior so a
  future regression — or a future decision to invest in surviving undo/redo
  — is a deliberate, visible change rather than a silent one.

- One more per-node store to keep in sync with node lifecycle, though it
  reuses the existing `clearNodeOwnedStoreState` hook rather than adding a
  new one for ordinary removal. The type-change/replace path needed one more,
  narrowly-scoped hook of its own directly in `agentNodeMaterializer.ts` — see
  "What clears it" above.
- The store's own `clearGraph(rootGraphId)` action has no call site yet (nothing
  needs it: id regeneration on `LGraph.clear()` already isolates a
  genuinely new document from a prior one's flags, as described above, so
  proactively clearing is not required for correctness, only for reclaiming
  the otherwise-unreachable memory). It exists for API symmetry with
  `nodeDataStore`/`widgetValueStore` and is covered by a direct unit test;
  wiring it up is left for whoever next touches this store's memory
  footprint, not blocking here.
- `RightSidePanel.vue`'s `handleTitleEdit` must resolve which selection
  (`selectedGroups.value[0]` vs. `selectedNodes.value[0]`) actually supplied
  the edited target to call the new store correctly, rather than a type guard
  on the merged value — `'graph' in target` does not work, because
  `LGraphGroup` also declares a public `graph` field (adversarial-review
  finding; see the write-site table above). This is a small but real new
  branch in a call site that previously treated both targets identically for
  `.title = ...` assignment.

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

### Adversarial review

Before implementation, this ADR went through one adversarial review round,
which found three blocking gaps and one should-fix, all addressed above and
in the implementation:

1. The `clearNodeOwnedStoreState` cleanup hook does not fire for a node
   removed as part of an agent type-change reconcile, because `LGraph.ts`'s
   successor-skip logic treats the new replacement node as the old node's
   "successor." Fixed directly in `agentNodeMaterializer.ts` (Option a; see
   "What clears it").
2. Undo/redo regenerates the root graph id on every action, orphaning the
   entire customization map for the document. Accepted and documented as a
   known limitation, with a regression test locking in the exact behavior
   (see "Consequences" → Negative).
3. The originally proposed test only exercised the batch-only
   `graphMutations.ts` layer, which never calls `clearNodeOwnedStoreState` —
   it could not have caught gap 1. Replaced with tests that drive the real
   `LGraph.remove()` and `agentNodeMaterializer.ts` reconcile paths (see
   "Test plan").
4. (Should-fix) `RightSidePanel.vue`'s proposed `'graph' in target` guard
   cannot distinguish an `LGraphNode` from an `LGraphGroup`, since
   `LGraphGroup` also declares a public `graph` field. Fixed by branching on
   which selection array supplied the edited target instead.

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
  - `handleTitleEdit()`: resolve `group = selectedGroups.value[0]` and
    `node = selectedNodes.value[0]` as separate bindings (`target = group ||
node` still drives the rename itself), and call `markCustomized` only in
    the `!group && node` branch. **Not** a type guard on the merged value —
    see the adversarial-review correction above for why `'graph' in target`
    is wrong.
- `src/components/breadcrumb/SubgraphBreadcrumb.vue`
  - `updateTitle()`: call once per node visited inside the existing
    `forEachSubgraphNode(rootGraph, subgraph.id, (node) => { ... })`
    callback.
- `src/lib/litegraph/src/LGraphCanvas.ts`
  - `fUpdate`, case `'Title'`: same call, resolving `rootGraphId` from
    `node.graph` the same way `LGraph.ts` already does for
    `clearNodeOwnedStoreState`.
- `src/stores/clearNodeOwnedStoreState.ts`
  - Add `useNodeTitleCustomizationStore().clearNode(toRootGraphId(rootGraphId), nodeId)`
    alongside the existing `widgetValueStore().clearNode(...)` call. Covers
    ordinary removal only — see the next item for the type-change/replace gap.
- `src/workbench/extensions/agent/crdt/agentNodeMaterializer.ts`
  - `materialize()`: immediately after `graph.add(node)` succeeds, when
    `orphan` is defined (a type-change replace, not a genuine delete), call
    `useNodeTitleCustomizationStore().clearNode(scope.rootGraphId, state.id)`.
    This is the gap-1 fix described above under "What clears it" — it is
    **not** a change to `clearNodeOwnedStoreState()` or to `LGraph.ts`'s
    successor-skip logic.
- `docs/adr/README.md` — index entry for this ADR (done as part of this
  change).

### Test plan

- **New unit tests, `src/stores/nodeTitleCustomizationStore.test.ts`**: the
  store's four operations in isolation, the root-graph-scoping case (same
  `NodeId` under two different `RootGraphId`s must be independently
  customized/cleared), and a direct regression test for the accepted gap-2
  limitation: mark a node customized on a real `LGraph`'s id, call
  `graph.clear()` (the same call `configure()`'s `clearGraph` path makes,
  which regenerates the root graph id), and assert the flag is unreachable
  under the new id.
- **New unit tests, `src/stores/clearNodeOwnedStoreState.test.ts`** (gap-3
  fix — this is the "exercise the real removal path" coverage the review
  found missing; a mutation of the batch-only `graphMutations.ts` layer,
  which never calls `clearNodeOwnedStoreState`, cannot prove this hook
  fires): construct a real `LGraph`, add a real `LGraphNode`, mark it
  customized, and call the real `graph.remove(node)` (no
  `preserveCanonicalState`, i.e. an ordinary removal with no successor) —
  assert the flag clears. A second case proves a later node that reuses the
  same freed id is not wrongly flagged as customized.
- **Modified unit test,
  `src/workbench/extensions/agent/crdt/graphMutations.test.ts`**: the
  existing table-driven case
  `it.for([...])('titles a reconciled $type node with $title as $expected', ...)`
  gained `customized: boolean` and `addType: string` columns (the latter so a
  case can add under one type and reconcile under a different one, proving
  the `existing.type === payload.type` guard) so it proves every branch of
  the new gate: unmarked node resets as before; customized node keeps its
  incumbent title with no payload title; customized node keeps its incumbent
  title even when the payload _does_ carry one (the flag means "ignore the
  payload's title", not merely "fill in when absent"); and a type change
  resets the title even when customized.
- **New/modified unit tests,
  `src/workbench/extensions/agent/crdt/agentNodeMaterializer.test.ts`** (the
  gap-1 regression, exercised through the real materializer/`LGraph`
  integration point rather than the batch layer): mark a live agent-seeded
  node customized, drive a real type-change replace through
  `remoteMutations(scope).deleteNode(...)` + `.addNode(...)` with a
  different registered type followed by `reconcileAgentAdapters(graph)` (the
  same real `graph.add()` → `graph.remove(orphan, { preserveCanonicalState:
true })` sequence production code runs), and assert the old id's
  customized flag is cleared once the replacement is live. This test failed
  before the `agentNodeMaterializer.ts` fix (confirmed red) and passes after
  it (confirmed green), alongside the full existing suite in this file,
  including the adjacent `'runs stale-node lifecycle without clearing
successor-owned state'` test that proves the fix does not regress
  `widgetValueStore`/`previewExposureStore`'s successor-skip behavior.
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
