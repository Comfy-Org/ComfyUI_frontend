import { expect as baseExpect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

const CLOUD_APP_BOOT_TIMEOUT = 45_000

export const cloudAppFixture = base.extend({
  page: async ({ page }, use, testInfo) => {
    testInfo.setTimeout(CLOUD_APP_BOOT_TIMEOUT)
    await use(page)
  }
})

export const cloudAppExpect = baseExpect.configure({
  timeout: CLOUD_APP_BOOT_TIMEOUT
})

export async function waitForCloudApp(page: Page): Promise<void> {
  await page.waitForFunction(() => !!window.app?.extensionManager, null, {
    timeout: CLOUD_APP_BOOT_TIMEOUT
  })
}
