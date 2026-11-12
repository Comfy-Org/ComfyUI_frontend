import type { LGraph } from '@/lib/litegraph/src/LGraph'

import type { GraphScopeFor } from './graphScopeHandle'
import type { NodeHandles } from './nodeHandle'
import { checkedNodeQuery, nodeOfExactType } from './nodeQuery'
import type { GraphHandle, NodeQuery, NodeQueryScope } from './types'

export function createGraphHandle(
  nodes: NodeHandles,
  graphScopeFor: GraphScopeFor,
  getVisibleGraph: () => LGraph | null
): GraphHandle {
  const visible = () => getVisibleGraph() ?? undefined

  function graphsIn(scope: NodeQueryScope): LGraph[] {
    const graph = visible()
    if (!graph) return []
    if (scope === 'visible') return [graph]
    return [graph.rootGraph, ...graph.rootGraph.subgraphs.values()]
  }

  return Object.freeze({
    get id() {
      return visible()?.id
    },

    node: (id: string) => nodes.find(visible(), id),
    nodes: () => nodes.list(graphsIn('visible')),
    nodesOfType: (type: string) =>
      nodes.list(graphsIn('visible'), nodeOfExactType(type)),
    queryNodes(query: NodeQuery = {}) {
      const { scope, selects } = checkedNodeQuery(query)
      return nodes.list(graphsIn(scope), selects)
    },

    root() {
      const root = visible()?.rootGraph
      return root && graphScopeFor(root)
    },
    subgraphs() {
      const definitions = visible()?.rootGraph.subgraphs.values() ?? []
      return Object.freeze(Array.from(definitions, graphScopeFor))
    }
  })
}
