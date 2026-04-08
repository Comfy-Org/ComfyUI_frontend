import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

test.describe('Errors tab - common', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.RightSidePanel.ShowErrorsTab',
      true
    )
  })

  test.describe('Tab visibility', () => {
    test('Should show Errors tab when errors exist', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('missing/missing_nodes')
      await comfyPage.actionbar.propertiesButton.click()
      await comfyPage.nextFrame()

      const panel = new PropertiesPanelHelper(comfyPage.page)
      await expect(panel.errorsTabIcon).toBeVisible()
    })

    test('Should not show Errors tab when setting is disabled', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('missing/missing_nodes')
      await comfyPage.settings.setSetting(
        'Comfy.RightSidePanel.ShowErrorsTab',
        false
      )
      await comfyPage.actionbar.propertiesButton.click()
      await comfyPage.nextFrame()

      const panel = new PropertiesPanelHelper(comfyPage.page)
      await expect(panel.errorsTabIcon).not.toBeVisible()
    })
  })

  test.describe('Search and filter', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.setup()
    })

    test('Should filter execution errors by search query', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('nodes/execution_error')
      await comfyPage.command.executeCommand('Comfy.QueuePrompt')
      await comfyPage.nextFrame()

      const errorOverlay = comfyPage.page.getByTestId(
        TestIds.dialogs.errorOverlay
      )
      await expect(errorOverlay).toBeVisible()
      await errorOverlay
        .getByTestId(TestIds.dialogs.errorOverlaySeeErrors)
        .click()

      const runtimePanel = comfyPage.page.getByTestId(
        TestIds.dialogs.runtimeErrorPanel
      )
      await expect(runtimePanel).toBeVisible()

      const searchInput = comfyPage.page.getByPlaceholder(/^Search/)
      await searchInput.fill('nonexistent_query_xyz_12345')

      await expect(runtimePanel).not.toBeVisible()
    })
  })
})
