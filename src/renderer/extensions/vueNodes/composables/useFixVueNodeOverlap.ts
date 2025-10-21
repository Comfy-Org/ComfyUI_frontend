import type { Point } from '@/lib/litegraph/src/interfaces'
import { createBounds } from '@/lib/litegraph/src/measure'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { app as comfyApp } from '@/scripts/app'

/* eslint-disable no-console */

const SCALE_FACTOR = 1.5

export function useFixVueNodeOverlap() {
  const allVueNodes = layoutStore.getAllNodes().value
  const canvas = comfyApp.canvas
  const graph = canvas.graph

  const { moveNode } = useLayoutMutations()

  if (!graph || !graph.nodes) return

  const lgOriginalNodesPosAndBounds = graph?.nodes.map((node) => ({
    id: node.id,
    position: node.pos,
    boundinRect: node.boundingRect
  }))

  const lgBounds = createBounds(graph.nodes)

  const lgBoundsCenterX = lgBounds![0] + lgBounds![2] / 2
  const lgBoundsCenterY = lgBounds![1] + lgBounds![3] / 2

  const lgScaledNodesPosAndBounds = lgOriginalNodesPosAndBounds?.map(
    (posAndBounds) => {
      const { position } = scalePosFromCenter(posAndBounds.position)
      return {
        id: posAndBounds.id,
        position,
        boundingRect: posAndBounds.boundinRect
      }
    }
  )

  const scaledLgBounds = createBounds(lgScaledNodesPosAndBounds)

  lgScaledNodesPosAndBounds.forEach((scaledPosAndBounds) => {
    allVueNodes.forEach((vueNode) => {
      if (String(scaledPosAndBounds.id) === String(vueNode.id)) {
        const newPos = {
          x: scaledPosAndBounds.position[0],
          y: scaledPosAndBounds.position[1]
        }
        moveNode(vueNode.id, newPos)
      }
    })
  })

  graph.groups.forEach((group) => {
    const { position } = scalePosFromCenter(group.pos)
    const newWidth = group.size[0] * SCALE_FACTOR
    const newHeight = group.size[1] * SCALE_FACTOR

    group.pos = [position[0], position[1]]
    group.size = [newWidth, newHeight]
  })

  if (scaledLgBounds)
    canvas.ds.fitToBounds(scaledLgBounds, {
      zoom: 0.6 //Makes it so the fit to view is slightly zoomed out and not edge to edge.
    })

  function scalePosFromCenter(pos: Point): {
    position: Point
  } {
    const vectorX = pos[0] - lgBoundsCenterX
    const vectorY = pos[1] - lgBoundsCenterY

    const scaledVectorX = vectorX * SCALE_FACTOR
    const scaledVectorY = vectorY * SCALE_FACTOR

    const newPosition: Point = [
      lgBoundsCenterX + scaledVectorX,
      lgBoundsCenterY + scaledVectorY
    ]

    return {
      position: newPosition
    }
  }

  console.log(
    'Litegraoh Original Node Pos and Bounds',
    lgOriginalNodesPosAndBounds
  )
  console.log('Litegraoh Scaled Node Pos and Bounds', lgScaledNodesPosAndBounds)
  console.log('All Vue Nodes', allVueNodes)
}
