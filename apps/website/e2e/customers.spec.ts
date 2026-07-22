import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('Customers @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/customers')
  })

  test('hero image declares intrinsic dimensions so layout reserves space before load', async ({
    page
  }) => {
    const heroImage = page.locator('img[alt="Comfy 3D logo"]')
    await expect(heroImage).toBeVisible()
    await expect(heroImage).toHaveAttribute('width', /^\d+$/)
    await expect(heroImage).toHaveAttribute('height', /^\d+$/)

    // Dropping src must not collapse the box: width/height reserve space (CLS).
    const heightWhileUnloaded = await page.evaluate(() => {
      const img = document.querySelector<HTMLImageElement>(
        'img[alt="Comfy 3D logo"]'
      )
      if (!img) return null
      img.removeAttribute('src')
      return img.getBoundingClientRect().height
    })

    expect(heightWhileUnloaded).not.toBeNull()
    expect(heightWhileUnloaded!).toBeGreaterThan(100)
  })

  test('emits one connected JSON-LD graph describing the story collection', async ({
    page
  }) => {
    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents()
    expect(blocks).toHaveLength(1)

    const graph = JSON.parse(blocks[0])['@graph'] as Record<string, unknown>[]
    const types = graph.map((node) => node['@type'])
    expect(types.filter((type) => type === 'Organization')).toHaveLength(1)
    expect(types).toContain('CollectionPage')
    expect(types).toContain('BreadcrumbList')

    const cardSlugs = await page
      .locator('a[href^="/customers/"]')
      .evaluateAll((links) => [
        ...new Set(
          links
            .map((link) => link.getAttribute('href'))
            .filter((href): href is string =>
              /^\/customers\/[a-z0-9-]+$/.test(href ?? '')
            )
        )
      ])
    expect(cardSlugs.length).toBeGreaterThan(0)

    const list = graph.find((node) => node['@type'] === 'ItemList')
    expect(list?.itemListElement as unknown[]).toHaveLength(cardSlugs.length)
  })

  test('emits locale-derived JSON-LD URLs on the Chinese route', async ({
    page
  }) => {
    await page.goto('/zh-CN/customers')

    await expect(page.locator('a[href*="/customers/"]').first()).toBeVisible()

    const blocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents()
    expect(blocks).toHaveLength(1)

    const graph = JSON.parse(blocks[0])['@graph'] as Record<string, unknown>[]
    expect(graph.map((node) => node['@type'])).toContain('CollectionPage')
    expect(blocks[0]).toContain('/zh-CN/customers')
  })
})
