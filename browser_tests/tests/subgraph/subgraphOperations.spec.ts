import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Subgraph Operations', { tag: ['@slow', '@subgraph'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
    await comfyPage.settings.setSetting(
      'Comfy.NodeSearchBoxImpl',
      'v1 (legacy)'
    )
  })

  test.describe('Subgraph Clipboard Operations', () => {
    test('Can copy and paste nodes inside a subgraph', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      const initialNodeCount = await comfyPage.subgraph.getNodeCount()

      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const nodes = window.app!.canvas.graph!.nodes
            return nodes?.[0]?.id ?? null
          })
        )
        .not.toBeNull()

      const nodeId = await comfyPage.page.evaluate(() => {
        const nodes = window.app!.canvas.graph!.nodes
        return nodes?.[0]?.id ?? null
      })

      const nodeToClone = await comfyPage.nodeOps.getNodeRefById(String(nodeId))
      await nodeToClone.click('title')

      await comfyPage.page.keyboard.press('ControlOrMeta+c')
      await comfyPage.nextFrame()

      await comfyPage.page.keyboard.press('ControlOrMeta+v')
      await comfyPage.nextFrame()

      await expect
        .poll(() => comfyPage.subgraph.getNodeCount())
        .toBe(initialNodeCount + 1)
    })
  })

  test.describe('Subgraph History Operations', () => {
    test('Can undo and redo operations inside a subgraph', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      await comfyPage.canvasOps.doubleClick()
      await comfyPage.searchBox.fillAndSelectFirstNode('Note')
      await comfyPage.nextFrame()

      const initialCount = await comfyPage.subgraph.getNodeCount()

      await comfyPage.keyboard.undo()
      await comfyPage.nextFrame()

      await expect
        .poll(() => comfyPage.subgraph.getNodeCount())
        .toBe(initialCount - 1)

      await comfyPage.keyboard.redo()
      await comfyPage.nextFrame()

      await expect
        .poll(() => comfyPage.subgraph.getNodeCount())
        .toBe(initialCount)
    })
  })
})
