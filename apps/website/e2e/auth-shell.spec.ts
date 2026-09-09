import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

const AUTH_PAGES = ['/login/', '/signup/'] as const

const siteChrome = (page: Page) =>
  page.locator(
    'astro-island[component-url*="HeaderMain"], astro-island[component-url*="SiteFooter"], astro-island[component-url*="AnnouncementBanner"]'
  )

test.describe('Auth shell', () => {
  for (const path of AUTH_PAGES) {
    test(`${path} renders the bare onboarding shell`, async ({ page }) => {
      await page.setViewportSize({ width: 1536, height: 864 })
      await page.goto(path)

      await expect(siteChrome(page)).toHaveCount(0)
      await expect(page.locator('footer')).toHaveCount(0)
      await expect(
        page.getByRole('img', { name: 'ComfyOrg Logo' })
      ).toBeVisible()
      await expect(
        page.getByRole('link', { name: 'Terms of Use' })
      ).toBeVisible()
      await expect(
        page.getByRole('group', { name: 'Featured models' })
      ).toBeVisible()
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
