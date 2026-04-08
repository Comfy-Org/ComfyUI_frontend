import { expect } from '@playwright/test'

import type { WorkspaceStore } from '@e2e/types/globals'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('CancelSubscription dialog', { tag: '@ui' }, () => {
  test('displays dialog with title and description', async ({ comfyPage }) => {
    const { page } = comfyPage

    await page.evaluate(() => {
      void (
        window.app!.extensionManager as WorkspaceStore
      ).dialog.showCancelSubscriptionDialog('2025-12-31T00:00:00Z')
    })

    const dialog = page.locator('.p-dialog')
    await expect(dialog).toBeVisible()

    await expect(
      dialog.getByRole('heading', { name: 'Cancel subscription' })
    ).toBeVisible()
    await expect(dialog).toContainText('December 31, 2025')
  })

  test('"Keep subscription" button closes dialog', async ({ comfyPage }) => {
    const { page } = comfyPage

    await page.evaluate(() => {
      void (
        window.app!.extensionManager as WorkspaceStore
      ).dialog.showCancelSubscriptionDialog()
    })

    const dialog = page.locator('.p-dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Keep subscription' }).click()
    await expect(dialog).toBeHidden()
  })

  test('"Cancel subscription" button calls API and closes dialog on success', async ({
    comfyPage
  }) => {
    const { page } = comfyPage

    let cancelCalled = false
    await page.route('**/billing/subscription/cancel', async (route) => {
      cancelCalled = true
      await route.fulfill({
        status: 200,
        json: {
          billing_op_id: 'op-123',
          cancel_at: '2025-12-31T00:00:00Z'
        }
      })
    })

    await page.route('**/billing/status', async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          is_active: true,
          subscription_status: 'canceled',
          subscription_tier: 'STANDARD',
          subscription_duration: 'MONTHLY',
          billing_status: 'paid',
          has_funds: true,
          cancel_at: '2025-12-31T00:00:00Z'
        }
      })
    })

    await page.evaluate(() => {
      void (
        window.app!.extensionManager as WorkspaceStore
      ).dialog.showCancelSubscriptionDialog()
    })

    const dialog = page.locator('.p-dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Cancel subscription' }).click()

    await expect(dialog).toBeHidden()
    expect(cancelCalled).toBe(true)

    const successToast = page.locator(
      '.p-toast-message.p-toast-message-success'
    )
    await expect(successToast).toBeVisible()
  })

  test('"Cancel subscription" shows error toast on API failure', async ({
    comfyPage
  }) => {
    const { page } = comfyPage

    await page.route('**/billing/subscription/cancel', async (route) => {
      await route.fulfill({
        status: 500,
        json: { message: 'Internal server error' }
      })
    })

    await page.evaluate(() => {
      void (
        window.app!.extensionManager as WorkspaceStore
      ).dialog.showCancelSubscriptionDialog()
    })

    const dialog = page.locator('.p-dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Cancel subscription' }).click()

    const errorToast = page.locator('.p-toast-message.p-toast-message-error')
    await expect(errorToast).toBeVisible()

    await expect(dialog).toBeVisible()
  })
})
