import type { NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { ReadOnlyRectangle } from '@/lib/litegraph/src/infrastructure/Rectangle'
import type { Point } from '@/lib/litegraph/src/interfaces'
import { createBounds } from '@/lib/litegraph/src/measure'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { app as comfyApp } from '@/scripts/app'

type posAndBounds = {
  id: NodeId
  position: Point
  bounds: ReadOnlyRectangle
}

type NodeWithVueBounds = {
  id: NodeId
  position: Point
  lgBounds: ReadOnlyRectangle
  vueBounds: ReadOnlyRectangle
}

export function useFixVueNodeOverlap() {
  const allNodes = layoutStore.getAllNodes().value
  const graph = comfyApp.canvas?.graph
  const { moveNode } = useLayoutMutations()

  //Problem. When switching from litegraph to vue nodes because the vue nodes are a new design they are arbitrarily and non uniformally different sized but all together larger than litegraph nodes. But they use the same posiiton as the litegraph nodes... so that means they can be overlapped. And for litegraph workflows where nodes are very close together the overlap can be often and severe because the vue nodes are much larger.

  //Solution take the litegraph node positions and bounds and scale them proportionally from the center of the canvas before the switch to vue nodes.

  //Implementation guide:

  //Step 1: litegraph nodes pos and bounds to new array to work with
  //Get all the nodes positions and bounds in litegraph and put them in a new array to work with. This array is called lgOriginalPosAndBounds
  //Scale their positions and bounds proportionally from the center of the canvas
  //Determine the right sclaing factor for now we can scale all of them by say 20% (for now)
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

  if (!graph) return

  const lgOriginalPosAndBounds = graph?.nodes.map((node) => {
    return {
      id: node.id,
      position: node.pos,
      bounds: node.boundingRect
    }
  })

  console.log(graph) //Prints that we have one.

  const lgBounds = createBounds(graph.nodes)

  console.log(lgBounds)

  // Merge LiteGraph positions with Vue node bounds
  const nodesWithVueBounds = mergeWithVueBounds(lgOriginalPosAndBounds, allNodes)
  console.log('Nodes with Vue bounds:', nodesWithVueBounds)

  // Calculate overlap and get the closest pair distance
  const { maxOverlap, minDistance } = calculateOverlapAndMinDistance(nodesWithVueBounds)
  console.log('Maximum overlap with Vue bounds:', maxOverlap, 'px')
  console.log('Minimum distance between overlapping nodes:', minDistance, 'px')

  // Calculate total expansion needed (max overlap + 20px buffer)
  const additionalSpace = 20
  const totalExpansion = maxOverlap + additionalSpace
  console.log('Total expansion needed:', totalExpansion, 'px')
  console.log('LG Bounds dimensions:', lgBounds)

  // Apply dynamic scaling uniformly to all nodes (preserves topology)
  const lgScaledPosAndBounds = lgOriginalPosAndBounds?.map((posAndBounds) => {
    const { position, bounds } = scaleNodeProportionally(
      posAndBounds,
      totalExpansion,
      minDistance
    )
    return {
      id: posAndBounds.id,
      position,
      bounds
    }
  })

  console.log('Litegraoh Original Node Pos and Bounds', lgOriginalPosAndBounds)
  console.log('Litegraoh Scaled Node Pos and Bounds', lgScaledPosAndBounds)
  console.log('All Vue Nodes', allNodes)

  // Debug: Check ID types
  if (lgScaledPosAndBounds && lgScaledPosAndBounds.length > 0) {
    const lgId = lgScaledPosAndBounds[0].id
    console.log('Sample LG ID:', lgId, 'Type:', typeof lgId)
  }
  if (allNodes.size > 0) {
    const firstVueNode = Array.from(allNodes.values())[0]
    console.log(
      'Sample Vue ID:',
      firstVueNode.id,
      'Type:',
      typeof firstVueNode.id
    )
  }

  console.log('=== MOVING NODES ===')
  let movedCount = 0
  lgScaledPosAndBounds?.forEach((scaledPosAndBounds) => {
    // Find the original position for comparison
    const originalPosAndBounds = lgOriginalPosAndBounds?.find(
      (orig) => orig.id === scaledPosAndBounds.id
    )

    allNodes.forEach((vueNode) => {
      // Convert both IDs to string for comparison (LG uses number, Vue uses string)
      if (String(scaledPosAndBounds.id) === String(vueNode.id)) {
        const newPos = {
          x: scaledPosAndBounds.position[0],
          y: scaledPosAndBounds.position[1]
        }
        const oldPos = originalPosAndBounds
          ? {
              x: originalPosAndBounds.position[0],
              y: originalPosAndBounds.position[1]
            }
          : { x: 0, y: 0 }

        console.log(`Node ${vueNode.id}:`)
        console.log('  Old position:', oldPos)
        console.log('  New position:', newPos)
        console.log(
          '  Delta:',
          (newPos.x - oldPos.x).toFixed(1),
          ',',
          (newPos.y - oldPos.y).toFixed(1)
        )

        moveNode(vueNode.id, newPos)
        movedCount++
      }
    })
  })
  console.log('Total nodes moved:', movedCount)

  function mergeWithVueBounds(
    lgNodes: posAndBounds[],
    vueNodes: ReadonlyMap<string, any>
  ): NodeWithVueBounds[] {
    const result: NodeWithVueBounds[] = []

    console.log('=== MERGE DEBUG ===')
    console.log('Total LG nodes:', lgNodes.length)
    console.log('Total Vue nodes:', vueNodes.size)

    lgNodes.forEach((lgNode) => {
      const vueNode = vueNodes.get(String(lgNode.id))
      console.log(`Node ${lgNode.id}:`, {
        hasVueNode: !!vueNode,
        hasBounds: !!(vueNode && vueNode.bounds),
        lgBounds: lgNode.bounds,
        vueBounds: vueNode?.bounds
      })
      if (vueNode && vueNode.bounds) {
        result.push({
          id: lgNode.id,
          position: lgNode.position,
          lgBounds: lgNode.bounds,
          vueBounds: vueNode.bounds
        })
      }
    })

    console.log('Merged nodes with Vue bounds:', result.length)
    return result
  }

  function calculateOverlapAndMinDistance(
    nodes: NodeWithVueBounds[]
  ): { maxOverlap: number; minDistance: number } {
    let maxOverlap = 0
    let minDistance = Infinity

    console.log('=== OVERLAP CALCULATION DEBUG ===')

    // Check every pair of nodes for overlap
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i]
        const nodeB = nodes[j]

        // Debug: Check the vueBounds format
        if (i === 0 && j === 1) {
          const vb = nodeA.vueBounds as any
          console.log('VueBounds structure:')
          console.log('  Keys:', Object.keys(vb))
          console.log('  [0]:', vb[0])
          console.log('  [1]:', vb[1])
          console.log('  [2]:', vb[2])
          console.log('  [3]:', vb[3])
          console.log('  .x:', vb.x)
          console.log('  .y:', vb.y)
          console.log('  .width:', vb.width)
          console.log('  .height:', vb.height)
          console.log('  .left:', vb.left)
          console.log('  .top:', vb.top)
          console.log('  Full object:', JSON.stringify(vb, null, 2))
        }

        // Calculate center-to-center distance
        // vueBounds is an object with {x, y, width, height} properties
        const aVueBounds = nodeA.vueBounds as any
        const bVueBounds = nodeB.vueBounds as any

        const aCenterX = nodeA.position[0] + aVueBounds.width / 2
        const aCenterY = nodeA.position[1] + aVueBounds.height / 2
        const bCenterX = nodeB.position[0] + bVueBounds.width / 2
        const bCenterY = nodeB.position[1] + bVueBounds.height / 2

        const distance = Math.sqrt(
          Math.pow(bCenterX - aCenterX, 2) + Math.pow(bCenterY - aCenterY, 2)
        )

        // Use Vue bounds with LiteGraph positions
        const aLeft = nodeA.position[0]
        const aTop = nodeA.position[1]
        const aRight = aLeft + aVueBounds.width
        const aBottom = aTop + aVueBounds.height

        const bLeft = nodeB.position[0]
        const bTop = nodeB.position[1]
        const bRight = bLeft + bVueBounds.width
        const bBottom = bTop + bVueBounds.height

        // Calculate overlap in both dimensions
        const overlapX = Math.max(
          0,
          Math.min(aRight, bRight) - Math.max(aLeft, bLeft)
        )
        const overlapY = Math.max(
          0,
          Math.min(aBottom, bBottom) - Math.max(aTop, bTop)
        )

        // Debug first few pairs
        if (i < 2 && j < 3) {
          console.log(`Pair ${nodeA.id}-${nodeB.id}:`, {
            aRect: { left: aLeft, top: aTop, right: aRight, bottom: aBottom },
            bRect: { left: bLeft, top: bTop, right: bRight, bottom: bBottom },
            overlapX,
            overlapY,
            overlaps: overlapX > 0 && overlapY > 0
          })
        }

        // Only count as overlap if both dimensions overlap
        if (overlapX > 0 && overlapY > 0) {
          // Use the minimum of the two dimensions as the overlap measure
          const overlap = Math.min(overlapX, overlapY)
          if (overlap > maxOverlap) {
            maxOverlap = overlap
            minDistance = distance
          }
        }
      }
    }

    console.log('Final overlap results:', { maxOverlap, minDistance })
    return { maxOverlap, minDistance: minDistance === Infinity ? 0 : minDistance }
  }

  function scaleNodeProportionally(
    posAndBounds: posAndBounds,
    totalExpansion: number,
    minDistance: number
  ): {
    position: Point
    bounds: ReadOnlyRectangle
  } {
    // If no expansion needed, return original position
    if (totalExpansion <= 0 || minDistance === 0) {
      return {
        position: posAndBounds.position,
        bounds: posAndBounds.bounds
      }
    }

    // Calculate scale factor from expansion distance
    // If lgBounds doesn't exist, use a default scale
    if (!lgBounds || lgBounds[2] === 0) {
      return {
        position: posAndBounds.position,
        bounds: posAndBounds.bounds
      }
    }

    // CORRECT calculation:
    // The closest overlapping nodes are currently minDistance apart
    // We need them to be (minDistance + totalExpansion) apart
    // When we scale from center, distances get multiplied by scaleFactor
    // So: minDistance * scaleFactor = minDistance + totalExpansion
    // Therefore: scaleFactor = (minDistance + totalExpansion) / minDistance
    const scaleFactor = (minDistance + totalExpansion) / minDistance

    console.log('Calculated scale factor:', scaleFactor)
    console.log('This will move the closest nodes from', minDistance.toFixed(1), 'px apart to', (minDistance * scaleFactor).toFixed(1), 'px apart')
    console.log('Increase:', ((minDistance * scaleFactor) - minDistance).toFixed(1), 'px (target was', totalExpansion, 'px)')

    // Calculate center of all litegraph nodes bounding box
    // lgBounds format: [x, y, width, height]
    const centerX = lgBounds[0] + lgBounds[2] / 2
    const centerY = lgBounds[1] + lgBounds[3] / 2

    // Calculate vector from center to node position
    const vectorX = posAndBounds.position[0] - centerX
    const vectorY = posAndBounds.position[1] - centerY

    // Scale the vector
    const scaledVectorX = vectorX * scaleFactor
    const scaledVectorY = vectorY * scaleFactor

    // Calculate new position (center + scaled vector)
    const newPosition: Point = [
      centerX + scaledVectorX,
      centerY + scaledVectorY
    ]

    // Return scaled position and original bounds
    // (Vue will recalculate bounds based on actual rendering)
    return {
      position: newPosition,
      bounds: posAndBounds.bounds
    }
  }

  console.log('Reached the end of the fix overlap code.')
}
