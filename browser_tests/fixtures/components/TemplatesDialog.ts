import type { Locator, Page } from '@playwright/test'

export class TemplatesDialog {
  public readonly root: Locator
  public readonly modelFilter: Locator
  public readonly contentTypeFilter: Locator
  public readonly resultsCount: Locator

  constructor(public readonly page: Page) {
    this.root = page.getByRole('dialog')
    this.modelFilter = this.root.getByRole('button', { name: /Model Filter/ })
    this.contentTypeFilter = this.getCombobox(/Type/)
    this.resultsCount = this.root.getByText(/Showing.*of.*templates/i)
  }

  filterByHeading(name: string): Locator {
    return this.root.filter({
      has: this.page.getByRole('heading', { name, exact: true })
    })
  }

  getCombobox(name: RegExp | string): Locator {
    return this.root.getByRole('combobox', { name })
  }

  async selectModelOption(name: string): Promise<void> {
    await this.modelFilter.click()
    await this.page.getByRole('option', { name }).click()
    await this.page.keyboard.press('Escape')
  }

  async selectContentType(name: 'All' | 'App' | 'Graph'): Promise<void> {
    await this.contentTypeFilter.click()
    await this.page.getByRole('option', { name, exact: true }).click()
  }
}
