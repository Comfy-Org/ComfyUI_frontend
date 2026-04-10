import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe('Errors tab - Execution errors', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.RightSidePanel.ShowErrorsTab',
      true
    )
    await comfyPage.setup()
  })

  async function openExecutionErrorTab(comfyPage: ComfyPage) {
    await comfyPage.workflow.loadWorkflow('nodes/execution_error')
    await comfyPage.command.executeCommand('Comfy.QueuePrompt')

    const errorOverlay = comfyPage.page.getByTestId(
      TestIds.dialogs.errorOverlay
    )
    await expect(errorOverlay).toBeVisible()
    await errorOverlay
      .getByTestId(TestIds.dialogs.errorOverlaySeeErrors)
      .click()
    await expect(errorOverlay).not.toBeVisible()
  }

  test('Should show Find on GitHub and Copy buttons in error card', async ({
    comfyPage
  }) => {
    await openExecutionErrorTab(comfyPage)

    await expect(
      comfyPage.page.getByTestId(TestIds.dialogs.errorCardFindOnGithub)
    ).toBeVisible()
    await expect(
      comfyPage.page.getByTestId(TestIds.dialogs.errorCardCopy)
    ).toBeVisible()
  })

  test('Should show error message in runtime error panel', async ({
    comfyPage
  }) => {
    await openExecutionErrorTab(comfyPage)

    const runtimePanel = comfyPage.page.getByTestId(
      TestIds.dialogs.runtimeErrorPanel
    )
    await expect(runtimePanel).toBeVisible()
    await expect(runtimePanel).toContainText(/\S/)
  })
})
