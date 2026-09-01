import { expect } from '@playwright/test'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
const SHARE_AUTH_STORAGE_KEY = 'Comfy.PreservedQuery.share_auth'
const SETTINGS_STORAGE_KEY = 'Comfy.PreservedQuery.settings'

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

  test('preserves the settings deep link before redirecting logged-out users', async ({
    page
  }) => {
    await page.goto(new URL('/?settings=plan-credits', APP_URL).toString())

    await expect(page).toHaveURL(/\/cloud\/login/, { timeout: 10_000 })
    await expect
      .poll(() =>
        page.evaluate(
          (key) => sessionStorage.getItem(key),
          SETTINGS_STORAGE_KEY
        )
      )
      .toBe(JSON.stringify({ settings: 'plan-credits' }))
  })

  test('cloud login page renders sign-in options', async ({ page }) => {
    await page.goto(APP_URL)
    await expect(page).toHaveURL(/\/cloud\/login/, { timeout: 10_000 })
    // Verify cloud-specific login UI is rendered
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible()
  })

  test('unknown paths redirect to cloud login instead of hanging on splash screen', async ({
    page
  }) => {
    // Load the SPA at root (the backend serves index.html for /).
    // Then push an unknown path client-side so Vue Router handles it.
    // The backend serves ComfyUI file responses for arbitrary paths, so a
    // direct page.goto('/woiadawd') would trigger a download rather than the SPA.
    await page.goto(APP_URL)
    await expect(page).toHaveURL(/\/cloud\/login/, { timeout: 10_000 })

    // Navigate client-side to an unknown path. The catch-all route redirects to /,
    // then the auth guard sends unauthenticated users back to /cloud/login.
    // Regression: before the catch-all was added, the SPA found no route and
    // startStoreBootstrap hung indefinitely on the splash screen.
    await page.evaluate(() => {
      window.history.pushState(null, '', '/woiadawd')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await expect(page).toHaveURL(/\/cloud\/login/, { timeout: 10_000 })
  })
})
