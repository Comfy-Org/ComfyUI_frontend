import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'

export class CurrentUserPopover {
  readonly trigger: Locator
  readonly root: Locator

  constructor(page: Page) {
    this.trigger = page.getByRole('button', { name: 'Current user' })
    this.root = page.getByTestId(TestIds.user.currentUserPopover)
  }

  async open(): Promise<void> {
    await this.trigger.click()
    await expect(this.root).toBeVisible()
  }

  async close(): Promise<void> {
    await this.trigger.click()
    await expect(this.root).toBeHidden()
  }
}
