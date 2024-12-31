import { expect } from '@playwright/test'

import { comfyPageFixture as test } from './fixtures/ComfyPage'

test.describe('Reroute Node', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.setupWorkflowsDirectory({})
  })

  test('loads from inserted workflow', async ({ comfyPage }) => {
    const workflowName = 'single_connected_reroute_node.json'
    await comfyPage.setupWorkflowsDirectory({
      [workflowName]: workflowName
    })
    await comfyPage.setup()
    await comfyPage.menu.topbar.triggerTopbarCommand(['Workflow', 'New'])

    // Insert the workflow
    const workflowsTab = comfyPage.menu.workflowsTab
    await workflowsTab.open()
    await workflowsTab.getPersistedItem(workflowName).click({ button: 'right' })
    const insertButton = comfyPage.page.locator('.p-contextmenu-item-link', {
      hasText: 'Insert'
    })
    await insertButton.click()

    // Close the sidebar tab
    await workflowsTab.tabButton.click()
    await workflowsTab.root.waitFor({ state: 'hidden' })
    await comfyPage.setFocusMode(true)

    await expect(comfyPage.canvas).toHaveScreenshot('reroute_inserted.png')
  })
})
