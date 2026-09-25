import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

class ComfyNodeSearchFilterSelectionPanel {
  readonly root: Locator
  readonly header: Locator

  constructor(public readonly page: Page) {
    this.root = page.getByRole('dialog')
    this.header = this.root
      .locator('div')
      .filter({ hasText: 'Add node filter condition' })
  }

  async selectFilterType(filterType: string) {
    await this.root
      .getByRole('button', { name: filterType, exact: true })
      .click()
  }

  async selectFilterValue(filterValue: string) {
    await this.root
      .getByRole('combobox', { name: 'Single-select dropdown' })
      .click()
    await this.page
      .getByRole('option', { name: filterValue, exact: true })
      .click()
  }

  async addFilter(filterValue: string, filterType: string) {
    await this.selectFilterType(filterType)
    await this.selectFilterValue(filterValue)
    await this.page.getByRole('button', { name: 'Add', exact: true }).click()
  }
}

export class ComfyNodeSearchBox {
  public readonly input: Locator
  public readonly dropdown: Locator
  public readonly filterButton: Locator
  public readonly filterChips: Locator
  public readonly filterSelectionPanel: ComfyNodeSearchFilterSelectionPanel

  constructor(public readonly page: Page) {
    this.input = page.locator(
      '.comfy-vue-node-search-container input[type="text"]'
    )
    this.dropdown = page.getByRole('listbox')
    this.filterButton = page.locator(
      '.comfy-vue-node-search-container .filter-button'
    )
    this.filterChips = page.getByTestId('node-search-filter-chip')
    this.filterSelectionPanel = new ComfyNodeSearchFilterSelectionPanel(page)
  }

  async fillAndSelectFirstNode(
    nodeName: string,
    options?: { suggestionIndex?: number; exact?: boolean }
  ) {
    await this.input.waitFor({ state: 'visible' })
    await this.input.fill(nodeName)
    await this.dropdown.waitFor({ state: 'visible' })

    const nodeOption = options?.exact
      ? this.dropdown
          .getByRole('option', { name: nodeName, exact: true })
          .first()
      : this.dropdown.getByRole('option').nth(options?.suggestionIndex ?? 0)

    await expect(nodeOption).toBeVisible()
    await nodeOption.click()
  }

  async addFilter(filterValue: string, filterType: string) {
    await this.filterButton.click()
    await this.filterSelectionPanel.addFilter(filterValue, filterType)
  }

  async removeFilter(index: number) {
    await this.filterChips
      .nth(index)
      .getByRole('button', { name: 'Remove' })
      .click()
  }

  /**
   * Returns a locator for a search result containing the specified text.
   */
  findResult(text: string): Locator {
    return this.dropdown.getByRole('option').filter({ hasText: text })
  }
}
