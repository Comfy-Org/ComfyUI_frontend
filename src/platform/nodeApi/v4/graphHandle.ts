import type { LGraph } from '@/lib/litegraph/src/LGraph'

import type { GraphScopeFor } from './graphScopeHandle'
import type { NodeHandles } from './nodeHandle'
import { checkedNodeQuery, nodeOfExactType } from './nodeQuery'
import type { GraphHandle, NodeQuery, NodeQueryScope } from './types'

type GraphHandleReads =
  | 'id'
  | 'version'
  | 'node'
  | 'nodes'
  | 'nodesOfType'
  | 'queryNodes'
  | 'root'
  | 'subgraphs'

/** The graph handle members other modules own. */
export type GraphHandleMembers = Omit<GraphHandle, GraphHandleReads>

export function createGraphHandle(
  nodes: NodeHandles,
  graphScopeFor: GraphScopeFor,
  getVisibleGraph: () => LGraph | null,
  members: (visible: () => LGraph | undefined) => GraphHandleMembers
): GraphHandle {
  const visible = () => getVisibleGraph() ?? undefined

  function graphsIn(scope: NodeQueryScope): LGraph[] {
    const graph = visible()
    if (!graph) return []
    if (scope === 'visible') return [graph]
    return [graph.rootGraph, ...graph.rootGraph.subgraphs.values()]
  }

  const reads = {
    get id() {
      return visible()?.id
    },
    get version() {
      return visible()?._version
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
  }
  return Object.freeze(Object.assign(reads, members(visible)))
}
