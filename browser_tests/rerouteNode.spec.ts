import { expect } from '@playwright/test'
import { comfyPageFixture as test } from './fixtures/ComfyPage'

test.describe('Reroute Node', () => {
  const WORKFLOW_NAME = 'reroute_nodes.json'

  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
  })

  test('loads from inserted workflow', async ({ comfyPage }) => {
    await comfyPage.setupWorkflowsDirectory({
      [WORKFLOW_NAME]: WORKFLOW_NAME
    })
    await comfyPage.setup()

    await comfyPage.menu.workflowsTab.open()
    await comfyPage.menu.workflowsTab
      .getPersistedItem(WORKFLOW_NAME)
      .click({ button: 'right' })

    const insertButton = comfyPage.page.locator('.p-contextmenu-item-link', {
      hasText: 'Insert'
    })
    await insertButton.click()

    await expect(comfyPage.canvas).toHaveScreenshot('reroute_inserted.png')
  })
})
