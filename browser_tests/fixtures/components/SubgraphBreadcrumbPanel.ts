import type { Locator, Page } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'

export class SubgraphBreadcrumbPanel {
  readonly root: Locator
  readonly backButton: Locator
  readonly renameInput: Locator
  readonly items: Locator
  readonly activeItem: Locator
  readonly missingNodesIcon: Locator
  readonly blueprintTag: Locator

  constructor(public readonly page: Page) {
    this.root = page.getByTestId(TestIds.breadcrumb.subgraph)
    this.backButton = page.getByTestId(TestIds.breadcrumb.back)
    this.renameInput = page.getByTestId(TestIds.breadcrumb.renameInput)
    this.items = this.root.locator('[data-testid^="subgraph-breadcrumb-item-"]')
    this.activeItem = this.root.locator(
      '[data-testid^="subgraph-breadcrumb-item-"][data-active]'
    )
    this.missingNodesIcon = this.root.getByTestId(
      TestIds.breadcrumb.missingNodesIcon
    )
    this.blueprintTag = this.root.getByTestId(TestIds.breadcrumb.blueprintTag)
  }

  rootItem(): Locator {
    return this.page.getByTestId(TestIds.breadcrumb.item('root'))
  }

  subgraphItem(subgraphId: string): Locator {
    return this.page.getByTestId(
      TestIds.breadcrumb.item(`subgraph-${subgraphId}`)
    )
  }

  menuFor(key: string): Locator {
    return this.page.getByTestId(TestIds.breadcrumb.menu(key))
  }

  menuItemByLabel(menuKey: string, label: string): Locator {
    return this.menuFor(menuKey).getByRole('menuitem', { name: label })
  }
}
