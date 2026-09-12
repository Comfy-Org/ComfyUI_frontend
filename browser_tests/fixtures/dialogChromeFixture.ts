import { test as base } from '@playwright/test'

import { DialogChrome } from '@e2e/fixtures/components/DialogChrome'

export const dialogChromeFixture = base.extend<{
  dialogChrome: DialogChrome
}>({
  dialogChrome: async ({ page }, use) => {
    await use(new DialogChrome(page))
  }
})
