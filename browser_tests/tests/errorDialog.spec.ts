import type { Page } from '@playwright/test'

import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import {
  interceptClipboardWrite,
  getClipboardText
} from '@e2e/helpers/clipboardSpy'

async function triggerConfigureError(
  comfyPage: ComfyPage,
  message = 'Error on configure!'
) {
  await comfyPage.page.evaluate((msg: string) => {
    const graph = window.graph!
    ;(graph as { configure: () => void }).configure = () => {
      throw new Error(msg)
    }
  }, message)

  await comfyPage.workflow.loadWorkflow('default')

  return comfyPage.page.getByTestId(TestIds.dialogs.errorDialog)
}

async function waitForPopupNavigation(page: Page, action: () => Promise<void>) {
  const popupPromise = page.waitForEvent('popup')
  await action()
  const popup = await popupPromise
  await popup.waitForLoadState()
  return popup
}

test.describe('Error dialog', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
  })

  test('Should display an error dialog when graph configure fails', async ({
    comfyPage
  }) => {
    const errorDialog = await triggerConfigureError(comfyPage)
    await expect(errorDialog).toBeVisible()
  })

  test('Should display an error dialog when prompt execution fails', async ({
    comfyPage
  }) => {
    await comfyPage.page.evaluate(async () => {
      const app = window.app!
      app.api.queuePrompt = () => {
        throw new Error('Error on queuePrompt!')
      }
      await app.queuePrompt(0)
    })
    const errorDialog = comfyPage.page.getByTestId(TestIds.dialogs.errorDialog)
    await expect(errorDialog).toBeVisible()
  })

  test('Should display error message body', async ({ comfyPage }) => {
    const errorDialog = await triggerConfigureError(
      comfyPage,
      'Test error message body'
    )
    await expect(errorDialog).toBeVisible()
    await expect(errorDialog).toContainText('Test error message body')
  })

  test('Should show report section when "Show Report" is clicked', async ({
    comfyPage
  }) => {
    const errorDialog = await triggerConfigureError(comfyPage)
    await expect(errorDialog).toBeVisible()
    await expect(errorDialog.locator('pre')).not.toBeVisible()

    await errorDialog.getByTestId(TestIds.dialogs.errorDialogShowReport).click()

    const reportPre = errorDialog.locator('pre')
    await expect(reportPre).toBeVisible()
    await expect(reportPre).toHaveText(/\S/)
    await expect(
      errorDialog.getByTestId(TestIds.dialogs.errorDialogShowReport)
    ).not.toBeVisible()
  })

  test('Should copy report to clipboard when "Copy to Clipboard" is clicked', async ({
    comfyPage
  }) => {
    const errorDialog = await triggerConfigureError(comfyPage)
    await expect(errorDialog).toBeVisible()

    await errorDialog.getByTestId(TestIds.dialogs.errorDialogShowReport).click()
    await expect(errorDialog.locator('pre')).toBeVisible()

    await interceptClipboardWrite(comfyPage.page)

    await errorDialog.getByTestId(TestIds.dialogs.errorDialogCopyReport).click()

    const reportText = await errorDialog.locator('pre').textContent()
    const copiedText = await getClipboardText(comfyPage.page)
    expect(copiedText).toBe(reportText)
  })

  test('Should open GitHub issues search when "Find Issues" is clicked', async ({
    comfyPage
  }) => {
    const errorDialog = await triggerConfigureError(comfyPage)
    await expect(errorDialog).toBeVisible()

    const popup = await waitForPopupNavigation(comfyPage.page, () =>
      errorDialog.getByTestId(TestIds.dialogs.errorDialogFindIssues).click()
    )

    const url = new URL(popup.url())
    expect(url.hostname).toBe('github.com')
    expect(url.pathname).toContain('/issues')

    await popup.close()
  })

  test('Should open contact support when "Help Fix This" is clicked', async ({
    comfyPage
  }) => {
    const errorDialog = await triggerConfigureError(comfyPage)
    await expect(errorDialog).toBeVisible()

    const popup = await waitForPopupNavigation(comfyPage.page, () =>
      errorDialog.getByTestId(TestIds.dialogs.errorDialogContactSupport).click()
    )

    const url = new URL(popup.url())
    expect(url.hostname).toBe('support.comfy.org')

    await popup.close()
  })
})
