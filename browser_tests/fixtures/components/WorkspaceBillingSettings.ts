import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import { BaseDialog } from '@e2e/fixtures/components/BaseDialog'
import { waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'

export class WorkspaceBillingSettings extends BaseDialog {
  readonly content: Locator
  readonly statusBanner: Locator

  constructor(page: Page) {
    super(page, page.getByTestId('settings-dialog'))
    this.content = this.root.getByRole('main')
    this.statusBanner = this.content.getByRole('status')
  }

  async open(appUrl: string): Promise<void> {
    await this.page.goto(appUrl)
    await waitForCloudApp(this.page)
    await expect(
      this.page.getByRole('status', { name: 'Loading ComfyUI' })
    ).toBeHidden()
    await this.page.getByRole('button', { name: 'Close dialog' }).click()
    await this.page
      .getByRole('button', { name: /^Settings/ })
      .first()
      .click()
    await expect(this.root).toBeVisible()
    await this.root
      .locator('nav')
      .getByRole('button', { name: 'Plan & Credits', exact: true })
      .click()
  }
}
