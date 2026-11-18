import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'

export class CurrentUserPopover {
  readonly trigger: Locator
  readonly root: Locator
  readonly logoutMenuItem: Locator

  constructor(page: Page) {
    this.trigger = page.getByRole('button', { name: 'Current user' })
    this.root = page.getByTestId(TestIds.user.currentUserPopover)
    this.logoutMenuItem = page.getByTestId(TestIds.user.logoutMenuItem)
  }

  async open(): Promise<void> {
    await this.trigger.click()
    await expect(this.root).toBeVisible()
  }

  async close(): Promise<void> {
    await this.trigger.click()
    await expect(this.root).toBeHidden()
  }

  async signOut(): Promise<void> {
    await this.trigger.click()
    await this.logoutMenuItem.click()
  }
}
