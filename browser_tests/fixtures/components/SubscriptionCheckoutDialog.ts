import type { Locator, Page } from '@playwright/test'

import { BaseDialog } from '@e2e/fixtures/components/BaseDialog'

export class SubscriptionCheckoutDialog extends BaseDialog {
  readonly heading: Locator
  readonly personalPlansButton: Locator
  readonly teamPlansButton: Locator
  readonly monthlyButton: Locator
  readonly yearlyButton: Locator
  readonly paymentPreviewHeading: Locator
  readonly upgradePreviewHeading: Locator
  readonly scheduledChangeHeading: Locator
  readonly backToPlansButton: Locator
  readonly termsLink: Locator
  readonly privacyPolicyLink: Locator
  readonly successHeading: Locator
  readonly successContent: Locator

  constructor(page: Page) {
    super(page)
    this.heading = this.root.getByRole('heading', { name: 'Choose a Plan' })
    this.personalPlansButton = this.root.getByRole('button', {
      name: 'For Personal'
    })
    this.teamPlansButton = this.root.getByRole('button', {
      name: 'For Teams'
    })
    this.monthlyButton = this.root.getByRole('button', { name: 'Monthly' })
    this.yearlyButton = this.root.getByRole('button', { name: /^Yearly\b/ })
    this.paymentPreviewHeading = this.root.getByRole('heading', {
      name: 'Confirm your payment'
    })
    this.upgradePreviewHeading = this.root.getByRole('heading', {
      name: 'Confirm your upgrade'
    })
    this.scheduledChangeHeading = this.root.getByRole('heading', {
      name: 'Review your scheduled change'
    })
    this.backToPlansButton = this.root.getByRole('button', {
      name: 'Back to all plans'
    })
    this.termsLink = this.root.getByRole('link', { name: 'Terms' })
    this.privacyPolicyLink = this.root.getByRole('link', {
      name: 'Privacy Policy'
    })
    this.successHeading = this.root.getByRole('heading', {
      name: "You're all set"
    })
    this.successContent = this.successHeading.locator('..')
  }

  personalPlanButton(label: string): Locator {
    return this.root.getByRole('button', { name: label, exact: true })
  }

  async selectBillingCycle(cycle: 'monthly' | 'yearly'): Promise<void> {
    const button = cycle === 'monthly' ? this.monthlyButton : this.yearlyButton
    await button.click()
  }
}
