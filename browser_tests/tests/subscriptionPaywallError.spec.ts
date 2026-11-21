import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { PromptFailureResponse } from '@comfyorg/api-client/types'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe('Subscription paywall on queue', { tag: '@ui' }, () => {
  test.use({ initialSettings: { 'Comfy.RightSidePanel.ShowErrorsTab': true } })

  async function mockQueueError(
    page: Page,
    error: PromptFailureResponse['error']
  ) {
    const body: PromptFailureResponse = { node_errors: {}, error }
    await page.route('**/api/prompt', async (route) => {
      await route.fulfill({
        status: 402,
        contentType: 'application/json',
        body: JSON.stringify(body)
      })
    })
  }

  test('falls back when the subscription dialog is unavailable', async ({
    comfyPage
  }) => {
    await mockQueueError(comfyPage.page, {
      type: 'PAYMENT_REQUIRED',
      message: 'Subscription required to queue workflows',
      details: ''
    })

    const queued = comfyPage.page.waitForResponse('**/api/prompt')
    await comfyPage.actionbar.queueButton.primaryButton.click()
    await queued
    await comfyPage.nextFrame()

    await expect(
      comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
    ).toBeVisible()
  })

  test('still surfaces ordinary queue errors in the error panel', async ({
    comfyPage
  }) => {
    await mockQueueError(comfyPage.page, {
      type: 'server_error',
      message: 'The server exploded',
      details: ''
    })

    const queued = comfyPage.page.waitForResponse('**/api/prompt')
    await comfyPage.actionbar.queueButton.primaryButton.click()
    await queued

    await expect(
      comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
    ).toBeVisible()
  })
})
