import { expect as baseExpect, test as base } from '@playwright/test'
import type { Page } from '@playwright/test'

const CLOUD_APP_BOOT_TIMEOUT = 45_000
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

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

export async function gotoCloudApp(page: Page, url = APP_URL): Promise<void> {
  await page.goto(new URL('/cloud/login?switchAccount=1', APP_URL).toString())
  await page.locator('#vue-app[data-v-app]').waitFor()
  await page.waitForFunction(async () => {
    const authStorePath = '/src/stores/authStore.ts'
    const { useAuthStore } = await import(authStorePath)
    return !!useAuthStore().currentUser
  })
  await page.evaluate(async (targetUrl) => {
    const routerPath = '/src/router.ts'
    const { default: router } = await import(routerPath)
    const target = new URL(targetUrl)
    await router.replace(`${target.pathname}${target.search}${target.hash}`)
  }, url)
}
