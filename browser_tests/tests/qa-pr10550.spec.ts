import { expect } from '@playwright/test'
import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Dropdown Menu Behavior', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.setupWorkflowsDirectory({})
    // Load a workflow containing a node with a dropdown (e.g., Load Image)
    await comfyPage.workflow.loadWorkflow('load_image_workflow')
  })

  test('should autofocus search input when opening dropdown', async ({
    comfyPage
  }) => {
    const node = comfyPage.page
      .locator('.comfy-node')
      .filter({ hasText: 'Load Image' })

    // Open the dropdown menu by clicking the image selection widget
    await node.locator('button').first().click()

    // The search input should be automatically focused (PR Change)
    const searchInput = comfyPage.page.locator('input[placeholder*="Search"]')
    await expect(searchInput).toBeVisible()
    await expect(searchInput).toBeFocused()
  })

  test('should capture wheel events and prevent canvas zooming', async ({
    comfyPage
  }) => {
    const node = comfyPage.page
      .locator('.comfy-node')
      .filter({ hasText: 'Load Image' })

    // Open the dropdown
    await node.locator('button').first().click()
    const dropdown = comfyPage.page.locator('[data-capture-wheel="true"]')
    await expect(dropdown).toBeVisible()

    // Hover over the dropdown and scroll the mouse wheel
    // In the "Before" state, this would trigger canvas zoom.
    // In the "After" state, the event is captured by the dropdown.
    await dropdown.hover()
    await comfyPage.page.mouse.wheel(0, 500)
    await comfyPage.nextFrame()

    // Verify the canvas hasn't zoomed by checking the node's visual state remains identical
    await expect(node).toHaveScreenshot('canvas-zoom-unchanged.png')
  })
})
