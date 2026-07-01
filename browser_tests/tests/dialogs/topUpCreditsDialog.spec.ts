import type { operations } from '@comfyorg/registry-types'
import { expect } from '@playwright/test'

import { CREDITS_PER_USD } from '@/base/credits/comfyCredits'
import type { CloudSubscriptionStatusResponse } from '@/platform/cloud/subscription/composables/useSubscription'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TopUpCreditsDialog } from '@e2e/fixtures/components/TopUpCreditsDialog'

type GetCustomerBalanceResponse =
  operations['GetCustomerBalance']['responses']['200']['content']['application/json']

// Step: $5 when pay < $100, $50 when pay < $1000, $100 otherwise
// MIN_AMOUNT = $5, MAX_AMOUNT = $10,000

function expectedCredits(usd: number): string {
  return (usd * CREDITS_PER_USD).toLocaleString('en-US')
}

function expectedCreditsInput(usd: number): string {
  return expectedCredits(usd).replaceAll(',', '')
}

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

test.describe('Top Up Credits Dialog', { tag: '@ui' }, () => {
  let dialog: TopUpCreditsDialog

  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.page.route(
      '**/cloud-subscription-status**',
      async (route) => {
        await route.fulfill({
          json: {
            is_active: true,
            subscription_tier: 'PRO'
          } satisfies CloudSubscriptionStatusResponse
        })
      }
    )
    await comfyPage.page.route('**/customers/balance**', async (route) => {
      await route.fulfill({
        json: {
          amount_micros: 1_000_000,
          currency: 'usd'
        } satisfies GetCustomerBalanceResponse
      })
    })

    dialog = new TopUpCreditsDialog(comfyPage.page)
    await dialog.open()
  })

  test('preset buttons update both steppers', async () => {
    await dialog.getPresetButton(25).click()

    await expect(dialog.payInput).toHaveValue('25')
    await expect(dialog.creditsInput).toHaveValue(expectedCredits(25))
  })

  test('increment pay stepper updates credits', async () => {
    await dialog.getPresetButton(25).click()
    await dialog.incrementPay.click()

    await expect(dialog.payInput).toHaveValue('30')
    await expect(dialog.creditsInput).toHaveValue(expectedCredits(30))
  })

  test('decrement pay stepper updates credits', async () => {
    await dialog.getPresetButton(50).click()
    await dialog.decrementPay.click()

    await expect(dialog.payInput).toHaveValue('45')
    await expect(dialog.creditsInput).toHaveValue(expectedCredits(45))
  })

  test('typing in pay stepper updates credits', async () => {
    await dialog.payInput.fill('')
    await dialog.payInput.pressSequentially('500')
    await dialog.payInput.blur()

    await expect(dialog.creditsInput).toHaveValue(expectedCredits(500))
  })

  test('typing in credits stepper updates pay', async () => {
    const credits = expectedCreditsInput(50)

    await dialog.creditsInput.fill('')
    await dialog.creditsInput.pressSequentially(credits)
    await dialog.creditsInput.blur()

    await expect(dialog.payInput).toHaveValue('50')
  })

  test('max ceiling warning appears when exceeding max', async () => {
    await dialog.payInput.fill('')
    await dialog.payInput.pressSequentially('99999')
    await dialog.payInput.blur()

    await expect(dialog.ceilingWarning).toBeVisible()
    await expect(dialog.payInput).toHaveValue('10,000')
    await expect(dialog.creditsInput).toHaveValue(expectedCredits(10_000))
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
