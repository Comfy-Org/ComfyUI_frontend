import type { Locator, Page } from '@playwright/test'

export class MediaLightbox {
  public readonly root: Locator
  public readonly closeButton: Locator

  constructor(public readonly page: Page) {
    this.root = page.getByRole('dialog')
    this.closeButton = this.root.getByLabel('Close')
  }
}
