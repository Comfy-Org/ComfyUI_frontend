import { expect } from '@playwright/test'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
const SHARE_AUTH_STORAGE_KEY = 'Comfy.PreservedQuery.share_auth'

/**
 * Cloud distribution E2E tests.
 *
 * These tests run against the cloud build (DISTRIBUTION=cloud) and verify
 * that cloud-specific behavior is present. In CI, no Firebase auth is
 * configured, so the auth guard redirects to /cloud/login. The tests
 * verify the cloud build loaded correctly by checking for cloud-only
 * routes and elements.
 */
test.describe('Cloud distribution UI', { tag: '@cloud' }, () => {
  test('cloud build redirects unauthenticated users to login', async ({
    page
  }) => {
    await page.goto(APP_URL)
    // Cloud build has an auth guard that redirects to /cloud/login.
    // This route only exists in the cloud distribution — it's tree-shaken
    // in the OSS build. Its presence confirms the cloud build is active.
    await expect(page).toHaveURL(/\/cloud\/login/, { timeout: 10_000 })
  })

  test('preserves share auth attribution before redirecting logged-out users', async ({
    page
  }) => {
    await page.goto(new URL('/?share=abc', APP_URL).toString())

    await expect(page).toHaveURL(/\/cloud\/login/, { timeout: 10_000 })
    await expect
      .poll(() =>
        page.evaluate(
          (key) => sessionStorage.getItem(key),
          SHARE_AUTH_STORAGE_KEY
        )
      )
      .toBe(JSON.stringify({ share: 'abc' }))
  })

  test('cloud login page renders sign-in options', async ({ page }) => {
    await page.goto(APP_URL)
    await expect(page).toHaveURL(/\/cloud\/login/, { timeout: 10_000 })
    // Verify cloud-specific login UI is rendered
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible()
  })
})
