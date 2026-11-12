import type { Locator, Page } from '@playwright/test'

import { BaseDialog } from '@e2e/fixtures/components/BaseDialog'
import { TestIds } from '@e2e/fixtures/selectors'

export class UpdatePassword extends BaseDialog {
  readonly confirm: Locator
  readonly password: Locator
  readonly confirmPassword: Locator

  constructor(page: Page) {
    super(page, TestIds.dialogs.updatePassword)
    this.confirm = this.root.getByRole('button', { name: 'Update Password' })
    this.password = this.root.getByLabel('Password', { exact: true })
    this.confirmPassword = this.root.getByLabel('Confirm Password')
  }
  async open() {
    await this.page.evaluate(() => {
      void window.app!.extensionManager.dialog.showUpdatePasswordDialog()
    })
    await this.waitForVisible()
  }
}
