import { expect } from '@playwright/test'
import { comfyPageFixture as test } from './fixtures/ComfyPage'

test.describe('Templates', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Disabled')
  })

  test('Can load template workflows', async ({ comfyPage }) => {
    // This test will need expanding on once the templates are decided

    // Clear the workflow
    await comfyPage.menu.workflowsTab.open()
    await comfyPage.menu.workflowsTab.newBlankWorkflowButton.click()
    await expect(async () => {
      expect(await comfyPage.getGraphNodesCount()).toBe(0)
    }).toPass({ timeout: 250 })

    // Load a template
    await comfyPage.menu.workflowsTab.browseGalleryButton.click()
    await expect(comfyPage.templates.content).toBeVisible()
    await comfyPage.templates.loadTemplate('default')
    await expect(comfyPage.templates.content).toBeHidden()

    // Ensure we now have some nodes
    await expect(async () => {
      expect(await comfyPage.getGraphNodesCount()).toBeGreaterThan(0)
    }).toPass({ timeout: 250 })
  })
})
