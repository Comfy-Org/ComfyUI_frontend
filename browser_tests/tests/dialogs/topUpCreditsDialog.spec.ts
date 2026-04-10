import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { WorkspaceStore } from '@e2e/types/globals'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

async function openTopUpCreditsDialog(
  page: Page,
  options?: { isInsufficientCredits?: boolean }
) {
  await page.evaluate((opts) => {
    void (
      window.app!.extensionManager as WorkspaceStore
    ).dialog.showTopUpCreditsDialog(opts)
  }, options)
}

test.describe('TopUpCredits dialog', { tag: '@ui' }, () => {
  test('displays dialog with heading and preset amounts', async ({
    comfyPage
  }) => {
    const { page } = comfyPage

    await openTopUpCreditsDialog(page)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await expect(
      dialog.getByRole('heading', { name: 'Add more credits' })
    ).toBeVisible()

    await expect(
      dialog.getByRole('button', { name: '$10' }).first()
    ).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: '$25' }).first()
    ).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: '$50' }).first()
    ).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: '$100' }).first()
    ).toBeVisible()
  })

  test('displays insufficient credits message when opened with flag', async ({
    comfyPage
  }) => {
    const { page } = comfyPage

    await openTopUpCreditsDialog(page, { isInsufficientCredits: true })

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await expect(
      dialog.getByRole('heading', { name: 'Add more credits to run' })
    ).toBeVisible()
    await expect(dialog).toContainText(
      "You don't have enough credits to run this workflow"
    )
  })

  test('selecting a preset amount updates the pay amount', async ({
    comfyPage
  }) => {
    const { page } = comfyPage

    await openTopUpCreditsDialog(page)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Default preset is $50, click $10 instead
    const tenDollarBtn = dialog.getByRole('button', { name: '$10' }).first()
    await tenDollarBtn.click()

    // The "You Pay" input should reflect $10
    const payInput = dialog.locator('input').first()
    await expect(payInput).toHaveValue('10')
  })

  test('close button dismisses dialog', async ({ comfyPage }) => {
    const { page } = comfyPage

    await openTopUpCreditsDialog(page)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Close' }).click()
    await expect(dialog).toBeHidden()
  })

  test('pricing details link points to docs pricing page', async ({
    comfyPage
  }) => {
    const { page } = comfyPage

    await openTopUpCreditsDialog(page)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    const pricingLink = dialog.getByRole('link', {
      name: 'View pricing details'
    })
    await expect(pricingLink).toBeVisible()
    await expect(pricingLink).toHaveAttribute('href', /partner-nodes\/pricing/)
    await expect(pricingLink).toHaveAttribute('target', '_blank')
  })
})
