import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Subgraph Breadcrumb Title Sync', () => {
  test('Breadcrumb updates when subgraph node title is changed', async ({
    comfyPage
  }) => {
    // Load a workflow with subgraphs
    await comfyPage.loadWorkflow('subgraph_example')

    // Get the first subgraph node
    const subgraphNode = await comfyPage.canvas.locator('.node').first()

    // Double-click on the subgraph node to enter it
    await subgraphNode.dblclick()

    // Wait for breadcrumb to appear
    await comfyPage.page.waitForSelector('.subgraph-breadcrumb')

    // Get initial breadcrumb text
    const breadcrumb = comfyPage.page.locator('.subgraph-breadcrumb')
    const initialBreadcrumbText = await breadcrumb.textContent()

    // Go back to main graph
    await comfyPage.page.keyboard.press('Escape')

    // Double-click on the title area of the subgraph node to edit
    const nodeBounds = await subgraphNode.boundingBox()
    if (!nodeBounds) throw new Error('Node bounds not found')

    await comfyPage.canvas.dblclick({
      position: {
        x: nodeBounds.x + nodeBounds.width / 2,
        y: nodeBounds.y + 10 // Title area
      }
    })

    // Type new title
    const newTitle = 'Updated Subgraph Title'
    await comfyPage.page.keyboard.type(newTitle)
    await comfyPage.page.keyboard.press('Enter')

    // Enter the subgraph again
    await subgraphNode.dblclick()

    // Wait for breadcrumb
    await comfyPage.page.waitForSelector('.subgraph-breadcrumb')

    // Check that breadcrumb now shows the new title
    const updatedBreadcrumbText = await breadcrumb.textContent()
    expect(updatedBreadcrumbText).toContain(newTitle)
    expect(updatedBreadcrumbText).not.toBe(initialBreadcrumbText)
  })
})
