import type { Rect } from '@/lib/litegraph/src/interfaces'
import { createBounds } from '@/lib/litegraph/src/measure'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { NodeBoundsUpdate } from '@/renderer/core/layout/types'
import { app as comfyApp } from '@/scripts/app'

const SCALE_FACTOR = 1.75

export function useFixVueNodeOverlap() {
  const canvas = comfyApp.canvas
  const graph = canvas.graph

  if (!graph || !graph.nodes) return

  const lgBounds = createBounds(graph.nodes)

  if (!lgBounds) return

  const allVueNodes = layoutStore.getAllNodes().value

  const lgBoundsCenterX = lgBounds![0] + lgBounds![2] / 2
  const lgBoundsCenterY = lgBounds![1] + lgBounds![3] / 2

  const lgNodesById = new Map(
    graph.nodes.map((node) => [String(node.id), node])
  )

  const yjsMoveNodeUpdates: NodeBoundsUpdate[] = []
  const scaledNodesForBounds: Array<{ boundingRect: Rect }> = []

  for (const vueNode of allVueNodes.values()) {
    const lgNode = lgNodesById.get(String(vueNode.id))
    if (!lgNode) continue

    const vectorX = lgNode.pos[0] - lgBoundsCenterX
    const vectorY = lgNode.pos[1] - lgBoundsCenterY
    const newX = lgBoundsCenterX + vectorX * SCALE_FACTOR
    const newY = lgBoundsCenterY + vectorY * SCALE_FACTOR

    yjsMoveNodeUpdates.push({
      nodeId: vueNode.id,
      bounds: {
        x: newX,
        y: newY,
        width: vueNode.bounds.width,
        height: vueNode.bounds.height
      }
    })

    scaledNodesForBounds.push({
      boundingRect: [newX, newY, vueNode.bounds.width, vueNode.bounds.height]
    })
  }

  layoutStore.batchUpdateNodeBounds(yjsMoveNodeUpdates)

  const scaledLgBounds = createBounds(scaledNodesForBounds)

  graph.groups.forEach((group) => {
    const vectorX = group.pos[0] - lgBoundsCenterX
    const vectorY = group.pos[1] - lgBoundsCenterY

    group.pos = [
      lgBoundsCenterX + vectorX * SCALE_FACTOR,
      lgBoundsCenterY + vectorY * SCALE_FACTOR
    ]
    group.size = [group.size[0] * SCALE_FACTOR, group.size[1] * SCALE_FACTOR]
  })

  if (scaledLgBounds) {
    canvas.ds.fitToBounds(scaledLgBounds, {
      zoom: 0.5 //Makes it so the fit to view is slightly zoomed out and not edge to edge.
    })
  }
}
