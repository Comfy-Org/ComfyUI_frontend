import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

test.describe('Properties panel - Errors tab', () => {
  let panel: PropertiesPanelHelper

  test.beforeEach(async ({ comfyPage }) => {
    panel = new PropertiesPanelHelper(comfyPage.page)
  })

  test('should show Errors tab when errors exist', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(
      'Comfy.RightSidePanel.ShowErrorsTab',
      true
    )
    await comfyPage.workflow.loadWorkflow('missing/missing_nodes')
    await comfyPage.actionbar.propertiesButton.click()
    await comfyPage.nextFrame()

    await expect(panel.errorsTabIcon).toBeVisible()
  })

  test('should not show Errors tab when errors are disabled', async ({
    comfyPage
  }) => {
    await comfyPage.actionbar.propertiesButton.click()
    await expect(panel.errorsTabIcon).not.toBeVisible()
  })
})
