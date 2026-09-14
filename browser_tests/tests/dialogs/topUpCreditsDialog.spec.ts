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

  test('preset amounts update both dollars and credits', async () => {
    await dialog.open()

    await expect(dialog.payAmountInput).toHaveValue('50')
    await expect(dialog.getAmountInput).toHaveValue('10,550')

    await dialog.preset10.click()

    await expect(dialog.payAmountInput).toHaveValue('10')
    await expect(dialog.getAmountInput).toHaveValue('2,110')
  })

  test('dollar increments update the credit conversion', async () => {
    await dialog.open()

    await dialog.incrementPayAmountButton.click()

    await expect(dialog.payAmountInput).toHaveValue('55')
    await expect(dialog.getAmountInput).toHaveValue('11,605')
  })

  test('credit increments update the dollar conversion', async () => {
    await dialog.open()

    await dialog.incrementGetAmountButton.click()

    await expect(dialog.getAmountInput).toHaveValue('11,605')
    await expect(dialog.payAmountInput).toHaveValue('55')
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
