import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const stories = [
  ['canonical-shell', 'website-pages-canonical-marketing-shell--desktop'],
  ['article-gallery', 'website-blocks-cardarticlegallery01--default'],
  ['featured-carousel', 'website-blocks-featuredcarousel01--default'],
  ['hero-backdrop', 'website-blocks-herobackdrop01--default'],
  ['hero-split', 'website-blocks-herosplit01--default'],
  ['feature-rows', 'website-blocks-featurerows01--default'],
  ['faq-split', 'website-blocks-faqsplit01--default'],
  ['reasons-split', 'website-blocks-reasonssplit01--default'],
  ['steps-grid', 'website-blocks-stepsgrid01--default'],
  ['team-grid', 'website-blocks-teamgrid01--default'],
  ['events-composition', 'website-compositions-eventslanding--desktop'],
  ['button-pill', 'website-ui-buttonpill--default-solid'],
  ['node-badge', 'website-common-nodebadge--multiple-segments']
] as const

async function prepareStory(page: Page, storyId: string) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(
    `/iframe.html?id=${storyId}&viewMode=story&globals=backgrounds.value:dark`
  )
  const root = page.locator('#storybook-root')
  await expect(root).toBeVisible()
  await page.evaluate(async () => document.fonts.ready)
  await page.locator('img').evaluateAll(async (images) => {
    await Promise.all(
      images.map((element) => {
        const image = element as HTMLImageElement
        return image.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              image.addEventListener('load', () => resolve(), { once: true })
              image.addEventListener('error', () => resolve(), { once: true })
            })
      })
    )
  })
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) animation.finish()
    for (const video of document.querySelectorAll('video')) {
      video.pause()
      video.style.visibility = 'hidden'
    }
  })
}

test.describe('Marketing Storybook', { tag: ['@screenshot'] }, () => {
  for (const [name, storyId] of stories) {
    test(`${name} desktop`, async ({ page }) => {
      await prepareStory(page, storyId)
      await expect(page).toHaveScreenshot(`${name}-desktop.png`, {
        fullPage: true,
        animations: 'disabled'
      })
    })

    test(`${name} mobile`, { tag: ['@mobile'] }, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await prepareStory(page, storyId)
      await expect(page).toHaveScreenshot(`${name}-mobile.png`, {
        fullPage: true,
        animations: 'disabled'
      })
    })
  }
})
