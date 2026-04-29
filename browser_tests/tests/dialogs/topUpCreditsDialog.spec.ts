import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'

test.describe('TopUpCredits dialog', { tag: '@ui' }, () => {
  let dialog: TopUpCreditsDialog

  test.beforeEach(async ({ comfyPage }) => {
    dialog = new TopUpCreditsDialog(comfyPage.page)
  })

  test('displays dialog with heading and preset amounts', async () => {
    await dialog.open()

    await expect(dialog.heading).toBeVisible()
    await expect(dialog.preset10).toBeVisible()
    await expect(dialog.preset25).toBeVisible()
    await expect(dialog.preset50).toBeVisible()
    await expect(dialog.preset100).toBeVisible()
  })

  test('displays insufficient credits message when opened with flag', async () => {
    await dialog.open({ isInsufficientCredits: true })

    await expect(dialog.insufficientHeading).toBeVisible()
    await expect(dialog.root).toContainText(
      "You don't have enough credits to run this workflow"
    )
  })

  test('selecting a preset amount updates the pay amount', async () => {
    await dialog.open()

    // Default preset is $50, click $10 instead
    await dialog.preset10.click()

    await expect(dialog.payAmountInput).toHaveValue('10')
  })

  test('close button dismisses dialog', async () => {
    await dialog.open()

    await dialog.closeButton.click()
    await expect(dialog.root).toBeHidden()
  })

  test('pricing details link points to docs pricing page', async () => {
    await dialog.open()

    await expect(dialog.pricingLink).toBeVisible()
    await expect(dialog.pricingLink).toHaveAttribute(
      'href',
      /partner-nodes\/pricing/
    )
    await expect(dialog.pricingLink).toHaveAttribute('target', '_blank')
  })
})
