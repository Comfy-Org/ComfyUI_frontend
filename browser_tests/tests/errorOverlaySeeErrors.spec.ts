import type { Page } from '@playwright/test'

import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe('Error overlay See Errors flow', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.RightSidePanel.ShowErrorsTab',
      true
    )
    await comfyPage.setup()
  })

  async function triggerExecutionError(comfyPage: {
    canvasOps: { disconnectEdge: () => Promise<void> }
    page: Page
    command: { executeCommand: (cmd: string) => Promise<void> }
  }) {
    await comfyPage.canvasOps.disconnectEdge()
    await comfyPage.page.keyboard.press('Escape')
    await comfyPage.command.executeCommand('Comfy.QueuePrompt')
  }

  test('Error overlay appears on execution error', async ({ comfyPage }) => {
    await triggerExecutionError(comfyPage)

    await expect(
      comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
    ).toBeVisible()
  })

  test('Error overlay shows error message', async ({ comfyPage }) => {
    await triggerExecutionError(comfyPage)

    const overlay = comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
    await expect(overlay).toBeVisible()
    await expect(overlay).toHaveText(/\S/)
  })

  test('"See Errors" opens right side panel', async ({ comfyPage }) => {
    await triggerExecutionError(comfyPage)

    const overlay = comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
    await expect(overlay).toBeVisible()

    await overlay.getByTestId(TestIds.dialogs.errorOverlaySeeErrors).click()

    await expect(comfyPage.page.getByTestId('properties-panel')).toBeVisible()
  })

  test('"See Errors" dismisses the overlay', async ({ comfyPage }) => {
    await triggerExecutionError(comfyPage)

    const overlay = comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
    await expect(overlay).toBeVisible()

    await overlay.getByTestId(TestIds.dialogs.errorOverlaySeeErrors).click()

    await expect(overlay).not.toBeVisible()
  })

  test('"Dismiss" closes overlay without opening panel', async ({
    comfyPage
  }) => {
    await triggerExecutionError(comfyPage)

    const overlay = comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
    await expect(overlay).toBeVisible()

    await overlay.getByTestId(TestIds.dialogs.errorOverlayDismiss).click()

    await expect(overlay).not.toBeVisible()
    await expect(
      comfyPage.page.getByTestId('properties-panel')
    ).not.toBeVisible()
  })

  test('Close button (X) dismisses overlay', async ({ comfyPage }) => {
    await triggerExecutionError(comfyPage)

    const overlay = comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
    await expect(overlay).toBeVisible()

    await overlay.getByRole('button', { name: /close/i }).click()

    await expect(overlay).not.toBeVisible()
  })
})
