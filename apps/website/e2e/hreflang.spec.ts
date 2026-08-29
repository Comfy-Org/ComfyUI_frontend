import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

const alternates = (page: Page) =>
  page.locator('link[rel="alternate"][hreflang]')

test.describe('hreflang alternates', () => {
  test('a localized page declares en, zh-CN, and x-default', async ({
    page
  }) => {
    await page.goto('/cli/')
    await expect(alternates(page)).toHaveCount(3)
    await expect(alternates(page).nth(0)).toHaveAttribute(
      'href',
      'https://comfy.org/cli/'
    )
    await expect(alternates(page).nth(1)).toHaveAttribute('hreflang', 'zh-CN')
    await expect(alternates(page).nth(1)).toHaveAttribute(
      'href',
      'https://comfy.org/zh-CN/cli/'
    )
    await expect(alternates(page).nth(2)).toHaveAttribute(
      'hreflang',
      'x-default'
    )
  })

  test('the zh-CN twin declares the same cluster', async ({ page }) => {
    await page.goto('/zh-CN/cli/')
    await expect(alternates(page)).toHaveCount(3)
    await expect(alternates(page).nth(0)).toHaveAttribute(
      'href',
      'https://comfy.org/cli/'
    )
  })

  test('an English-only page declares none', async ({ page }) => {
    await page.goto('/affiliates/')
    await expect(alternates(page)).toHaveCount(0)
  })

  test('the sitemap carries the same alternates as xhtml:link', async ({
    request
  }) => {
    const sitemap = await (await request.get('/sitemap-0.xml')).text()
    expect(sitemap).toContain(
      '<url><loc>https://comfy.org/mcp/</loc><xhtml:link rel="alternate" hreflang="en" href="https://comfy.org/mcp/"/><xhtml:link rel="alternate" hreflang="zh-CN" href="https://comfy.org/zh-CN/mcp/"/><xhtml:link rel="alternate" hreflang="x-default" href="https://comfy.org/mcp/"/>'
    )
    expect(sitemap).not.toMatch(
      /<loc>https:\/\/comfy\.org\/affiliates\/<\/loc><xhtml:link/
    )
  })
})
