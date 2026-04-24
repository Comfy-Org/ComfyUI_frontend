import { storeToRefs } from 'pinia'
import { computed, toRaw, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useGraphStructureRevision } from '@/composables/node/useGraphStructureRevision'
import { isApiNode, useNodePricing } from '@/composables/node/useNodePricing'
import type {
  LGraph,
  LGraphNode,
  Subgraph
} from '@/lib/litegraph/src/litegraph'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { reduceAllNodes } from '@/utils/graphTraversalUtil'

type ApiNodeRow = { id: string; name: string; cost: string | null }

// Assign stable synthetic ids to graph instances so row keys stay unique
// across flattened subgraph traversals. `LGraph.id` defaults to a zero
// UUID until real UUIDs are populated (which doesn't always happen in
// transient / test / pre-load states), so two "different" subgraphs can
// share an id at the schema level — any numeric `node.id` collision then
// collides Vue :keys. A WeakMap keyed by graph identity side-steps the
// schema and gives one stable synthetic id per instance for the lifetime
// of the graph in memory.
let nextSyntheticGraphId = 0
const syntheticGraphIds = new WeakMap<LGraph | Subgraph, string>()
const getSyntheticGraphId = (
  graph: LGraph | Subgraph | null | undefined
): string | null => {
  if (!graph) return null
  let id = syntheticGraphIds.get(graph)
  if (!id) {
    id = `g${nextSyntheticGraphId++}`
    syntheticGraphIds.set(graph, id)
  }
  return id
}

const rowKey = (node: LGraphNode): string => {
  // Detached nodes (node.graph null) fall through to the bare id. Within
  // a graph, ids are unique; detached nodes are transient and rare, so
  // the small chance of a bare-id collision across two orphans is worth
  // not synthesizing a shared "unattached" namespace that would collide
  // them all into one row key.
  const graphId = getSyntheticGraphId(node.graph)
  return graphId ? `${graphId}:${node.id}` : String(node.id)
}

/**
 * Walk a graph hierarchy and return one row per api-node, in traversal order,
 * with the per-node display label from useNodePricing. The shape matches
 * ApiNodesList's prop contract so either the sign-in dialog or the actionbar
 * popover can feed it directly.
 */
export const useApiNodeRows = (
  graph: MaybeRefOrGetter<LGraph | Subgraph | null | undefined>
) => {
  const nodeDefStore = useNodeDefStore()
  // Row list is a graph-wide consumer, so it subscribes to
  // `pricingAggregateRevision` at the composable level and reads
  // `getCachedDisplayLabel` — the no-own-subscription sibling of
  // `getNodeDisplayPrice`. Using `getNodeDisplayPrice` here would
  // couple the row list to `pricingTick` (the per-node canvas-redraw
  // signal), which is dead in VueNodes mode and redundant with the
  // aggregate tick in Nodes-1.0 mode. `useGraphStructureRevision`
  // covers in-place node add/remove; `activeWorkflow` covers the
  // LGraph-swap case (ComfyApp mutates the same instance across
  // loads, so graph identity alone is insufficient).
  const { getCachedDisplayLabel, pricingAggregateRevision } = useNodePricing()
  const graphStructureRevision = useGraphStructureRevision(graph)
  const { activeWorkflow } = storeToRefs(useWorkflowStore())

  // toRaw the store before reading nodeDefsByName so the computed
  // does not register the entire node-def map as a dependency. Node
  // defs are stable after startup, so the reactive read would otherwise
  // re-run every row enumeration on any unrelated nodeDef change.
  const rawNodeDefStore = toRaw(nodeDefStore)
  const displayName = (node: LGraphNode): string =>
    rawNodeDefStore.nodeDefsByName[node.type]?.display_name ?? node.type

  return computed<ApiNodeRow[]>(() => {
    void pricingAggregateRevision.value
    void graphStructureRevision.value
    void activeWorkflow.value
    const resolved = toValue(graph)
    if (!resolved) return []

    // Path-local visited semantics in `reduceAllNodes` intentionally
    // re-traverse shared subgraph contents — N hosts referencing one
    // Subgraph instance get walked N times so cost aggregation counts
    // N executions. The row list, however, is "what API endpoints will
    // run" — a set, not a multiset. Dedupe by node identity so the UI
    // shows one row per unique node regardless of how many hosts
    // reference its parent subgraph; the per-execution cost math lives
    // in the aggregator, not here.
    const seen = new Set<LGraphNode>()
    return reduceAllNodes<ApiNodeRow[]>(
      resolved,
      (acc, node) => {
        if (!isApiNode(node)) return acc
        if (seen.has(node)) return acc
        seen.add(node)
        const label = getCachedDisplayLabel(node)
        acc.push({
          id: rowKey(node),
          name: displayName(node),
          cost: label ? label : null
        })
        return acc
      },
      []
    )
  })
}
