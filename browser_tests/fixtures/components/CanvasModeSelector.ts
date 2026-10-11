import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

export class CanvasModeSelector {
  readonly trigger: Locator
  readonly menu: Locator

  constructor(page: Page) {
    this.trigger = page.getByRole('button', { name: 'Canvas Mode' })
    this.menu = page.getByRole('menu', { name: 'Canvas Mode' })
  }

  async open(): Promise<void> {
    await this.trigger.click()
    await expect(this.menu).toBeVisible()
  }
}
