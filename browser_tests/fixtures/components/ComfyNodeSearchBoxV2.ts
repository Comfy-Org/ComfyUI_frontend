import type { Locator, Page } from '@playwright/test'

import type { ComfyPage } from '../ComfyPage'

export class ComfyNodeSearchBoxV2 {
  readonly dialog: Locator
  readonly input: Locator
  readonly results: Locator

  constructor(readonly page: Page) {
    this.dialog = page.getByRole('search')
    this.input = this.dialog.locator('input[type="text"]')
    this.results = this.dialog.getByTestId('result-item')
  }

  get filterChips(): Locator {
    return this.dialog.getByTestId('filter-chip')
  }

  get filterPopover(): Locator {
    return this.dialog.getByRole('dialog')
  }

  get filterPopoverOptions(): Locator {
    return this.filterPopover.getByRole('option')
  }

  get filterPopoverSearch(): Locator {
    return this.filterPopover.getByRole('textbox', { name: 'Search' })
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
