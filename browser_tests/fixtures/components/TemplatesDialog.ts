import type { Locator, Page } from '@playwright/test'

/**
 * The templates browser is a docked sidebar panel (no dialog role). Filters
 * live in a flat popover sheet of toggle chips — categories, models, tasks
 * and runs-on are all buttons inside the sheet — opened from the Filters
 * icon button in the panel header.
 */
export class TemplatesDialog {
  public readonly root: Locator
  public readonly filtersToggle: Locator
  public readonly filterSheet: Locator
  public readonly resultsCount: Locator

  constructor(public readonly page: Page) {
    this.root = page.getByTestId('templates-sidebar-tab')
    // By testid, not accessible name: specs that switch locale would
    // otherwise have to look up the translated label.
    this.filtersToggle = this.root.getByTestId('templates-filters-toggle')
    // The sheet teleports into a popover portal, so it cannot be scoped to
    // the panel root.
    this.filterSheet = page.getByTestId('template-filter-bar')
    this.resultsCount = this.root.getByText(/Showing.*of.*templates/i)
  }

  filterByHeading(name: string): Locator {
    return this.root.filter({
      has: this.page.getByRole('heading', { name, exact: true })
    })
  }

  async openFilters(): Promise<void> {
    if (!(await this.filterSheet.isVisible())) {
      await this.filtersToggle.click()
      await this.filterSheet.waitFor({ state: 'visible' })
    }
  }

  async closeFilters(): Promise<void> {
    if (await this.filterSheet.isVisible()) {
      await this.page.keyboard.press('Escape')
      await this.filterSheet.waitFor({ state: 'hidden' })
    }
  }

  /**
   * A filter value inside the sheet, reached through its search box.
   *
   * Values otherwise live in per-facet submenus that portal outside the
   * sheet; searching lists them flat inside it, which is also how the panel
   * expects you to find one by name.
   */
  filterOption(name: string): Locator {
    return this.filterSheet
      .locator('[data-templates-filter-result]')
      .filter({ has: this.page.getByText(name, { exact: true }) })
      .first()
  }

  /**
   * Toggle a filter value (category, model, task or runs-on), opening the
   * sheet first when needed. The sheet stays open so several values can be
   * toggled in a row.
   */
  async toggleFilterChip(name: string): Promise<void> {
    await this.openFilters()
    const search = this.filterSheet.getByRole('textbox').first()
    await search.fill(name)
    await this.filterOption(name).click()
    // Leave the sheet listing every facet again for the next toggle.
    await search.fill('')
  }

  async selectModelOption(name: string): Promise<void> {
    await this.toggleFilterChip(name)
    await this.closeFilters()
  }

  async clearAllFilters(): Promise<void> {
    await this.openFilters()
    await this.filterSheet
      .getByRole('button', { name: /clear all filters/i })
      .click()
    await this.closeFilters()
  }
}
