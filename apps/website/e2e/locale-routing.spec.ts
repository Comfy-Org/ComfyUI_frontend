import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

// The gallery page is served from a single [...locale] source file. These tests
// prove route parity: both locales render, the zh-CN route shows localized copy,
// each carries the right <html lang> + hreflang set, and both appear in the
// sitemap.

const ROUTES = [
  {
    locale: 'en',
    path: '/gallery',
    lang: 'en',
    title: 'Gallery - Comfy',
    label: 'GALLERY'
  },
  {
    locale: 'zh-CN',
    path: '/zh-CN/gallery',
    lang: 'zh-CN',
    title: '作品集 - Comfy',
    label: '画廊'
  }
] as const

test.describe('Gallery locale routing @smoke', () => {
  for (const route of ROUTES) {
    test(`renders the ${route.locale} gallery at ${route.path}`, async ({
      page
    }) => {
      await page.goto(route.path)

      await expect(page).toHaveTitle(route.title)
      await expect(page.locator('html')).toHaveAttribute('lang', route.lang)

      // Hero renders in every locale; the yellow "ComfyUI" span is locale-invariant.
      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        'ComfyUI'
      )

      // Localized hero label (from the translation layer) proves the right locale.
      await expect(
        page.getByText(route.label, { exact: true }).first()
      ).toBeVisible()

      // The gallery grid (client:load) hydrates and renders cards from the CMS.
      await expect(page.getByTestId('gallery-card').first()).toBeVisible()
    })

    test(`exposes the hreflang alternate set on ${route.path}`, async ({
      page
    }) => {
      await page.goto(route.path)

      // The alternate set is symmetric — identical on both locale routes.
      await expect(
        page.locator('link[rel="alternate"][hreflang="en"]')
      ).toHaveAttribute('href', /\/gallery\/?$/)
      await expect(
        page.locator('link[rel="alternate"][hreflang="zh-CN"]')
      ).toHaveAttribute('href', /\/zh-CN\/gallery\/?$/)
      await expect(
        page.locator('link[rel="alternate"][hreflang="x-default"]')
      ).toHaveAttribute('href', /\/gallery\/?$/)
    })
  }

  test('lists both locale URLs in the sitemap', async ({ request }) => {
    const res = await request.get('/sitemap-0.xml')
    expect(res.ok()).toBeTruthy()

    const xml = await res.text()
    expect(xml).toContain('https://comfy.org/gallery/')
    expect(xml).toContain('https://comfy.org/zh-CN/gallery/')
  })
})
