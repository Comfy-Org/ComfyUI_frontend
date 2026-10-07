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
    for (const { title, replacedByOtherApp, nodeCount } of [
      {
        title: 'pastes the copied node while the clipboard still holds it',
        replacedByOtherApp: false,
        nodeCount: 3
      },
      {
        title: 'skips the copied node once another app replaced the clipboard',
        replacedByOtherApp: true,
        nodeCount: 2
      }
    ]) {
      test(title, async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow('nodes/load_image_with_ksampler')
        await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(2)
        await comfyPage.canvasOps.pan({ x: 0, y: 200 }, { x: 1000, y: 600 })
        const [ksampler] = await comfyPage.nodeOps.getNodeRefsByType('KSampler')
        const [loadImage] =
          await comfyPage.nodeOps.getNodeRefsByType('LoadImage')

        await selectNode(comfyPage, ksampler)
        await comfyPage.clipboard.copy()
        if (replacedByOtherApp) {
          await comfyPage.clipboard.writeText('copied in another app')
        }
        await selectNode(comfyPage, loadImage)
        await comfyPage.clipboard.paste()

        await expect
          .poll(() => comfyPage.nodeOps.getGraphNodesCount())
          .toBe(nodeCount)
      })
    }
  }
)
