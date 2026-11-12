import type { Locator, Page } from '@playwright/test'

import { BaseDialog } from '@e2e/fixtures/components/BaseDialog'
import { TestIds } from '@e2e/fixtures/selectors'

export class CloudNotification extends BaseDialog {
  readonly toCloud: Locator
  readonly back: Locator

  constructor(page: Page) {
    super(page, TestIds.dialogs.cloudNotification)
    this.toCloud = this.root.getByRole('button', { name: 'Try Cloud for Free' })
    this.back = this.root.getByRole('button', { name: 'Continue Locally' })
  }
  async open() {
    await this.page.evaluate(() => {
      void window.app!.extensionManager.dialog.showCloudNotification()
    })
    await this.waitForVisible()
  }
}
