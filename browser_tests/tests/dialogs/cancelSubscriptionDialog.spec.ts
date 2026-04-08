import { expect } from '@playwright/test'

import type { WorkspaceStore } from '@e2e/types/globals'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('CancelSubscription dialog', { tag: '@ui' }, () => {
  test('displays dialog with title and description', async ({ comfyPage }) => {
    const { page } = comfyPage

    await page.evaluate(() => {
      void (
        window.app!.extensionManager as WorkspaceStore
      ).dialog.showCancelSubscriptionDialog('2025-12-31T12:00:00Z')
    })

    const dialog = page.getByRole('dialog')
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

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Keep subscription' }).click()
    await expect(dialog).toBeHidden()
  })

  test('Escape key closes dialog', async ({ comfyPage }) => {
    const { page } = comfyPage

    await page.evaluate(() => {
      void (
        window.app!.extensionManager as WorkspaceStore
      ).dialog.showCancelSubscriptionDialog()
    })

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('"Cancel subscription" button calls API and closes dialog on success', async ({
    comfyPage
  }) => {
    const { page } = comfyPage

    await page.route('**/billing/subscription/cancel', async (route) => {
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

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    const cancelRequest = page.waitForRequest('**/billing/subscription/cancel')
    await dialog.getByRole('button', { name: 'Cancel subscription' }).click()
    await cancelRequest

    await expect(dialog).toBeHidden()

    const successToast = page.getByRole('alert').filter({
      hasText: /cancel/i
    })
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

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Cancel subscription' }).click()

    const errorToast = page.getByRole('alert').filter({
      hasText: /error|fail/i
    })
    await expect(errorToast).toBeVisible()

    await expect(dialog).toBeVisible()
  })
})
