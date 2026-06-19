import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { PromptResponse } from '@/schemas/apiSchema'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

// Regression for #12840: a free-tier paywall on queue (`POST /prompt` 402 with
// `{ error: { type: 'PAYMENT_REQUIRED', message: 'Subscription required to
// queue workflows' } }`) is an account precondition. It must open its own modal
// and stay out of the error panel, instead of surfacing the raw backend string
// with non-actionable Find-on-GitHub / Copy actions.
test.describe('Subscription paywall on queue', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(
      'Comfy.RightSidePanel.ShowErrorsTab',
      true
    )
  })

  async function mockQueueError(page: Page, error: PromptResponse['error']) {
    const body: PromptResponse = { node_errors: {}, error }
    await page.route('**/api/prompt', async (route) => {
      await route.fulfill({
        status: 402,
        contentType: 'application/json',
        body: JSON.stringify(body)
      })
    })
  }

  test('keeps the subscription paywall out of the error panel', async ({
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

    await expect(
      comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
    ).toBeHidden()
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
