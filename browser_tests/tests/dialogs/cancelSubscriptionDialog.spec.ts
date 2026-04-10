import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { WorkspaceStore } from '@e2e/types/globals'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

async function openCancelSubscriptionDialog(page: Page, cancelAt?: string) {
  await page.evaluate((date) => {
    void (
      window.app!.extensionManager as WorkspaceStore
    ).dialog.showCancelSubscriptionDialog(date)
  }, cancelAt)
}

test.describe('CancelSubscription dialog', { tag: '@ui' }, () => {
  test('displays dialog with title and formatted date', async ({
    comfyPage
  }) => {
    const { page } = comfyPage

    await openCancelSubscriptionDialog(page, '2025-12-31T12:00:00Z')

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await expect(
      dialog.getByRole('heading', { name: 'Cancel subscription' })
    ).toBeVisible()
    await expect(dialog).toContainText('December 31, 2025')
  })

  test('"Keep subscription" button closes dialog', async ({ comfyPage }) => {
    const { page } = comfyPage

    await openCancelSubscriptionDialog(page)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Keep subscription' }).click()
    await expect(dialog).toBeHidden()
  })

  test('Escape key closes dialog', async ({ comfyPage }) => {
    const { page } = comfyPage

    await openCancelSubscriptionDialog(page)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })

  test('"Cancel subscription" button triggers cancel API request', async ({
    comfyPage
  }) => {
    const { page } = comfyPage

    let cancelCalled = false

    // Mock the legacy billing portal endpoint (POST /customers/billing)
    await page.route('**/customers/billing', (route) => {
      cancelCalled = true
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          billing_portal_url: 'https://billing.example.com/portal'
        })
      })
    })

    // Mock the subscription status endpoint
    await page.route('**/customers/cloud-subscription-status', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plan_name: 'pro',
          is_active: true,
          cancel_at_period_end: true
        })
      })
    })

    // Prevent window.open from actually opening a new tab
    await page.evaluate(() => {
      window.open = () => null
    })

    await openCancelSubscriptionDialog(page)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    const cancelBtn = dialog.getByRole('button', {
      name: 'Cancel subscription'
    })
    await cancelBtn.click()

    await expect.poll(() => cancelCalled).toBe(true)
    await expect(dialog).toBeHidden()
  })

  test('shows error toast when cancel API fails', async ({ comfyPage }) => {
    const { page } = comfyPage

    // Mock the legacy billing portal endpoint to fail
    await page.route('**/customers/billing', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal server error' })
      })
    })

    await openCancelSubscriptionDialog(page)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Cancel subscription' }).click()

    // Dialog should remain visible on error
    await expect(dialog).toBeVisible()
  })
})
