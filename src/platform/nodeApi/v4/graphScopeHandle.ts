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

export interface GraphScopes {
  readonly scopeFor: GraphScopeFor
  /**
   * For a graph handle made here, what finds its graph in the handle's own
   * document while the graph is there; `undefined` for anything else.
   */
  locator(value: unknown): GraphResolver | undefined
}

export function createGraphScopes(
  handles: DocumentHandles,
  nodes: NodeHandles
): GraphScopes {
  const cache = handles.createCache<GraphScopeHandle>(() => true)
  const liveGraphs = new WeakMap<object, GraphResolver>()
  return {
    scopeFor: (graph) =>
      cache.handleFor(graph, graph.id, (resolveGraph) => {
        const handle = graphScopeHandle(graph.id, resolveGraph, nodes)
        liveGraphs.set(handle, resolveGraph)
        return handle
      }),
    locator: (value) =>
      typeof value === 'object' && value !== null
        ? liveGraphs.get(value)
        : undefined
  }
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
