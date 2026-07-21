import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const CHROME_IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/145.0.7000.0 Mobile/15E148 Safari/604.1'

const injectWkWebViewBridge = async (page: Page) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'webkit', {
      configurable: true,
      value: { messageHandlers: {} }
    })
  })
}

test.describe(
  'Cloud login on iOS: Google SSO is always offered (FE-1357)',
  { tag: '@mobile-ios' },
  () => {
    test('renders Google + GitHub + in-app-browser notice on iOS Chrome even when webkit.messageHandlers is present', async ({
      browser
    }) => {
      const context = await browser.newContext({ userAgent: CHROME_IOS_UA })
      try {
        const page = await context.newPage()
        await injectWkWebViewBridge(page)

        await page.goto(APP_URL)
        await expect(page).toHaveURL(/\/cloud\/login/, { timeout: 10_000 })

        await expect(
          page.getByRole('button', { name: /google/i })
        ).toBeVisible()
        await expect(
          page.getByRole('button', { name: /github/i })
        ).toBeVisible()
        await expect(
          page.getByTestId('google-sso-in-app-browser-notice')
        ).toBeVisible()
      } finally {
        await context.close()
      }
    })

    test('renders Google + notice on iOS Safari with webkit.messageHandlers present', async ({
      page
    }) => {
      await injectWkWebViewBridge(page)

      await page.goto(APP_URL)
      await expect(page).toHaveURL(/\/cloud\/login/, { timeout: 10_000 })

      await expect(page.getByRole('button', { name: /google/i })).toBeVisible()
      await expect(
        page.getByTestId('google-sso-in-app-browser-notice')
      ).toBeVisible()
    })

    test('renders Google + notice in a bare WKWebView host (UA lacks first-party browser marker)', async ({
      browser
    }) => {
      const wkWebViewUa =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
      const context = await browser.newContext({ userAgent: wkWebViewUa })
      try {
        const page = await context.newPage()
        await injectWkWebViewBridge(page)

        await page.goto(APP_URL)
        await expect(page).toHaveURL(/\/cloud\/login/, { timeout: 10_000 })

        await expect(
          page.getByRole('button', { name: /google/i })
        ).toBeVisible()
        await expect(
          page.getByTestId('google-sso-in-app-browser-notice')
        ).toBeVisible()
      } finally {
        await context.close()
      }
    })
  }
)
