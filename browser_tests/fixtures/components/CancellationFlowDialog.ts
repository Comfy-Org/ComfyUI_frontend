import type { Locator, Page } from '@playwright/test'

import { BaseDialog } from '@e2e/fixtures/components/BaseDialog'

/**
 * The stepped cancellation dialog opened by Cancel plan: the reason survey,
 * the retention offer and its end states, then the confirmation. It opens on
 * top of Settings, so the root is scoped by its dialog key.
 */
export class CancellationFlowDialog extends BaseDialog {
  readonly surveyHeading: Locator
  readonly continueCancellingButton: Locator
  readonly offerHeading: Locator
  readonly acceptOfferButton: Locator
  readonly appliedHeading: Locator
  readonly expiredHeading: Locator
  readonly retryButton: Locator
  readonly confirmHeading: Locator
  readonly confirmCancelButton: Locator
  readonly cancelledHeading: Locator
  readonly doneButton: Locator

  constructor(page: Page) {
    super(page, page.locator('[data-dialog-key="cancel-subscription"]'))
    this.surveyHeading = this.root.getByRole('heading', {
      name: 'Why are you cancelling?'
    })
    this.continueCancellingButton = this.root.getByRole('button', {
      name: 'Continue cancelling'
    })
    this.offerHeading = this.root.getByRole('heading', {
      name: 'Before you go'
    })
    this.acceptOfferButton = this.root.getByRole('button', {
      name: 'Keep Pro and save 30%'
    })
    this.appliedHeading = this.root.getByRole('heading', {
      name: "You're staying on Pro"
    })
    this.expiredHeading = this.root.getByRole('heading', {
      name: 'This offer is no longer available'
    })
    this.retryButton = this.root.getByRole('button', { name: 'Try again' })
    this.confirmHeading = this.root.getByRole('heading', {
      name: 'Cancel your plan?'
    })
    this.confirmCancelButton = this.root.getByRole('button', {
      name: 'Cancel my plan'
    })
    this.cancelledHeading = this.root.getByRole('heading', {
      name: 'Your plan is cancelled'
    })
    this.doneButton = this.root.getByRole('button', { name: 'Done' })
  }

  async openFrom(planAndCredits: Locator): Promise<void> {
    await planAndCredits.getByRole('button', { name: 'More Options' }).click()
    await this.page.getByText('Cancel plan', { exact: true }).click()
    await this.waitForVisible()
  }

  reason(name: string): Locator {
    return this.root.getByRole('radio', { name })
  }
}
