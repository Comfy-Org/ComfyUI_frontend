import type { Locator, Page } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

export class ComfyNodeSearchBoxV2 {
  readonly dialog: Locator
  readonly input: Locator
  readonly filterSearch: Locator
  readonly results: Locator
  readonly filterOptions: Locator

  constructor(readonly page: Page) {
    this.dialog = page.getByRole('search')
    this.input = this.dialog.getByRole('combobox')
    this.filterSearch = this.dialog.getByRole('textbox', { name: 'Search' })
    this.results = this.dialog.getByTestId('result-item')
    this.filterOptions = this.dialog.getByTestId('filter-option')
  }

  categoryButton(categoryId: string): Locator {
    return this.dialog.getByTestId(`category-${categoryId}`)
  }

  filterBarButton(name: string): Locator {
    return this.dialog.getByRole('button', { name })
  }

  async reload(comfyPage: ComfyPage) {
    await comfyPage.settings.setSetting('Comfy.NodeSearchBoxImpl', 'default')
  }
}
