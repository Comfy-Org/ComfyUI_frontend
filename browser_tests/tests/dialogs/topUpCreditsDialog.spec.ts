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

  test('an amount under the minimum is refused under the field', async () => {
    await dialog.open()

    await dialog.amountInput.fill('3')

    await expect(dialog.amountError).toHaveText('Minimum is $5.')
    await expect(dialog.continueButton).toBeDisabled()
  })

  test('close button dismisses dialog', async () => {
    await dialog.open()

    await dialog.root.getByRole('button', { name: 'Close' }).click()
    await expect(dialog.root).toBeHidden()
  })
})
