import type { Locator } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'
import type { TestGraphAccess } from '@e2e/types/globals'
import type { NodeId } from '@/types/nodeId'

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

/**
 * Floor for the measurement zoom, used when the LOD threshold cannot be read.
 * Above the default threshold at DPR >= 1, but a literal cannot stay safe as
 * DPR drops - at DPR 0.5 the threshold is 0.808 - which is why the real zoom
 * is derived on the page from the live threshold instead.
 */
const MEASUREMENT_ZOOM_FLOOR = 0.8

/** Centers the viewport on a node at a zoom derived to sit above the LOD threshold. */
async function centerOnNode(comfyPage: ComfyPage, nodeId: string) {
  await comfyPage.page.evaluate(
    ([id, zoomFloor]) => {
      const canvas = window.app!.canvas
      const graph = window.graph as unknown as TestGraphAccess
      const node = graph._nodes_by_id[id]
      if (!node) {
        // A silent return here surfaces later as an opaque locator timeout
        // pointing at the node rather than at this fixture.
        throw new Error(
          `runtimeReflow: node ${id} not found in the graph; cannot center on it`
        )
      }

      // Derived from the live threshold, reading the same inputs litegraph
      // uses, so a DPR or setting change cannot silently put the measurement
      // below the LOD cutoff where no [data-node-id] exists.
      const minFontSize = canvas.min_font_size_for_lod ?? 0
      const textSize = window.LiteGraph?.NODE_TEXT_SIZE ?? 14
      const lodThreshold =
        minFontSize > 0
          ? minFontSize / (textSize * Math.sqrt(window.devicePixelRatio || 1))
          : 0
      const zoom = Math.max(Number(zoomFloor), lodThreshold * 1.4)

      const element = canvas.canvas
      canvas.ds.scale = Number(zoom)
      canvas.ds.offset[0] =
        -(node.pos[0] + node.size[0] / 2) +
        element.clientWidth / 2 / Number(zoom)
      canvas.ds.offset[1] =
        -(node.pos[1] + node.size[1] / 2) +
        element.clientHeight / 2 / Number(zoom)
      canvas.setDirty(true, true)
    },
    [nodeId, MEASUREMENT_ZOOM_FLOOR] as const
  )
  await comfyPage.nextFrame()
}

/**
 * Adds a reflow node, centers it at a deterministic zoom, and captures its
 * starting height so a test can assert on the height delta after triggering
 * runtime growth.
 *
 * Fit-to-view alone can land below the LOD threshold on this workflow, where
 * no Vue node elements exist at all, so the node is centered at a fixed zoom
 * instead of measured wherever fit happens to leave it.
 */
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
