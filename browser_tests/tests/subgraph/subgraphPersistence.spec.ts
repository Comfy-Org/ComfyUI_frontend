import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

test.describe('Subgraph Node Library Persistence', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
    // Open the node library sidebar
    const tab = comfyPage.menu.nodeLibraryTab
    await tab.open()
  })

  test('Node library updates when subgraph node title is changed', async ({
    comfyPage
  }) => {
    // Load a workflow with subgraphs
    await comfyPage.loadWorkflow('nested-subgraph')
    await comfyPage.nextFrame()

    const tab = comfyPage.menu.nodeLibraryTab

    // Navigate to subgraphs folder in node library
    await tab.getFolder('subgraph').click()
    await comfyPage.nextFrame()

    // Get initial subgraph node name in the library
    const subgraphNodeInLibrary = tab.getNode('Subgraph Node')
    const initialNodeExists = await subgraphNodeInLibrary.count()
    expect(initialNodeExists).toBeGreaterThan(0)

    // Get the subgraph node by ID (node 10 is the subgraph)
    const subgraphNode = await comfyPage.getNodeRefById('10')

    // Get node position for title editing
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
    const newTitle = 'Updated Subgraph Node'
    await comfyPage.page.keyboard.type(newTitle)
    await comfyPage.page.keyboard.press('Enter')

    // Wait a frame for the update to complete
    await comfyPage.nextFrame()

    // Verify the node library shows the updated title
    const updatedNodeInLibrary = tab.getNode(newTitle)
    expect(await updatedNodeInLibrary.count()).toBeGreaterThan(0)

    // Verify the old node name is no longer in the library
    const oldNodeInLibrary = tab.getNode('Subgraph Node')
    expect(await oldNodeInLibrary.count()).toBe(0)
  })
})
