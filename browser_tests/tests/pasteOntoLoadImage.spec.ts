import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import type { NodeReference } from '@e2e/fixtures/utils/litegraphUtils'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

async function selectNode(comfyPage: ComfyPage, node: NodeReference) {
  await node.click('title')
  await expect
    .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
    .toEqual([node.id])
}

test.describe(
  'Pasting onto a selected LoadImage node',
  { tag: ['@node'] },
  () => {
    test('pastes only the latest copy the clipboard still holds', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('nodes/load_image_with_ksampler')
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(2)
      await comfyPage.canvasOps.pan({ x: 0, y: 200 }, { x: 1000, y: 600 })
      const [ksampler] = await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      const [loadImage] = await comfyPage.nodeOps.getNodeRefsByType('LoadImage')

      await test.step('Ctrl+V after another app replaced the clipboard adds nothing', async () => {
        await selectNode(comfyPage, ksampler)
        await comfyPage.clipboard.copy()
        await comfyPage.clipboard.writeText('copied in another app')
        await selectNode(comfyPage, loadImage)
        await comfyPage.clipboard.paste()
      })

      await test.step('Ctrl+V after a fresh Ctrl+C adds one node', async () => {
        await selectNode(comfyPage, ksampler)
        await comfyPage.clipboard.copy()
        await selectNode(comfyPage, loadImage)
        await comfyPage.clipboard.paste()
        await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(3)
      })
    })
  }
)
