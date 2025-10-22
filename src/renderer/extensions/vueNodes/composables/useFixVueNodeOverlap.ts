import type { Rect } from '@/lib/litegraph/src/interfaces'
import { createBounds } from '@/lib/litegraph/src/measure'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { NodeBoundsUpdate } from '@/renderer/core/layout/types'
import { app as comfyApp } from '@/scripts/app'

//Currently this works well. The performance is good.
//The issue:
// 1. It runs every time shouldRenderVueNodes changes from false to true.
//    a: we might be able to track some localstorage or other variable that essentially will update if it has run, and then check if its already been run
//       the issue with this is this is not persisted in the workflow, so if a user switches from litegraph to vuenodes and then saves the workflow and gives
//       it to someone, the workflow is then loaded and there is no way to detect it was already switched. So the code will run again.
//    b: if we try to store 2 seperate layouts the LG layout and the vue node layout in the workflow this simplifies the check, with positions but would require
//       us to change the logic on how we actually read the positions and it would mean we would have to monkey patch or have logic to detect workflows version
// 2. It doesn't run if shouldRenderVueNodes already equals true && loading new workflow
//    a: we could change the location of where this is run so instead of the useVueNodeLifecycle we instead run it in the load workflow area of the app.
//       this means that we can check to see if vue nodes is on and then handle the call to this function there. This would mean it solves the run on new workflow
//       but it wouldnt handle the already in workflow switch from LG to Vue node mode. So that means we would still need to manage that somehow.
//    b: maybe there is an even better location to run this. The crucial thing to consider is ideally we will need to allow for switching between LG mode and vue node mode.
//       so if the code mutates the LG level graph.nodes before the vue node switches, we would need to store a reference that this change happened because of the
//       vue node mode switch, either store the litegraph mode seperately in the app or in the workflow (which has pros and cons) the quesiton is now, would it be drastically
//       simplier to make it so we dont need to store or preserve the mode when we switch from Vue node mode back to litegraph? My instinct is yes and for now, if that is true
//       that in this system not needing to manage the switch back from Vue node to LG would be significantly easier than we should not do it. But if it slots into the system
//       by leveraging this then we should do it.
// 3. If switching back to litegraph shouldRenderVueNodes = false it doesnt reset the layout back to the litegraph version.
//    a: this is the same question above as 2(b) we need to first verify that it is even worth it. And if its more challenging to implement and not less.

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
