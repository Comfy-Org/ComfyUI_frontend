import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { CancelSubscriptionDialog } from '@e2e/fixtures/components/CancelSubscriptionDialog'

test.describe('CancelSubscription dialog', { tag: '@ui' }, () => {
  let dialog: CancelSubscriptionDialog

  test.beforeEach(async ({ comfyPage }) => {
    dialog = new CancelSubscriptionDialog(comfyPage.page)
  })

  test('displays dialog with title and formatted date', async () => {
    await dialog.open('2025-12-31T12:00:00Z')

    await expect(dialog.heading).toBeVisible()
    await expect(dialog.root).toContainText('December 31, 2025')
  })

  test('"Keep subscription" button closes dialog', async () => {
    await dialog.open()

    await dialog.keepSubscriptionButton.click()
    await expect(dialog.root).toBeHidden()
  })

  test('Escape key closes dialog', async ({ comfyPage }) => {
    await dialog.open()

    await comfyPage.page.keyboard.press('Escape')
    await expect(dialog.root).toBeHidden()
  })

  test('"Cancel subscription" button initiates cancellation flow', async () => {
    await dialog.open()

    await expect(dialog.confirmCancelButton).toBeEnabled()

    await dialog.confirmCancelButton.click()

    // Next state: dialog closes once the cancellation flow completes
    await expect(dialog.root).toBeHidden()
  })
})
