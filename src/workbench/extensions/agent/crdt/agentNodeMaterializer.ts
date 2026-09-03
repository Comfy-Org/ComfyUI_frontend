/**
 * qa-59 bridge: gives agent-added nodes a live `LGraphNode` adapter.
 *
 * `graphMutations.ts` (the pure, litegraph-free op layer — see CRDT KEEP-ALIVE
 * #3) only ever writes `useNodeDataStore`/`useWidgetValueStore`/the layout
 * port for a remote `add_node`. It never constructs an `LGraphNode` or calls
 * `LGraph.add()`, because it cannot import either without breaking the
 * op-layer's DOM/litegraph-free purity guarantee. The result: an agent-added
 * node renders (the canvas is store-driven) but has no entry in
 * `LGraph._nodes`, so every `serialize()` hits the adapter/state mismatch
 * branch in `serialiseStoredNodes()` and silently drops the node — see
 * `LGraph.test.ts` "drops an agent-added node from serialize() ... (qa-59)".
 *
 * This module is the FE-only, app-context-aware seam that closes the gap. It
 * intentionally lives next to `useAgentCrdtFollower.ts` (already Vue/app-layer
 * code, already owns the `EcsFollowerAdapter` instance) rather than inside the
 * op layer.
 *
 * Approach: rather than trying to make `LGraphNode` adopt the *existing*
 * store `NodeState` in place (risky — `LGraphNode`'s constructor builds a
 * fresh `_state` and its input/output slot views are bound to that object's
 * `inputs`/`outputs` arrays by reference, so swapping `_state` post-
 * construction risks desyncing those views), this deletes the store-only
 * record for the id and lets the normal `node.configure()` +
 * `attachNodeToStores` + `graph.add()` path recreate it from
 * `NodeState.lastSerialization` — which IS the semantic payload that produced
 * the current store state, so the recreated record is equivalent. That keeps
 * every write on a single, already-tested code path instead of adding a
 * second one, and reuses `attachNodeLayout`'s existing "layout already
 * exists → adopt, don't recreate" branch (`graphLayoutAttachment.ts`) instead
 * of duplicating that logic here.
 *
 * Ordering: the store record is cleared FIRST, then `graph.add()` (which
 * runs `attachNodeToStores`/`registerNodeState`), then `node.configure()`
 * (canonical `LGraph.configure()` ordering — "add before configure,
 * otherwise configure cannot create links"). Clearing before `add()` is
 * load-bearing, not cosmetic: `registerNodeState` mints and assigns a NEW id
 * whenever it finds an incumbent record at the target id, so if the old
 * record were still present when `add()` ran, the CRDT-assigned id would get
 * silently reminted — reproducing the exact "stored node has no live
 * adapter" bug this module exists to fix, just one id later. Both fallible
 * steps stay rollback-safe: an `add()` throw restores the store record
 * (nothing was attached, so there's no adapter to remove); a `configure()`
 * throw removes the just-added adapter AND restores the store record. Either
 * way the node is never dropped from both the live graph and the store at
 * once — it just stays store-only and is retried on the next frame.
 */
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import { reportError } from '@/platform/telemetry/reportError'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { parseNodeId } from '@/types/nodeId'

/**
 * `readSemanticNode` (`ecsFollowerAdapter.ts`) builds `widgets_values` as a
 * NAME-keyed object from the doc's `widgets` Y.Map, so that's the shape
 * `NodeState.lastSerialization` carries. `LGraphNode.configure()` only
 * consumes a name-keyed map via `widgets_values_named` — its
 * `widgets_values` handling is positional-array-only
 * (`Array.from(info.widgets_values ?? [])`), with the named fallback gated
 * on `fallbackWidgetsValuesNames`, which most agent-added node types won't
 * have. Left alone, an object under `widgets_values` silently becomes `[]`
 * and every named widget value is dropped on materialization
 * (github-actions HIGH,
 * https://github.com/Comfy-Org/ComfyUI_frontend/pull/16652#discussion_r3917983350).
 * Derive the named map explicitly so configure() restores it regardless of
 * whether the target node class declares a fallback.
 */
function withNamedWidgetValues(serialised: ISerialisedNode): ISerialisedNode {
  const values = serialised.widgets_values
  if (
    values === undefined ||
    Array.isArray(values) ||
    serialised.widgets_values_named !== undefined
  ) {
    return serialised
  }
  return { ...serialised, widgets_values_named: values }
}

/** The graph surface this module needs — mirrors `MintableGraph` in
 * `mintPortWiring.ts` so the two DI shapes stay compatible for callers that
 * already hold a `getGraph()` closure. */
export interface MaterializableGraph {
  id: string
  rootGraph: { id: string }
  getNodeById(id: ReturnType<typeof parseNodeId>): LGraphNode | null
  add(node: LGraphNode): LGraphNode | null | undefined
  remove?(node: LGraphNode): void
}

/**
 * For every id in `nodeIds` that the ECS store knows about but `graph` does
 * not yet have a live adapter for, constructs one and attaches it. Ids that
 * already have a live adapter, or that the store no longer has (e.g. deleted
 * by a later frame in the same batch), are skipped silently — this runs
 * after every applied frame, so a node that legitimately isn't there yet
 * will be picked up on its own frame.
 *
 * Returns the ids actually materialized, for callers that want to log/test.
 */
export function materializeMissingAdapters(
  graph: MaterializableGraph,
  nodeIds: Iterable<string>
): string[] {
  const scope = graphScopeOf(graph)
  const nodeDataStore = useNodeDataStore()
  const widgetValueStore = useWidgetValueStore()
  const materialized: string[] = []

  for (const rawId of nodeIds) {
    const nodeId = parseNodeId(rawId)
    if (nodeId === null) continue
    // `LGraph.getNodeById` indexes `_nodes_by_id` directly and returns
    // `undefined` for an absent id despite its `LGraphNode | null` type, so
    // this must be a falsiness check, not `!== null` (which is always true
    // for `undefined` and made this whole function a no-op in production).
    //
    const existing = graph.getNodeById(nodeId)

    const state = nodeDataStore.getNode(scope.rootGraphId, nodeId)
    if (!state) continue // store no longer has it (deleted later in the batch)
    if (state.graphId !== scope.owningGraphId) continue // lives in a different (sub)graph

    const serialised = state.lastSerialization
    if (!serialised) continue

    if (existing) {
      // A live adapter already existing does NOT mean "nothing to do": the
      // op layer reports a remote `update` through the same
      // `lastAddedNodeIds` channel as `add` (it applies an update as
      // delete+add of the STORE record, `ecsFollowerAdapter.ts`), so an id
      // can arrive here again after its first successful materialization.
      // Skipping unconditionally left the OLD adapter (stale `pos`/widgets,
      // possibly the old node class) bound while the store moved on, and
      // `serialiseStoredNodes()` paired the stale adapter with the new
      // state on save. Reconcile instead: drop the existing adapter and
      // fall through to recreate it from the (already-updated) store
      // record, same as a fresh add. This only fires once we've confirmed
      // the store still has a record for this id (above) — an id with a
      // live adapter but NO agent-owned store record (e.g. an ordinary
      // user-created node whose id happens to collide, or a caller passing
      // stale ids) must never be touched; that's the store check above,
      // not this one. `nodeIds` here only ever contains ids the op layer
      // JUST reported changed — a successfully materialized id is removed
      // from the caller's pending set and only reappears if a later frame
      // reports it again — so this never reconciles an id that hasn't
      // actually changed.
      graph.remove?.(existing)
    }

    let node = LiteGraph.createNode(state.type, state.title)
    if (!node) {
      // Unregistered node type — a supported workflow state that normal
      // graph loading preserves via a placeholder (`LGraph.configure()`,
      // "in case of error we create a replacement node to avoid losing
      // info"; see also `LGraph.ts`'s subgraph-unpack placeholder path).
      // Dropping the id silently here would desync the store (which still
      // has it) from the graph (which never learns of it) — materialize the
      // same placeholder instead so it round-trips through save/load like
      // any other unregistered-type node.
      node = new LGraphNode(
        state.title || state.type || 'Missing Node',
        state.type
      )
      node.has_errors = true
    }
    node.id = nodeId

    // The incumbent store record at `nodeId` is cleared BEFORE `graph.add()`,
    // not after. `graph.add()` calls `attachNodeToStores` ->
    // `registerNodeState`, which only adopts the exact CRDT id if
    // `nodeDataStore.registerNode` finds no incumbent at that key; if the old
    // record is still there when `add()` runs, `registerNode` returns
    // `undefined`, and `attachNodeToStores`'s collision loop mints and
    // assigns a NEW id to `node` before `add()` returns — silently
    // reproducing the exact "stored node has no live adapter" bug this
    // module exists to fix, because the CRDT id now has no adapter again
    // (DrJKL, https://github.com/Comfy-Org/ComfyUI_frontend/pull/16652#discussion_r3921406436;
    // CodeRabbit, https://github.com/Comfy-Org/ComfyUI_frontend/pull/16652#discussion_r3921409323).
    // Clearing first makes `registerNode` see an empty slot and register the
    // node under the CRDT id unchanged.
    //
    // Rollback-safety is preserved the other way: if `graph.add()` throws (or
    // returns falsy), the store record is restored via `registerNode` before
    // continuing, so a failed add() never leaves the id store-less.
    nodeDataStore.deleteNode(scope, state)
    // Keyed by rootGraphId, matching every other clearNode call site in
    // graphMutations.ts's commit() (e.g. the reconcileNode-replace and
    // deleteNode branches) — widget records are bucketed per root graph,
    // not per owning (sub)graph.
    widgetValueStore.clearNode(scope.rootGraphId, nodeId)

    // Canonical ordering (`LGraph.configure()`: "add before configure,
    // otherwise configure cannot create links") — `graph.add()` first, THEN
    // `node.configure()`, so `node.graph` is set before slot/link resolution
    // runs inside `configure()` (github-actions Medium,
    // https://github.com/Comfy-Org/ComfyUI_frontend/pull/16652#discussion_r3917983386).
    let added: LGraphNode | null | undefined
    try {
      added = graph.add(node)
    } catch (cause) {
      added = undefined
      // `LGraph.add()` can throw AFTER already attaching the node — it
      // pushes into `_nodes`/`_nodes_by_id` and runs `attachNodeToStores`
      // before calling `node.onAdded?.(this)`, and an `onAdded` throw
      // propagates straight out uncaught (CodeRabbit,
      // https://github.com/Comfy-Org/ComfyUI_frontend/pull/16652#discussion_r3921409323).
      // `graph.remove?.(node)` is safe to call unconditionally here: `LGraph.
      // remove()` no-ops if the node was never actually added (its own
      // `_nodes_by_id[node.id] == null` guard), so this correctly handles
      // both "add() threw before attaching anything" and "add() threw after
      // attaching, from onAdded" without needing to distinguish them.
      graph.remove?.(node)
      reportError(cause, {
        errorType: 'agent_node_materialize_add_failed',
        context: { graphId: graph.id, nodeId: String(nodeId) }
      })
    }
    if (!added) {
      nodeDataStore.registerNode(scope, state)
      continue // leaves the store-only record in place; retried next frame
    }

    try {
      node.configure(withNamedWidgetValues(serialised))
    } catch (cause) {
      // Roll back both the store record AND the just-added live adapter, so
      // a configure() failure doesn't leave a half-configured node live on
      // the graph while also having dropped the authoritative record.
      graph.remove?.(node)
      nodeDataStore.registerNode(scope, state)
      reportError(cause, {
        errorType: 'agent_node_materialize_configure_failed',
        context: { graphId: graph.id, nodeId: String(nodeId) }
      })
      continue
    }

    materialized.push(rawId)
  }

  return materialized
}
