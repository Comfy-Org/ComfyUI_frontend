import type { Locator, Page } from '@playwright/test'

import type { WorkspaceStore } from '@e2e/types/globals'
import { BaseDialog } from '@e2e/fixtures/components/BaseDialog'

export class CancelSubscriptionDialog extends BaseDialog {
  readonly heading: Locator
  readonly keepSubscriptionButton: Locator
  readonly confirmCancelButton: Locator

  constructor(page: Page) {
    super(page)
    this.heading = this.root.getByRole('heading', {
      name: 'Cancel subscription'
    })
    this.keepSubscriptionButton = this.root.getByRole('button', {
      name: 'Keep subscription'
    })
    this.confirmCancelButton = this.root.getByRole('button', {
      name: 'Cancel subscription'
    })
  }

  async open(cancelAt?: string) {
    await this.page.evaluate((date) => {
      void (
        window.app!.extensionManager as WorkspaceStore
      ).dialog.showCancelSubscriptionDialog(date)
    }, cancelAt)
    await this.waitForVisible()
  }
}
