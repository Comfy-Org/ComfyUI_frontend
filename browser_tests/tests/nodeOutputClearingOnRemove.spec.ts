import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

async function getNodeOutputImageCount(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<number> {
  return await comfyPage.page.evaluate(
    (id) => window.app!.nodeOutputs?.[id]?.images?.length ?? 0,
    nodeId
  )
}

async function seedNodeOutput(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<void> {
  await comfyPage.page.evaluate((id) => {
    window.app!.nodeOutputs[id] = {
      images: [
        { filename: 'seeded-preview.png', subfolder: '', type: 'output' }
      ]
    }
  }, nodeId)
}

test.describe('Node output cleanup on removal', { tag: '@workflow' }, () => {
  test('Deleting a node clears its outputs from the store', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'regression',
      description:
        'Pressing delete left previews behind because nodeOutputStore did not listen to onNodeRemoved'
    })

    const node = (await comfyPage.nodeOps.getFirstNodeRef())!
    expect(node).toBeTruthy()
    const nodeId = String(node.id)

    await seedNodeOutput(comfyPage, nodeId)
    await expect.poll(() => getNodeOutputImageCount(comfyPage, nodeId)).toBe(1)

    await node.click('title')
    await comfyPage.page.keyboard.press('Delete')

    await expect.poll(() => getNodeOutputImageCount(comfyPage, nodeId)).toBe(0)
  })

  test('Undoing a node addition clears outputs produced for the removed node', async ({
    comfyPage
  }) => {
    test.info().annotations.push({
      type: 'regression',
      description:
        'Undo removed the node but left its preview rendered because the removal lifecycle did not invalidate nodeOutputStore'
    })

    const initialNodeCount = await comfyPage.nodeOps.getGraphNodesCount()

    await comfyPage.canvasOps.clickEmptySpace()
    await comfyPage.page.keyboard.press('Control+a')

    const addedNodeId = await comfyPage.page.evaluate(() => {
      const litegraph = window.LiteGraph
      if (!litegraph) throw new Error('LiteGraph is not available on window')
      const graph = window.app!.graph
      const registered = litegraph.registered_node_types
      const typeName = registered['LoadImage']
        ? 'LoadImage'
        : registered['PreviewImage']
          ? 'PreviewImage'
          : undefined
      if (!typeName) {
        throw new Error('No suitable node type registered for the test')
      }
      const node = litegraph.createNode(typeName)
      if (!node) throw new Error('Failed to create test node')
      graph.add(node)
      return String(node.id)
    })

    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount())
      .toBe(initialNodeCount + 1)

    await seedNodeOutput(comfyPage, addedNodeId)
    await expect
      .poll(() => getNodeOutputImageCount(comfyPage, addedNodeId))
      .toBe(1)

    await comfyPage.canvasOps.clickEmptySpace()
    await comfyPage.keyboard.undo()

    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount())
      .toBe(initialNodeCount)
    await expect
      .poll(() => getNodeOutputImageCount(comfyPage, addedNodeId))
      .toBe(0)
  })
})
