import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { isSubgraph } from '@/utils/typeGuardUtil'

import type {
  DocumentHandles,
  GraphResolver
} from '@/platform/nodeApi/shared/documentHandles'
import type { NodeHandles } from './nodeHandle'
import type { GraphScopeHandle } from './types'

/** Gives the one handle for a root graph or a subgraph definition. */
export type GraphScopeFor = (graph: LGraph) => GraphScopeHandle

export function createGraphScopes(
  handles: DocumentHandles,
  nodes: NodeHandles
): GraphScopeFor {
  const cache = handles.createCache<GraphScopeHandle>(() => true)
  return (graph) =>
    cache.handleFor(graph, graph.id, (resolveGraph) =>
      graphScopeHandle(graph.id, resolveGraph, nodes)
    )
}

function graphScopeHandle(
  id: string,
  resolveGraph: GraphResolver,
  nodes: NodeHandles
): GraphScopeHandle {
  return Object.freeze({
    id,
    get isDeleted() {
      return !resolveGraph()
    },
    get name() {
      const graph = resolveGraph()
      return graph && isSubgraph(graph) ? graph.name : undefined
    },

    node: (nodeId: string) => nodes.find(resolveGraph(), nodeId),
    nodes() {
      const graph = resolveGraph()
      return graph && nodes.list([graph])
    }
  })
}
