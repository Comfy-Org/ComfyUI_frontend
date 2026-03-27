import type { Locator } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

export class ComfyNodeSearchBoxV2 {
  readonly dialog: Locator
  readonly input: Locator
  readonly filterSearch: Locator
  readonly results: Locator
  readonly filterOptions: Locator
  readonly filterChips: Locator
  readonly noResults: Locator

  constructor(private comfyPage: ComfyPage) {
    const page = comfyPage.page
    this.dialog = page.getByRole('search')
    this.input = this.dialog.getByRole('combobox')
    this.filterSearch = this.dialog.getByRole('textbox', { name: 'Search' })
    this.results = this.dialog.getByTestId('result-item')
    this.filterOptions = this.dialog.getByTestId('filter-option')
    this.filterChips = this.dialog.getByTestId('filter-chip')
    this.noResults = this.dialog.getByTestId('no-results')
  }

  categoryButton(categoryId: string): Locator {
    return this.dialog.getByTestId(`category-${categoryId}`)
  }

  filterBarButton(name: string): Locator {
    return this.dialog.getByRole('button', { name })
  }

  async applyTypeFilter(
    filterName: 'Input' | 'Output',
    typeName: string
  ): Promise<void> {
    await this.filterBarButton(filterName).click()
    await this.filterOptions.first().waitFor({ state: 'visible' })
    await this.filterSearch.fill(typeName)
    await this.filterOptions.filter({ hasText: typeName }).first().click()
    // Close the popover by clicking the trigger button again
    await this.filterBarButton(filterName).click()
    await this.filterOptions.first().waitFor({ state: 'hidden' })
  }

  async removeFilterChip(index: number = 0): Promise<void> {
    await this.filterChips.nth(index).getByTestId('chip-delete').click()
  }

  async getResultCount(): Promise<number> {
    await this.results.first().waitFor({ state: 'visible' })
    return this.results.count()
  }

  async open(): Promise<void> {
    await this.comfyPage.command.executeCommand('Workspace.SearchBox.Toggle')
    await this.input.waitFor({ state: 'visible' })
  }

  async enableV2Search(): Promise<void> {
    await this.comfyPage.settings.setSetting(
      'Comfy.NodeSearchBoxImpl',
      'default'
    )
  }
}
