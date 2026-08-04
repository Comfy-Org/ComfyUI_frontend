import type { Locator, Page } from '@playwright/test'

import type { WorkspaceStore } from '@e2e/types/globals'
import { BaseDialog } from '@e2e/fixtures/components/BaseDialog'

export class TopUpCreditsDialog extends BaseDialog {
  readonly heading: Locator
  readonly insufficientHeading: Locator
  readonly preset10: Locator
  readonly preset25: Locator
  readonly preset50: Locator
  readonly preset100: Locator
  readonly payAmountInput: Locator
  readonly pricingLink: Locator

  constructor(page: Page) {
    // Scope to the dialog containing the top-up heading rather than the
    // generic `[role="dialog"]` fallback: this dialog can be opened from
    // within another already-open dialog (e.g. Settings > Credits), and
    // Reka renders each stacked dialog as its own independent `role="dialog"`
    // root, so the generic fallback would match both simultaneously.
    super(
      page,
      page.getByRole('dialog').filter({
        has: page.getByRole('heading', { name: 'Add more credits' })
      })
    )
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
