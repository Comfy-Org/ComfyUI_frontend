import type { Locator, Page } from '@playwright/test'
import { test as base } from '@playwright/test'

export class UserSelectPage {
  public readonly selectionUrl: string
  public readonly container: Locator
  public readonly newUserInput: Locator
  public readonly existingUserSelect: Locator
  public readonly nextButton: Locator

  constructor(
    public readonly url: string,
    public readonly page: Page
  ) {
    this.selectionUrl = url + '/user-select'
    this.container = page.locator('#comfy-user-selection')
    this.newUserInput = this.container.locator('#new-user-input')
    this.existingUserSelect = this.container.locator('#existing-user-select')
    this.nextButton = this.container.getByText('Next')
  }
}

export const userSelectPageFixture = base.extend<{
  userSelectPage: UserSelectPage
}>({
  userSelectPage: async ({ page }, use) => {
    const userSelectPage = new UserSelectPage(
      process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188',
      page
    )
    await use(userSelectPage)
  }
})
