import { expect } from '@playwright/test'

import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'
import { localAuthFixture as test } from '@e2e/fixtures/localAuthFixture'

test.describe('TopUpCredits dialog', { tag: '@ui' }, () => {
  let dialog: TopUpCreditsDialog

  test.beforeEach(async ({ comfyPage }) => {
    dialog = new TopUpCreditsDialog(comfyPage.page)
  })

  test('opens on the $50 preset with Continue enabled', async () => {
    await dialog.open()

    await expect(dialog.heading).toBeVisible()
    await expect(dialog.preset10).toBeVisible()
    await expect(dialog.preset25).toBeVisible()
    await expect(dialog.preset100).toBeVisible()
    await expect(dialog.preset50).toBeChecked()
    await expect(dialog.amountInput).toHaveValue('')
    await expect(dialog.summary).toContainText('$50.00, paid at checkout')
    await expect(dialog.continueButton).toBeEnabled()
  })

  test('displays insufficient credits message when opened with flag', async () => {
    await dialog.open({ isInsufficientCredits: true })

    await expect(dialog.heading).toBeVisible()
    await expect(dialog.description).toBeVisible()
  })

  test('typing an amount clears the preset', async () => {
    await dialog.open()

    await dialog.amountInput.fill('40')

    await expect(dialog.preset50).not.toBeChecked()
    await expect(dialog.summary).toContainText('$40.00, paid at checkout')
  })

  for (const { amount, error } of [
    { amount: '3', error: 'Minimum is $5.' },
    {
      amount: '2501',
      error: 'The largest top-up is $2,500. Add more with another top-up.'
    },
    { amount: '12.5', error: 'Whole dollars only.' }
  ]) {
    test(`refuses $${amount} under the field`, async () => {
      await dialog.open()

      await dialog.amountInput.fill(amount)

      await expect(dialog.amountError).toHaveText(error)
      await expect(dialog.continueButton).toBeDisabled()
    })
  }

  test('close button dismisses dialog', async () => {
    await dialog.open()

    await dialog.root.getByRole('button', { name: 'Close' }).click()
    await expect(dialog.root).toBeHidden()
  })
})
