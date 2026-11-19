import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { isSubgraph } from '@/utils/typeGuardUtil'

import type {
  DocumentHandles,
  GraphResolver
} from '@/platform/nodeApi/shared/documentHandles'
import type { NodeHandles } from './nodeHandle'
import type { GraphScopeHandle } from './types'

export type GraphScopeHandleMembers = Pick<
  GraphScopeHandle,
  'groups' | 'resolvedSupplies'
>

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
  nodes: NodeHandles,
  membersFor: (resolveGraph: GraphResolver) => GraphScopeHandleMembers
): GraphScopes {
  const cache = handles.createCache<GraphScopeHandle, LGraph>()
  return {
    scopeFor: (graph) =>
      cache.handleFor(
        graph,
        graph.id,
        (current) => current,
        (_locate, resolveGraph) =>
          Object.freeze(
            Object.assign(
              graphScopeReads(graph.id, resolveGraph, nodes),
              membersFor(resolveGraph)
            )
          )
      ),
    locator: cache.locator
  }
}

function graphScopeReads(
  id: string,
  resolveGraph: GraphResolver,
  nodes: NodeHandles
) {
  return {
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
  }
}
