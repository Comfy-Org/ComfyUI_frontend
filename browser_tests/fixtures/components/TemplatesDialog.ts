import type { Locator, Page } from '@playwright/test'

export class TemplatesDialog {
  public readonly root: Locator
  public readonly modelFilter: Locator
  public readonly resultsCount: Locator
  public readonly mobileFiltersToggle: Locator
  public readonly filterBar: Locator
  public readonly clearFilters: Locator

  constructor(public readonly page: Page) {
    this.root = page.getByRole('dialog')
    this.modelFilter = this.root
      .getByRole('button', { name: /Model Filter/ })
      .filter({ visible: true })
    this.resultsCount = this.root.getByText(/Showing.*of.*templates/i)
    this.mobileFiltersToggle = this.root.getByRole('button', {
      name: 'Filters'
    })
    this.filterBar = this.root.getByTestId('template-filter-bar')
    this.clearFilters = this.root
      .getByRole('banner')
      .getByRole('button', { name: /Clear Filters/i })
  }

  filterByHeading(name: string): Locator {
    return this.root.filter({
      has: this.page.getByRole('heading', { name, exact: true })
    })
  }

  getCombobox(name: RegExp | string): Locator {
    return this.root.getByRole('combobox', { name })
  }

  /**
   * Below the filter bar's container breakpoint the selects collapse behind a
   * Filters toggle; open it so the model select is interactable in either layout.
   */
  async openFilters(): Promise<void> {
    const toggle = this.mobileFiltersToggle
    if (
      (await toggle.isVisible()) &&
      (await toggle.getAttribute('aria-expanded')) === 'false'
    ) {
      await toggle.click()
    }
  }

  async selectModelOption(name: string): Promise<void> {
    await this.openFilters()
    await this.modelFilter.click()
    await this.page.getByRole('option', { name }).click()
    await this.page.keyboard.press('Escape')
  }
}
