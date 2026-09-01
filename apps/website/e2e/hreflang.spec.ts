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

    // Extract the <url> entry for /mcp/ and read its xhtml:link alternates
    // independent of attribute order, rather than matching one exact string.
    const urlEntry = sitemap.match(
      /<url><loc>https:\/\/comfy\.org\/mcp\/<\/loc>(.*?)<\/url>/
    )
    expect(urlEntry, 'sitemap has a <url> entry for /mcp/').not.toBeNull()
    const alternateTags = [
      ...(urlEntry?.[1].matchAll(/<xhtml:link[^>]*\/>/g) ?? [])
    ].map((match) => match[0])
    const alternatesByHreflang = new Map(
      alternateTags.map((tag) => {
        const hreflang = tag.match(/hreflang="([^"]+)"/)?.[1]
        const href = tag.match(/href="([^"]+)"/)?.[1]
        return [hreflang, href]
      })
    )
    expect(alternatesByHreflang.get('en')).toBe('https://comfy.org/mcp/')
    expect(alternatesByHreflang.get('zh-CN')).toBe(
      'https://comfy.org/zh-CN/mcp/'
    )
    expect(alternatesByHreflang.get('x-default')).toBe('https://comfy.org/mcp/')

    expect(sitemap).not.toMatch(
      /<loc>https:\/\/comfy\.org\/affiliates\/<\/loc><xhtml:link/
    )
  })
})
