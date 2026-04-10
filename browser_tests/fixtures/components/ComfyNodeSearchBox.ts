import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

export class ComfyNodeSearchFilterSelectionPanel {
  readonly root: Locator

  constructor(public readonly page: Page) {
    this.root = page.getByRole('dialog')
  }

  get header() {
    return this.root
      .locator('div')
      .filter({ hasText: 'Add node filter condition' })
  }

  async selectFilterType(filterType: string) {
    await this.page
      .locator(
        `.filter-type-select .p-togglebutton-label:has-text("${filterType}")`
      )
      .click()
  }

  async selectFilterValue(filterValue: string) {
    await this.page.locator('.filter-value-select .p-select-dropdown').click()
    await this.page
      .locator(
        `.p-select-overlay .p-select-list .p-select-option-label:text-is("${filterValue}")`
      )
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
  public readonly filterSelectionPanel: ComfyNodeSearchFilterSelectionPanel

  constructor(public readonly page: Page) {
    this.input = page.locator(
      '.comfy-vue-node-search-container input[type="text"]'
    )
    this.dropdown = page.locator(
      '.comfy-vue-node-search-container .p-autocomplete-list'
    )
    this.filterSelectionPanel = new ComfyNodeSearchFilterSelectionPanel(page)
  }

  get filterButton() {
    return this.page.locator('.comfy-vue-node-search-container .filter-button')
  }

  async fillAndSelectFirstNode(
    nodeName: string,
    options?: { suggestionIndex?: number; exact?: boolean }
  ) {
    await this.input.waitFor({ state: 'visible' })
    await this.input.fill(nodeName)
    await this.dropdown.waitFor({ state: 'visible' })

    const nodeOption = options?.exact
      ? this.dropdown.locator(`li[aria-label="${nodeName}"]`).first()
      : this.dropdown.locator('li').nth(options?.suggestionIndex ?? 0)

    await expect(nodeOption).toBeVisible()
    await nodeOption.click()
  }

  async addFilter(filterValue: string, filterType: string) {
    await this.filterButton.click()
    await this.filterSelectionPanel.addFilter(filterValue, filterType)
  }

  get filterChips() {
    return this.page.locator(
      '.comfy-vue-node-search-container .p-autocomplete-chip-item'
    )
  }

  async removeFilter(index: number) {
    await this.filterChips.nth(index).locator('.p-chip-remove-icon').click()
  }

  /**
   * Returns a locator for a search result containing the specified text.
   */
  findResult(text: string): Locator {
    return this.dropdown.locator('li').filter({ hasText: text })
  }
}
