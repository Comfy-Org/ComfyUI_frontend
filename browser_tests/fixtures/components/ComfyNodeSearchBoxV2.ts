import type { Locator, Page } from '@playwright/test'

import type { ComfyPage } from '../ComfyPage'

export class ComfyNodeSearchBoxV2 {
  readonly dialog: Locator
  readonly input: Locator
  readonly results: Locator
  readonly filterOptions: Locator

  constructor(readonly page: Page) {
    this.dialog = page.getByRole('search')
    this.input = this.dialog.locator('input[type="text"]')
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
    // Temporary until we have a different flag for the new search box
    await comfyPage.page.goto(comfyPage.url + '?nodeRedesign=true')
    await comfyPage.canvas.waitFor({ state: 'visible' })
    await comfyPage.page.waitForFunction(
      () => window.app && window.app.extensionManager
    )
    await comfyPage.page.locator('.p-blockui-mask').waitFor({ state: 'hidden' })
    await comfyPage.nextFrame()
  }
}
