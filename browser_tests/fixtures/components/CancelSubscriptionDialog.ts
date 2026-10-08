import type { Locator, Page } from '@playwright/test'

import type { WorkspaceStore } from '@e2e/types/globals'
import { BaseDialog } from '@e2e/fixtures/components/BaseDialog'

export class CancelSubscriptionDialog extends BaseDialog {
  readonly heading: Locator
  readonly keepPlanButton: Locator
  readonly confirmCancelButton: Locator
  readonly cancelledHeading: Locator
  readonly doneButton: Locator

  constructor(page: Page) {
    super(page)
    this.heading = this.root.getByRole('heading', {
      name: 'Cancel your plan?'
    })
    this.keepPlanButton = this.root.getByRole('button', {
      name: 'Keep my plan'
    })
    this.confirmCancelButton = this.root.getByRole('button', {
      name: 'Cancel my plan'
    })
    this.cancelledHeading = this.root.getByRole('heading', {
      name: 'Your plan is cancelled'
    })
    this.doneButton = this.root.getByRole('button', { name: 'Done' })
  }

  async open(cancelAt?: string) {
    await this.page.evaluate((date) => {
      void (
        window.app!.extensionManager as WorkspaceStore
      ).dialog.showCancelSubscriptionDialog(date)
    }, cancelAt)
    await this.waitForVisible()
  }

  async confirmCancel() {
    await this.confirmCancelButton.click()
    await this.cancelledHeading.waitFor({ state: 'visible' })
    await this.doneButton.click()
    await this.waitForHidden()
  }
}
