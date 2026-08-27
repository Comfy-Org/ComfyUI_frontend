import type { Page } from '@playwright/test'

export class FirstRunContinuation {
  constructor(private readonly page: Page) {}

  get outputImage() {
    return this.page.locator('[data-node-id="10"] img')
  }
}
