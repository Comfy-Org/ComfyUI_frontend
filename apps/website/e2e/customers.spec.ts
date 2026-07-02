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

    // Regression guard: an unloaded <img> without intrinsic dimensions
    // collapses to ~0px, then jumps to its natural size on load and pushes
    // the video below it. Reserved space must persist before bytes arrive.
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

    // A single self-contained @graph; the site-wide Organization/WebSite are
    // opted out here so they are not duplicated (also guards the head-slot
    // triple-render regression).
    expect(blocks).toHaveLength(1)

    const graph = JSON.parse(blocks[0])['@graph'] as Record<string, unknown>[]
    const types = graph.map((node) => node['@type'])
    expect(types.filter((type) => type === 'Organization')).toHaveLength(1)
    expect(types).toContain('CollectionPage')

    const list = graph.find((node) => node['@type'] === 'ItemList')
    expect(list?.itemListElement as unknown[]).toHaveLength(10)
  })
})
