import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import { BaseDialog } from '@e2e/fixtures/components/BaseDialog'

export class HdrViewerDialog extends BaseDialog {
  readonly resolution: Locator
  readonly loadError: Locator

  constructor(page: Page, filename: string) {
    super(page, page.getByRole('dialog').filter({ hasText: filename }))
    this.resolution = this.root.getByText('Resolution', { exact: true })
    this.loadError = this.root.getByRole('alert')
  }

  async expectDecoded() {
    await expect(this.resolution).toBeVisible()
    await expect(this.loadError).toBeHidden()
  }
}
