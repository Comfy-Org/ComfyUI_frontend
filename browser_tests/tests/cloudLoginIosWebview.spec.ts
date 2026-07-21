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
  'Cloud login on iOS Chrome / Safari (WKWebView bridge exposed)',
  { tag: '@mobile-ios' },
  () => {
    test('shows Google sign-in button on iOS Chrome even when webkit.messageHandlers is present (FE-1357)', async ({
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
      } finally {
        await context.close()
      }
    })

    test('shows Google sign-in button on iOS Safari with webkit.messageHandlers present', async ({
      page
    }) => {
      await injectWkWebViewBridge(page)

      await page.goto(APP_URL)
      await expect(page).toHaveURL(/\/cloud\/login/, { timeout: 10_000 })

      await expect(page.getByRole('button', { name: /google/i })).toBeVisible()
    })

    test('still hides Google sign-in in an actual WKWebView (UA lacks first-party browser marker)', async ({
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

        await expect(page.getByRole('button', { name: /google/i })).toBeHidden()
        await expect(
          page.getByRole('button', { name: /github/i })
        ).toBeVisible()
      } finally {
        await context.close()
      }
    })
  }
)
