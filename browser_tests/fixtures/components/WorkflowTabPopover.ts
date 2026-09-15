import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'

export class WorkflowTabPopover {
  readonly root: Locator
  readonly thumbnail: Locator

  constructor(private readonly page: Page) {
    this.root = page.getByTestId(TestIds.topbar.workflowTabPopover)
    this.thumbnail = this.root.getByRole('img')
  }

  async dismiss() {
    await this.page.mouse.move(10, 10)
    if (await this.root.isVisible()) {
      await this.page.keyboard.press('Escape')
    }
    await expect(this.root).toBeHidden()
  }
}
