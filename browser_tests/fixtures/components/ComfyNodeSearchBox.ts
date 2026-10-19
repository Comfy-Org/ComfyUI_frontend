import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

class ComfyNodeSearchFilterSelectionPanel {
  readonly header: Locator
  readonly root: Locator

  constructor(public readonly page: Page) {
    this.root = page.getByRole('dialog', { name: 'Add node filter condition' })
    this.header = this.root.getByRole('heading', {
      name: 'Add node filter condition'
    })
  }

  async selectFilterType(filterType: string) {
    await this.root
      .getByRole('button', { name: filterType, exact: true })
      .click()
  }

  async selectFilterValue(filterValue: string) {
    await this.root
      .getByRole('button', { name: 'Single-select dropdown' })
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
  public readonly resultsListbox: Locator
  public readonly resultOptions: Locator
  public readonly filterButton: Locator
  public readonly filterChips: Locator
  public readonly filterSelectionPanel: ComfyNodeSearchFilterSelectionPanel

  constructor(public readonly page: Page) {
    this.input = page.locator(
      '.comfy-vue-node-search-container input[type="text"]'
    )
    this.resultsListbox = page.getByRole('listbox')
    this.resultOptions = this.resultsListbox.getByRole('option')
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
    await this.resultsListbox.waitFor({ state: 'visible' })

    const nodeOption = options?.exact
      ? this.resultsListbox
          .getByRole('option', { name: nodeName, exact: true })
          .first()
      : this.resultsListbox
          .getByRole('option')
          .nth(options?.suggestionIndex ?? 0)

    await expect(nodeOption).toBeVisible()
    await nodeOption.click()
  }

  async typeQuery(query: string) {
    await this.input.waitFor({ state: 'visible' })
    await this.input.press('ControlOrMeta+A')
    await this.input.pressSequentially(query)
  }

  async waitForFirstResult(name: string) {
    await expect(this.resultOptions.first()).toHaveAccessibleName(name)
  }

  async submitSelectedResult() {
    await this.input.press('Enter')
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
    return this.resultsListbox.getByRole('option').filter({ hasText: text })
  }
}
