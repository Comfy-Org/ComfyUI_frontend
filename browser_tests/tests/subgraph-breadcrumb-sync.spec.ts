import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Subgraph Breadcrumb Title Sync', () => {
  test('Breadcrumb updates when subgraph node title is changed', async ({
    comfyPage
  }) => {
    // Load a workflow with subgraphs
    await comfyPage.loadWorkflow('nested-subgraph')

    // Get the subgraph node by ID (node 10 is the subgraph)
    const subgraphNode = await comfyPage.getNodeRefById('10')

    // Get node position and double-click on it to enter the subgraph
    const nodePos = await subgraphNode.getPosition()
    const nodeSize = await subgraphNode.getSize()
    await comfyPage.canvas.dblclick({
      position: {
        x: nodePos.x + nodeSize.width / 2,
        y: nodePos.y + nodeSize.height / 2
      },
      delay: 5
    })

    // Wait for breadcrumb to appear
    await comfyPage.page.waitForSelector('.subgraph-breadcrumb')

    // Get initial breadcrumb text
    const breadcrumb = comfyPage.page.locator('.subgraph-breadcrumb')
    const initialBreadcrumbText = await breadcrumb.textContent()

    // Go back to main graph
    await comfyPage.page.keyboard.press('Escape')

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
    const newTitle = 'Updated Subgraph Title'
    await comfyPage.page.keyboard.type(newTitle)
    await comfyPage.page.keyboard.press('Enter')

    // Wait a frame for the update to complete
    await comfyPage.nextFrame()

    // Enter the subgraph again
    await comfyPage.canvas.dblclick({
      position: {
        x: nodePos.x + nodeSize.width / 2,
        y: nodePos.y + nodeSize.height / 2
      },
      delay: 5
    })

    // Wait for breadcrumb
    await comfyPage.page.waitForSelector('.subgraph-breadcrumb')

    // Check that breadcrumb now shows the new title
    const updatedBreadcrumbText = await breadcrumb.textContent()
    expect(updatedBreadcrumbText).toContain(newTitle)
    expect(updatedBreadcrumbText).not.toBe(initialBreadcrumbText)
  })
})
