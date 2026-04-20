import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'

// 211 credits per USD (from src/base/credits/comfyCredits.ts)
// Step: $5 when pay < $100, $50 when pay < $1000, $100 otherwise
// MIN_AMOUNT = $5, MAX_AMOUNT = $10,000

test.describe('Top Up Credits Dialog', { tag: '@ui' }, () => {
  let dialog: TopUpCreditsDialog

  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.page.route(
      '**/cloud-subscription-status**',
      async (route) => {
        await route.fulfill({
          json: { is_active: true, subscription_tier: 'PRO' }
        })
      }
    )
    await comfyPage.page.route('**/customers/balance**', async (route) => {
      await route.fulfill({
        json: { amount_micros: 1_000_000, currency: 'usd' }
      })
    })

    dialog = new TopUpCreditsDialog(comfyPage.page)
    await dialog.open()
  })

  test('preset buttons update both steppers', async () => {
    await dialog.getPresetButton(25).click()

    await expect(dialog.payInput).toHaveValue('25')
    await expect(dialog.creditsInput).toHaveValue('5,275')
  })

  test('increment pay stepper updates credits', async () => {
    await dialog.getPresetButton(25).click()
    await dialog.incrementPay.click()

    await expect(dialog.payInput).toHaveValue('30')
    await expect(dialog.creditsInput).toHaveValue('6,330')
  })

  test('decrement pay stepper updates credits', async () => {
    await dialog.getPresetButton(50).click()
    await dialog.decrementPay.click()

    await expect(dialog.payInput).toHaveValue('45')
    await expect(dialog.creditsInput).toHaveValue('9,495')
  })

  test('typing in pay stepper updates credits', async () => {
    await dialog.payInput.fill('')
    await dialog.payInput.pressSequentially('500')
    await dialog.payInput.blur()

    await expect(dialog.creditsInput).toHaveValue('105,500')
  })

  test('max ceiling warning appears when exceeding max', async () => {
    await dialog.payInput.fill('')
    await dialog.payInput.pressSequentially('99999')

    await expect(dialog.ceilingWarning).toBeVisible()
    await expect(dialog.payInput).toHaveValue('10,000')
  })

  test('min amount warning appears for values below minimum', async () => {
    await dialog.payInput.fill('')
    await dialog.payInput.pressSequentially('2')
    await dialog.payInput.blur()

    await expect(dialog.minWarning).toBeVisible()
  })

  test('buy button disabled for sub-minimum amount', async () => {
    await dialog.payInput.fill('')
    await dialog.payInput.pressSequentially('3')
    await dialog.payInput.blur()

    await expect(dialog.buyButton).toBeDisabled()
    await expect(dialog.minWarning).toBeVisible()
  })

  test('buy button disabled when amount is zero', async () => {
    await dialog.payInput.fill('')
    await dialog.payInput.pressSequentially('0')
    await dialog.payInput.blur()

    await expect(dialog.buyButton).toBeDisabled()
  })

  test('dialog closes via close button', async () => {
    await dialog.closeButton.click()
    await expect(dialog.root).toBeHidden()
  })
})
