import type { Locator, Page } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'

export class ModelImportProgressToast {
  public readonly root: Locator
  public readonly expandButton: Locator
  public readonly filterButton: Locator
  public readonly filterOptions: Locator

  constructor(page: Page) {
    this.root = page
      .getByTestId(TestIds.toast.panel)
      .filter({ hasText: 'Importing Models' })
    this.expandButton = this.root.getByRole('button', { name: 'Expand' })
    this.filterButton = this.root.getByRole('button', {
      name: /^(All|Completed|Failed)$/
    })
    this.filterOptions = page.getByRole('dialog')
  }

  async expand() {
    await this.expandButton.click()
  }

  async filterBy(status: 'All' | 'Completed' | 'Failed') {
    await this.filterButton.click()
    await this.filterOptions
      .getByRole('button', { name: status, exact: true })
      .click()
  }

  job(name: string): Locator {
    return this.root.getByText(name, { exact: true })
  }
}
