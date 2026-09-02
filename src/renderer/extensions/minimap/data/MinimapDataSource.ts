import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { calculateNodeBounds } from '@/renderer/core/spatial/boundsCalculator'
import { useExecutionStore } from '@/stores/executionStore'
import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { createNodeLocatorId } from '@/types/nodeIdentification'

import type {
  MinimapBounds,
  MinimapGroupData,
  MinimapLinkData,
  MinimapNodeData
} from '../types'

export class MinimapDataSource {
  constructor(private readonly graph: LGraph | null) {}

  private nodes: MinimapNodeData[] | null = null

  getNodes(): MinimapNodeData[] {
    this.nodes ??= this.buildNodes()
    return this.nodes
  }

  private buildNodes(): MinimapNodeData[] {
    const graph = this.graph
    if (!graph) return []

    const nodeProgressStates = useExecutionStore().nodeLocationProgressStates
    const containingSubgraphId = graph.isRootGraph ? null : graph.id

    return graph._nodes.map((node) => {
      const [width, height] = node.renderingSize
      const executionState =
        nodeProgressStates[createNodeLocatorId(containingSubgraphId, node.id)]
          ?.state ?? null

      return {
        id: node.id,
        x: node.pos[0],
        y: node.pos[1],
        width,
        height,
        bgcolor: node.bgcolor,
        mode: node.mode,
        hasErrors: node.has_errors,
        executionState
      }
    })
  }

  getLinks(): MinimapLinkData[] {
    const graph = this.graph
    if (!graph) return []

    const linkStore = useLinkStore()
    const scope = graphScopeOf(graph)
    const links: MinimapLinkData[] = []
    const nodeMap = new Map(this.getNodes().map((node) => [node.id, node]))

    for (const link of linkStore.graphTopologies(scope)) {
      const sourceNode = nodeMap.get(link.originNodeId)
      const targetNode = nodeMap.get(link.targetNodeId)
      if (!sourceNode || !targetNode) continue

      links.push({
        sourceNode,
        targetNode,
        sourceSlot: link.originSlot,
        targetSlot: link.targetSlot
      })
    }

    return links
  }

  getGroups(): MinimapGroupData[] {
    return (
      this.graph?._groups.map((group) => ({
        x: group.pos[0],
        y: group.pos[1],
        width: group.size[0],
        height: group.size[1],
        color: group.color
      })) ?? []
    )
  }

  getBounds(): MinimapBounds {
    return (
      calculateNodeBounds(
        this.getNodes().map((node) => ({
          pos: [node.x, node.y],
          size: [node.width, node.height]
        }))
      ) ?? {
        minX: 0,
        minY: 0,
        maxX: 100,
        maxY: 100,
        width: 100,
        height: 100
      }
    )
  }

  getNodeCount(): number {
    return this.graph?._nodes.length ?? 0
  }

  hasData(): boolean {
    return this.getNodeCount() > 0
  }
}
