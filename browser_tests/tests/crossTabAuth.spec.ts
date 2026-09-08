import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'
import { TestIds } from '@e2e/fixtures/selectors'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL ?? 'http://localhost:8188'

async function gotoAndWaitSignedIn(page: Page): Promise<void> {
  await page.goto(APP_URL)
  await page.waitForFunction(() => !!window.app?.extensionManager, null, {
    timeout: 45_000
  })
  await expect(page.getByTestId('current-user-button')).toBeVisible({
    timeout: 15_000
  })
}

async function bootSignedIn(page: Page): Promise<void> {
  await new CloudWorkspaceMockHelper(page).setup()
  await gotoAndWaitSignedIn(page)
}

async function expectSignedOut(page: Page, message: string): Promise<void> {
  await expect(async () => {
    expect(
      page.isClosed(),
      'a torn-down page must fail this check, never satisfy it'
    ).toBe(false)
    const url = page.url()
    expect(
      url.startsWith(APP_URL),
      `page is at "${url}", not the app: ${message}`
    ).toBe(true)
    const atLogin = url.includes('/cloud/login')
    const loginButtonVisible = await page
      .getByTestId(TestIds.topbar.loginButton)
      .isVisible()
    const userButtonGone = !(await page
      .getByTestId('current-user-button')
      .isVisible())
    expect(atLogin || loginButtonVisible || userButtonGone, message).toBe(true)
  }).toPass({ timeout: 60_000 })
}

// Two pages in one context share real Firebase IndexedDB persistence, so
// this spec exercises the SDK's cross-tab auth propagation and the app's
// user-facing reaction to it. The refresh-coordination feature (Web Locks +
// BroadcastChannel) runs on a token-lifetime cadence and is covered by the
// scheduler unit suite, not here.
test.describe('cross-tab auth', { tag: ['@cloud'] }, () => {
  // Two full app boots per test; the cloud project's default budget fits one.
  test.beforeEach(() => {
    test.setTimeout(150_000)
  })

  test('signing out in one tab signs out its sibling', async ({ browser }) => {
    const context = await browser.newContext()
    const pageA = await context.newPage()
    const pageB = await context.newPage()
    await bootSignedIn(pageA)
    await bootSignedIn(pageB)

    await pageA.getByTestId('current-user-button').click()
    await pageA.getByTestId('logout-menu-item').click()

    await expectSignedOut(pageA, 'the signing-out tab must land signed out')
    await expectSignedOut(
      pageB,
      'Firebase broadcasts the sign-out through shared persistence; the sibling tab must not keep a working session'
    )
    await context.close()
  })

  test('two tabs hold independent sessions for the same user', async ({
    browser
  }) => {
    const context = await browser.newContext()
    const pageA = await context.newPage()
    const pageB = await context.newPage()
    await bootSignedIn(pageA)
    await bootSignedIn(pageB)

    await pageA.reload()
    await pageA.waitForFunction(() => !!window.app?.extensionManager, null, {
      timeout: 45_000
    })

    await expect(
      pageA.getByTestId('current-user-button'),
      'a reload in one tab re-establishes its own session'
    ).toBeVisible({ timeout: 15_000 })
    await expect(
      pageB.getByTestId('current-user-button'),
      'the sibling tab keeps its own session untouched throughout'
    ).toBeVisible()
    await context.close()
  })
})
