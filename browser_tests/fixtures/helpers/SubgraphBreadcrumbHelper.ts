import { test as base, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { SubgraphBreadcrumbPanel } from '@e2e/fixtures/components/SubgraphBreadcrumbPanel'

export class SubgraphBreadcrumbHelper {
  readonly panel: SubgraphBreadcrumbPanel

  constructor(public readonly page: Page) {
    this.panel = new SubgraphBreadcrumbPanel(page)
  }

  async clickBack(): Promise<void> {
    await this.panel.backButton.click()
  }

  async clickItem(key: string): Promise<void> {
    await this.page.getByTestId(`subgraph-breadcrumb-item-${key}`).click()
  }

  async openActiveItemMenu(menuKey: string): Promise<void> {
    await this.panel.activeItem.click()
    await expect(this.panel.menuFor(menuKey)).toBeVisible()
  }

  async startRenameActiveItem(): Promise<void> {
    await this.panel.activeItem.dblclick()
    await expect(this.panel.renameInput).toBeVisible()
  }

  async commitRename(newName: string): Promise<void> {
    await this.panel.renameInput.fill(newName)
    await this.panel.renameInput.press('Enter')
    await expect(this.panel.renameInput).toBeHidden()
  }

  async cancelRename(): Promise<void> {
    await this.panel.renameInput.press('Escape')
    await expect(this.panel.renameInput).toBeHidden()
  }
}

export const subgraphBreadcrumbFixture = base.extend<{
  subgraphBreadcrumb: SubgraphBreadcrumbHelper
}>({
  subgraphBreadcrumb: async ({ page }, use) => {
    await use(new SubgraphBreadcrumbHelper(page))
  }
})
