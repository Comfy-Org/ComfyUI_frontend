import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

const AUTH_PAGES = [
  { path: '/login/', termsNotice: true },
  { path: '/signup/', termsNotice: true },
  { path: '/forgot-password/', termsNotice: false }
] as const

/** The site's header nav and footer landmarks; the shell must carry neither. */
const siteChrome = (page: Page) =>
  page.getByRole('navigation').or(page.getByRole('contentinfo'))

test.describe('Auth shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/cdn-cgi/trace', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: 'loc=US\n'
      })
    )
    await page.route(/https:\/\/www\.(google|baidu)\.com\/?/, (route) =>
      route.fulfill({ status: 204, body: '' })
    )
  })

  for (const { path, termsNotice } of AUTH_PAGES) {
    test(`${path} renders the bare onboarding shell`, async ({ page }) => {
      await page.setViewportSize({ width: 1536, height: 864 })
      await page.goto(path)

      await expect(siteChrome(page)).toHaveCount(0)
      await expect(
        page.getByRole('img', { name: 'ComfyOrg Logo' })
      ).toBeVisible()
      await expect(
        page.getByRole('link', { name: 'Terms of Use' })
      ).toBeVisible()
      await expect(
        page.getByRole('group', { name: 'Featured models' })
      ).toBeVisible()
      await expect(page.locator('footer')).toHaveCount(termsNotice ? 0 : 1)
      await expect(page.getByText(/Questions\? Contact us/)).toHaveCount(
        termsNotice ? 1 : 0
      )
    })

    test(`${path} links out to the legal pages like the cloud shell`, async ({
      page
    }) => {
      await page.setViewportSize({ width: 1536, height: 864 })
      await page.goto(path)

      await expect(
        page.getByRole('link', { name: 'ComfyOrg Logo' }),
        'the cloud shell shows a plain wordmark'
      ).toHaveCount(0)
      for (const [name, href] of [
        ['Terms of Use', 'https://comfy.org/terms-of-service/'],
        ['Privacy Policy', 'https://comfy.org/privacy-policy/'],
        [termsNotice ? 'here' : 'Need Help?', 'https://support.comfy.org']
      ] as const) {
        const link = page.getByRole('link', { name, exact: true })
        await expect(link).toHaveAttribute('href', href)
        await expect(link).toHaveAttribute('target', '_blank')
        await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      }
    })
  }

  test('does not mount the hero video below xl', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.goto('/login/')

    await expect(page.getByRole('img', { name: 'ComfyOrg Logo' })).toBeVisible()
    await expect(page.locator('video')).toHaveCount(0)
  })
})

test.describe('Auth shell before hydration', () => {
  test.use({ javaScriptEnabled: false })

  test('keeps the hero column at first paint on a wide viewport', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1536, height: 864 })
    await page.goto('/login/')

    await expect(page.getByTestId('auth-hero-column')).toBeVisible()
    await expect(page.locator('video')).toHaveCount(0)
  })
})
