import type { Locator, Page } from '@playwright/test'

import { BaseDialog } from '@e2e/fixtures/components/BaseDialog'
import type { WorkspaceStore } from '@e2e/types/globals'

export class TopUpCreditsDialog extends BaseDialog {
  readonly heading: Locator
  readonly insufficientHeading: Locator
  readonly preset10: Locator
  readonly preset25: Locator
  readonly preset50: Locator
  readonly preset100: Locator
  readonly payAmountInput: Locator
  readonly pricingLink: Locator

  readonly payInput: Locator
  readonly creditsInput: Locator
  readonly decrementPay: Locator
  readonly incrementPay: Locator
  readonly decrementCredits: Locator
  readonly incrementCredits: Locator
  readonly presetButtons: Locator
  readonly buyButton: Locator
  override readonly closeButton: Locator
  readonly minWarning: Locator
  readonly ceilingWarning: Locator

  constructor(page: Page) {
    super(page)

    this.heading = this.root.getByRole('heading', { name: 'Add more credits' })
    this.insufficientHeading = this.root.getByRole('heading', {
      name: 'Add more credits to run'
    })
    this.preset10 = this.root.getByRole('button', {
      name: '$10',
      exact: true
    })
    this.preset25 = this.root.getByRole('button', {
      name: '$25',
      exact: true
    })
    this.preset50 = this.root.getByRole('button', {
      name: '$50',
      exact: true
    })
    this.preset100 = this.root.getByRole('button', {
      name: '$100',
      exact: true
    })
    this.payAmountInput = this.root
      .getByTestId('top-up-pay-amount')
      .locator('input')
    this.pricingLink = this.root.getByRole('link', {
      name: 'View pricing details'
    })

    const steppers = this.root.locator('label')
    const payStepper = steppers.first()
    const creditsStepper = steppers.nth(1)

    this.payInput = payStepper.locator('input[inputmode="numeric"]')
    this.creditsInput = creditsStepper.locator('input[inputmode="numeric"]')
    this.decrementPay = payStepper.getByRole('button', { name: 'Decrement' })
    this.incrementPay = payStepper.getByRole('button', { name: 'Increment' })
    this.decrementCredits = creditsStepper.getByRole('button', {
      name: 'Decrement'
    })
    this.incrementCredits = creditsStepper.getByRole('button', {
      name: 'Increment'
    })
    this.presetButtons = this.root.getByRole('button', { name: /^\$\d+$/ })
    this.buyButton = this.root.getByRole('button', {
      name: /continue to payment|add credits/i
    })
    // Headless dialog uses its own X button, not PrimeVue's header close
    this.closeButton = this.root.locator('button:has([class*="lucide--x"])')
    this.minWarning = this.root.getByText(/minimum/i)
    this.ceilingWarning = this.root.getByText(/maximum/i)
  }

  async open(options?: { isInsufficientCredits?: boolean }) {
    await this.page.evaluate((opts) => {
      void (
        window.app!.extensionManager as WorkspaceStore
      ).dialog.showTopUpCreditsDialog(opts)
    }, options)
    await this.waitForVisible()
  }

  getPresetButton(amount: number): Locator {
    return this.root.getByRole('button', { name: `$${amount}`, exact: true })
  }
}
