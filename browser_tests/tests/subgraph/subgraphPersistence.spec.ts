import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Subgraph Persistence', () => {
  test('Node library updates when subgraph title changes', async ({
    comfyPage
  }) => {
    // Load a workflow with subgraphs to populate the node library
    await comfyPage.loadWorkflow('nested-subgraph')
    await comfyPage.nextFrame()

    const tab = comfyPage.menu.nodeLibraryTab

    // Navigate to subgraph folder in node library
    await tab.getFolder('subgraph').click()
    await comfyPage.nextFrame()

    // Get initial subgraph node name in the library
    const initialSubgraphNodeCount = await tab.getNode('Subgraph Node').count()
    expect(initialSubgraphNodeCount).toBeGreaterThan(0)

    // Get the subgraph node by ID (node 10 is the subgraph)
    const subgraphNode = await comfyPage.getNodeRefById('10')
    const nodePos = await subgraphNode.getPosition()
    const nodeSize = await subgraphNode.getSize()

    // Double-click on the title area of the subgraph node to edit
    await comfyPage.canvas.dblclick({
      position: {
        x: nodePos.x + nodeSize.width / 2,
        y: nodePos.y - 10 // Title area is above the node body
      },
      delay: 5
    })

    // Wait for title editor to appear
    await expect(comfyPage.page.locator('.node-title-editor')).toBeVisible()

    // Clear existing text and type new title
    await comfyPage.page.keyboard.press('Control+a')
    const newTitle = 'Renamed Subgraph Node'
    await comfyPage.page.keyboard.type(newTitle)
    await comfyPage.page.keyboard.press('Enter')

    // Wait a frame for the update to complete
    await comfyPage.nextFrame()

    // Verify the node library shows the updated title
    expect(await tab.getNode(newTitle).count()).toBeGreaterThan(0)

    // Verify the old node name is no longer in the library
    expect(await tab.getNode('Subgraph Node').count()).toBe(0)
  })
})
