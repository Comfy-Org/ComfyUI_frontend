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
})
