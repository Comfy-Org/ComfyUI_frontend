import { expect, test } from '@playwright/test'

const stories = [
  ['article-gallery', 'website-blocks-cardarticlegallery01--default'],
  ['featured-carousel', 'website-blocks-featuredcarousel01--default'],
  ['hero-backdrop', 'website-blocks-herobackdrop01--default'],
  ['team-grid', 'website-blocks-teamgrid01--default'],
  ['events-composition', 'website-compositions-eventslanding--desktop']
] as const

test.describe('Marketing Storybook', { tag: ['@screenshot'] }, () => {
  for (const [name, storyId] of stories) {
    test(`${name} desktop`, async ({ page }) => {
      await page.goto(`/iframe.html?id=${storyId}&viewMode=story`)
      await expect(page.locator('#storybook-root')).toBeVisible()
      await expect(page).toHaveScreenshot(`${name}-desktop.png`, {
        fullPage: true
      })
    })

    test(`${name} mobile`, { tag: ['@mobile'] }, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(`/iframe.html?id=${storyId}&viewMode=story`)
      await expect(page.locator('#storybook-root')).toBeVisible()
      await expect(page).toHaveScreenshot(`${name}-mobile.png`, {
        fullPage: true
      })
    })
  }
})
