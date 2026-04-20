import type { Locator, Page } from '@playwright/test'

import { BaseDialog } from '@e2e/fixtures/components/BaseDialog'

export class TopUpCreditsDialog extends BaseDialog {
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

  async open(): Promise<void> {
    await this.page.evaluate(async () => {
      await window.app!.extensionManager.dialog.showTopUpCreditsDialog()
    })
    await this.waitForVisible()
  }

  getPresetButton(amount: number): Locator {
    return this.root.getByRole('button', { name: `$${amount}`, exact: true })
  }
}
