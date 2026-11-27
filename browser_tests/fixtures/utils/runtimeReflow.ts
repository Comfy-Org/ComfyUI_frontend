import type { Locator } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'
import type { TestGraphAccess } from '@e2e/types/globals'
import type { NodeId } from '@comfyorg/graph-model/nodeId'

/** Minimum height gain (px) a reflow must produce to count as a grow. */
export const REFLOW_GROWTH_THRESHOLD = 40

async function addRuntimeReflowNode(comfyPage: ComfyPage): Promise<NodeId> {
  const node = await comfyPage.nodeOps.addNode('DevToolsNodeWithStringInput')
  return node.id
}

interface ReflowNodeUnderTest {
  nodeId: NodeId
  node: Locator
  initialHeight: number
}

const MEASUREMENT_ZOOM_FLOOR = 0.8

async function centerOnNode(comfyPage: ComfyPage, nodeId: string) {
  await comfyPage.page.evaluate(
    ([id, zoomFloor]) => {
      const canvas = window.app!.canvas
      const graph = window.graph as TestGraphAccess
      const node = graph._nodes_by_id[id]
      if (!node) {
        throw new Error(
          `runtimeReflow: node ${id} not found in the graph; cannot center on it`
        )
      }

      const minFontSize = canvas.min_font_size_for_lod
      const textSize = window.LiteGraph?.NODE_TEXT_SIZE ?? 14
      const lodThreshold =
        minFontSize > 0
          ? minFontSize / (textSize * Math.sqrt(window.devicePixelRatio || 1))
          : 0
      const zoom = Math.max(zoomFloor, lodThreshold * 1.4)

      const element = canvas.canvas
      canvas.ds.scale = zoom
      canvas.ds.offset[0] =
        -(node.pos[0] + node.size[0] / 2) + element.clientWidth / 2 / zoom
      canvas.ds.offset[1] =
        -(node.pos[1] + node.size[1] / 2) + element.clientHeight / 2 / zoom
      canvas.setDirty(true, true)
    },
    [nodeId, MEASUREMENT_ZOOM_FLOOR] as const
  )
  await comfyPage.nextFrame()
}

/** Adds a reflow node, centers it above the LOD threshold, and captures its starting height. */
export async function addReflowNodeAndMeasure(
  comfyPage: ComfyPage
): Promise<ReflowNodeUnderTest> {
  const nodeId = await addRuntimeReflowNode(comfyPage)
  await fitToViewInstant(comfyPage)
  await centerOnNode(comfyPage, nodeId)

  const node = comfyPage.vueNodes.getNodeLocator(nodeId)
  await expect(node).toBeVisible()
  const initialHeight = (await node.boundingBox())!.height

  return { nodeId, node, initialHeight }
}
