import type { Locator, Page } from '@playwright/test'

import type { WorkspaceStore } from '@e2e/types/globals'
import { BaseDialog } from '@e2e/fixtures/components/BaseDialog'

export class TopUpCreditsDialog extends BaseDialog {
  readonly heading: Locator
  readonly openedHeading: Locator
  readonly blockedHeading: Locator
  readonly description: Locator
  readonly preset10: Locator
  readonly preset25: Locator
  readonly preset50: Locator
  readonly preset100: Locator
  readonly amountInput: Locator
  readonly amountError: Locator
  readonly notice: Locator
  readonly summary: Locator
  readonly continueButton: Locator
  readonly reopenButton: Locator
  readonly openCheckoutLink: Locator
  readonly openedSummary: Locator
  readonly negativeBalance: Locator
  readonly verifyPaymentLink: Locator
  readonly contactSupportLink: Locator

  constructor(page: Page) {
    super(
      page,
      page.getByRole('dialog').filter({
        has: page.getByTestId('add-credits-dialog')
      })
    )
    this.heading = this.root.getByRole('heading', { name: 'Add credits' })
    this.openedHeading = this.root.getByRole('heading', {
      name: /Checkout opened in/
    })
    this.blockedHeading = this.root.getByRole('heading', {
      name: "Checkout didn't open"
    })
    this.description = this.root.getByText(
      "You don't have enough credits to run this workflow."
    )
    this.preset10 = this.root.getByRole('radio', { name: '$10', exact: true })
    this.preset25 = this.root.getByRole('radio', { name: '$25', exact: true })
    this.preset50 = this.root.getByRole('radio', { name: '$50', exact: true })
    this.preset100 = this.root.getByRole('radio', {
      name: '$100',
      exact: true
    })
    this.amountInput = this.root.getByTestId('add-credits-amount-input')
    this.amountError = this.root.getByTestId('add-credits-amount-error')
    this.notice = this.root.getByTestId('add-credits-notice')
    this.summary = this.root.getByTestId('add-credits-summary')
    this.continueButton = this.root.getByTestId('add-credits-continue')
    this.reopenButton = this.root.getByTestId('add-credits-reopen')
    this.openCheckoutLink = this.root.getByTestId('add-credits-open-checkout')
    this.openedSummary = this.root.getByTestId('add-credits-opened-summary')
    this.negativeBalance = this.root.getByTestId('add-credits-negative-balance')
    this.verifyPaymentLink = this.root.getByRole('link', {
      name: 'Verify payment'
    })
    this.contactSupportLink = this.root.getByRole('link', {
      name: 'Contact support'
    })
  }

  async open(options?: { isInsufficientCredits?: boolean }) {
    await this.page.evaluate((opts) => {
      void (
        window.app!.extensionManager as WorkspaceStore
      ).dialog.showTopUpCreditsDialog(opts)
    }, options)
    await this.waitForVisible()
  }
}
