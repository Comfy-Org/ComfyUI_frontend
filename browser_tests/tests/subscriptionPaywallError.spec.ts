import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { PromptResponse } from '@/schemas/apiSchema'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

// Regression for #12840: a free-tier paywall on queue (`POST /prompt` 402 with
// `{ error: { type: 'PAYMENT_REQUIRED', message: 'Subscription required to
// queue workflows' } }`) is an account precondition. When the subscription modal
// can open it takes over the panel; when it cannot (non-cloud / subscription mode
// off, as in this OSS test build) the paywall must fall back to the error panel
// instead of being dropped from every surface.
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

  test('falls back to the error panel when the subscription modal cannot open', async ({
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
