import type { Locator, Page } from '@playwright/test'

export class Tooltip {
  public readonly open: Locator

  constructor(private readonly page: Page) {
    this.open = page.getByTestId('tooltip-text')
  }

  named(name: string | RegExp): Locator {
    return this.open.filter({ hasText: name })
  }

  surface(tooltip: Locator): Locator {
    return this.page.getByTestId('tooltip-content').filter({ has: tooltip })
  }
}
