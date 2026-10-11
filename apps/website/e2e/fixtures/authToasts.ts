import type { Locator, Page } from '@playwright/test'

export class AuthToasts {
  public readonly list: Locator

  constructor(page: Page) {
    this.list = page.getByRole('region', { name: /^Notifications/ })
  }

  withText(text: string): Locator {
    return this.list.getByRole('alert').filter({ hasText: text })
  }
}
