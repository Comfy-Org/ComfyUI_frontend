import type { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import { containsCentre } from '@/lib/litegraph/src/measure'

import type {
  DocumentHandles,
  GraphResolver
} from '@/platform/nodeApi/shared/documentHandles'
import { boundsOnCanvas } from '@/platform/nodeApi/v4/nodeHandle'
import type { NodeHandles } from '@/platform/nodeApi/v4/nodeHandle'
import type { GroupHandle } from '@/platform/nodeApi/v4/types'

/** The one handle for each group of a graph, in draw order. */
export type GroupsOf = (graph: LGraph) => readonly GroupHandle[]

export function createGroupHandles(
  handles: DocumentHandles,
  nodes: NodeHandles
): GroupsOf {
  const cache = handles.createCache<GroupHandle>(
    (graph, id) => groupIn(graph, id) !== undefined
  )
  return (graph) =>
    Object.freeze(
      graph.groups.map((group) =>
        cache.handleFor(graph, String(group.id), (resolveGraph) =>
          groupHandle(String(group.id), resolveGraph, nodes)
        )
      )
    )
}

function groupIn(graph: LGraph, id: string): LGraphGroup | undefined {
  return graph.groups.find((group) => String(group.id) === id)
}

function groupHandle(
  id: string,
  resolveGraph: GraphResolver,
  nodes: NodeHandles
): GroupHandle {
  function readLive<T>(
    read: (group: LGraphGroup, graph: LGraph) => T
  ): T | undefined {
    const graph = resolveGraph()
    const group = graph && groupIn(graph, id)
    return graph && group ? read(group, graph) : undefined
  }

  return Object.freeze({
    id,
    get isDeleted() {
      return !readLive(() => true)
    },
    getTitle: () => readLive((group) => group.title),
    getColor: () => readLive((group) => group.color),
    getBounds: () =>
      readLive((group) => {
        const [x, y, width, height] = group.boundingRect
        return Object.freeze({ x, y, width, height })
      }),
    nodes: () =>
      readLive((group, graph) => {
        const area = group.boundingRect
        return nodes.list([graph], (node) => {
          const { x, y, width, height } = boundsOnCanvas(node)
          return containsCentre(area, [x, y, width, height])
        })
      })
  })
}
