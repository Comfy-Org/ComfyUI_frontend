import type { Locator, Page } from '@playwright/test'

export class TemplatesDialog {
  public readonly root: Locator

  constructor(public readonly page: Page) {
    this.root = page.getByRole('dialog')
  }

  filterByHeading(name: string): Locator {
    return this.root.filter({
      has: this.page.getByRole('heading', { name, exact: true })
    })
  }

  getCombobox(name: RegExp | string): Locator {
    return this.root.getByRole('combobox', { name })
  }
}
