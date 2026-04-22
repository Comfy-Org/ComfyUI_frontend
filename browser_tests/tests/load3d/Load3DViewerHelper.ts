import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

export class Load3DViewerHelper {
  readonly dialog: Locator

  constructor(readonly page: Page) {
    this.dialog = page.locator('[aria-labelledby="global-load3d-viewer"]')
  }

  get canvas(): Locator {
    return this.dialog.locator('canvas')
  }

  get sidebar(): Locator {
    return this.dialog.getByTestId('load3d-viewer-sidebar')
  }

  get cancelButton(): Locator {
    return this.dialog.getByRole('button', { name: /cancel/i })
  }

  async waitForOpen(): Promise<void> {
    await expect(this.dialog).toBeVisible({ timeout: 10000 })
  }

  async waitForClosed(): Promise<void> {
    await expect(this.dialog).toBeHidden()
  }
}
