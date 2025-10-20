import type { Point } from '@/lib/litegraph/src/interfaces'
import { createBounds } from '@/lib/litegraph/src/measure'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { app as comfyApp } from '@/scripts/app'

/* eslint-disable no-console */

//Problem. When switching from litegraph to vue nodes because the vue nodes are a new design they are arbitrarily and non uniformally different sized but all together larger than litegraph nodes. But they use the same posiiton as the litegraph nodes... so that means they can be overlapped. And for litegraph workflows where nodes are very close together the overlap can be often and severe because the vue nodes are much larger.

//Solution take the litegraph node positions and bounds and scale them proportionally from the center of the canvas before the switch to vue nodes.

//Implementation guide:

//Step 1: litegraph nodes pos and bounds to new array to work with
//Get all the nodes positions and bounds in litegraph and put them in a new array to work with. This array is called lgOriginalPosAndBounds
//Scale their positions and bounds proportionally from the center of the all nodes bounds
//Determine the right sclaing factor for now we can scale all of them by say 50% 1.5x
//For convenince assign new scaled pos and bounds to new array lgScaledPosAndBounds

//Step 2: iterate over the lgScaledPosAndBounds positions and move the vue nodes there.
//Loop over the lgScalePosAndBounds
//Loop over the layoutStore.getAllNodes().value
//For each lgScalePosAndBounds find the layoutStore.getAllNodes().value equivilent and move the node to the lgScalePosAndBounds position
//Acutally move the node using moveNode(nodeID, nodePos) from useLayoutMutations();

//Questions:
// 1. Q: how do we get litegraph nodes pos and bounds for every node cleanly and accurately in canvas space? A: Should be able to use comfyApp.canvas.graph.nodes
//How do we check lgScalePosAndBounds item is the same item as layoutStore.getAllNodes().value maybe we use nodeID? A: yes we can use graph.getNodeById()

//The before should be all the litegraph nodes exactly where they are
//The after should be all the litegraph nodes scaled proportionally from their center and the vue nodes moved to their positions.

//Next Problem. Groups are not handled by this function. So if there are groups within the workflow. We are not scaling them which means when the node positions change they often are outisdeo of the groups and then it looks broken. In othere words the problem is groups do not scale with nodes.
//Quesitons: How do groups work in litegraph. How can we get the node bounds? Can we just scale their position in the exact same way? Should be able to?

//Rough idea: We need to get all groups. Loop over them, read their Rect x and y and their width and height. And then after are done scaling the nodes posiitons we need to do the same for the groups but we also need to scale their width and height.

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
      zoom: 0.6
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
