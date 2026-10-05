import type { Locator, Page } from '@playwright/test'

export class Tooltip {
  public readonly open: Locator

  constructor(private readonly page: Page) {
    this.open = page.getByRole('tooltip')
  }

  named(name: string | RegExp): Locator {
    return this.page.getByRole('tooltip', { name })
  }

  surface(tooltip: Locator): Locator {
    return this.page.getByTestId('tooltip-content').filter({ has: tooltip })
  }
}
