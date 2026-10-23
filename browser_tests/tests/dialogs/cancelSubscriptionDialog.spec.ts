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

  test('"Keep my plan" button closes dialog', async () => {
    await dialog.open()

    await dialog.keepPlanButton.click()
    await expect(dialog.root).toBeHidden()
  })

  test('Escape key closes dialog', async ({ comfyPage }) => {
    await dialog.open()

    await comfyPage.page.keyboard.press('Escape')
    await expect(dialog.root).toBeHidden()
  })

  // No billing workspace loads in this environment, so the cancellation waits
  // for routing, times out and fails instead of cancelling. The success path
  // is covered in cancelSubscriptionSdkRail.
  test('"Cancel my plan" button fails without claiming success when billing is unavailable', async ({
    comfyPage
  }) => {
    test.setTimeout(45_000)
    await dialog.open()

    await expect(dialog.confirmCancelButton).toBeEnabled()

    await dialog.confirmCancelButton.click()

    await expect(comfyPage.toast.toastErrors).toHaveCount(1, {
      timeout: 20_000
    })
    await expect(comfyPage.toast.toastErrors).toContainText(
      'Failed to cancel subscription'
    )
    await expect(comfyPage.toast.toastErrors).toContainText(
      "We couldn't reach your account. Try again in a moment."
    )
    await expect(comfyPage.toast.toastSuccesses).toHaveCount(0)
    await expect(dialog.cancelledHeading).toBeHidden()
    await expect(dialog.root).toBeVisible()
  })
})
