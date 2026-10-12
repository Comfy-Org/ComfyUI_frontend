import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/** The HDR viewer dialog showing one file. */
export class HdrViewerDialog {
  public readonly root: Locator

  constructor(
    public readonly page: Page,
    filename: string
  ) {
    this.root = page.getByRole('dialog').filter({ hasText: filename })
  }

  /** Waits for the file to decode: statistics only render after that. */
  async expectLoaded() {
    await expect(
      this.root.getByText('Resolution', { exact: true })
    ).toBeVisible()
    await expect(this.root.getByRole('alert')).toBeHidden()
    await expect(this.page.getByRole('dialog')).toHaveCount(1)
  }
}
