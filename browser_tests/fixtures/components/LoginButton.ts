import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'

export class LoginButton {
  readonly trigger: Locator
  readonly popover: Locator
  readonly learnMore: Locator

  constructor(page: Page) {
    this.trigger = page.getByTestId(TestIds.topbar.loginButton)
    this.popover = page.getByTestId(TestIds.topbar.loginButtonPopover)
    this.learnMore = page.getByTestId(
      TestIds.topbar.loginButtonPopoverLearnMore
    )
  }

  async hover(): Promise<void> {
    await this.trigger.hover()
    await expect(this.popover).toBeVisible()
  }
}
