import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'

export class WorkflowTabPopover {
  readonly root: Locator
  readonly pendingShows: Locator

  constructor(private readonly page: Page) {
    this.root = page
      .getByTestId(TestIds.topbar.workflowTabPopover)
      .filter({ visible: true })
    this.pendingShows = page
      .getByTestId(TestIds.topbar.workflowTabPopoverAnchor)
      .and(page.locator('[data-show-pending="true"]'))
  }

  async dismiss() {
    await this.page.mouse.move(-1, -1)
    await expect(this.pendingShows).toHaveCount(0)
    if ((await this.root.count()) > 0) {
      await this.page.keyboard.press('Escape')
    }
    await expect(this.root).toHaveCount(0)
  }
}
