import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe(
  'Subgraph Internal Operations',
  { tag: ['@slow', '@subgraph'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
      await comfyPage.settings.setSetting(
        'Comfy.NodeSearchBoxImpl',
        'v1 (legacy)'
      )
    })

    test('Can copy and paste nodes in subgraph', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      const initialNodeCount = await comfyPage.subgraph.getNodeCount()

      const nodesInSubgraph = await comfyPage.page.evaluate(() => {
        const nodes = window.app!.canvas.graph!.nodes
        return nodes?.[0]?.id || null
      })

      expect(nodesInSubgraph).not.toBeNull()

      const nodeToClone = await comfyPage.nodeOps.getNodeRefById(
        String(nodesInSubgraph)
      )
      await nodeToClone.click('title')
      await comfyPage.nextFrame()

      await comfyPage.page.keyboard.press('Control+c')
      await comfyPage.nextFrame()

      await comfyPage.page.keyboard.press('Control+v')
      await comfyPage.nextFrame()

      await expect
        .poll(() => comfyPage.subgraph.getNodeCount())
        .toBe(initialNodeCount + 1)
    })

    test('Can undo and redo operations in subgraph', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()

      // Add a node
      await comfyPage.canvasOps.doubleClick()
      await comfyPage.searchBox.fillAndSelectFirstNode('Note')
      await comfyPage.nextFrame()

      // Get initial node count
      const initialCount = await comfyPage.subgraph.getNodeCount()

      // Undo
      await comfyPage.keyboard.undo()
      await comfyPage.nextFrame()

      await expect
        .poll(() => comfyPage.subgraph.getNodeCount())
        .toBe(initialCount - 1)

      // Redo
      await comfyPage.keyboard.redo()
      await comfyPage.nextFrame()

      await expect
        .poll(() => comfyPage.subgraph.getNodeCount())
        .toBe(initialCount)
    })
  }
)
