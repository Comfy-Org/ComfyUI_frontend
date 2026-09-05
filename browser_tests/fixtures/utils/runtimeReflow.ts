import type { Locator } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'
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
 * Adds a reflow node, fits it into view, and captures its starting height so a
 * test can assert on the height delta after triggering runtime growth.
 */
export async function addReflowNodeAndMeasure(
  comfyPage: ComfyPage
): Promise<ReflowNodeUnderTest> {
  const nodeId = await addRuntimeReflowNode(comfyPage)
  await fitToViewInstant(comfyPage)

  const node = comfyPage.vueNodes.getNodeLocator(nodeId)
  await expect(node).toBeVisible()
  const initialHeight = (await node.boundingBox())!.height

  return { nodeId, node, initialHeight }
}
