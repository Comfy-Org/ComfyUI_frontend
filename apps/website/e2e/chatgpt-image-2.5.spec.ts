import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('ChatGPT Image 2.5 launch page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chatgpt-image-2.5')
  })

  test('introduces the model with the supplied hero reel', async ({ page }) => {
    const heading = page.getByRole('heading', {
      level: 1,
      name: 'ChatGPT Image 2.5 is here'
    })

    await expect(heading).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'RUN CHATGPT IMAGE 2.5' })
    ).toBeVisible()
    await expect(page.locator('video')).toHaveAttribute(
      'src',
      '/images/chatgpt-image-2.5/hero.mp4'
    )
  })

  test('shows every supplied image in the model gallery', async ({ page }) => {
    const galleryHeading = page.getByRole('heading', {
      level: 2,
      name: 'Made with ChatGPT Image 2.5'
    })
    await galleryHeading.scrollIntoViewIfNeeded()

    await expect(galleryHeading).toBeVisible()
    const galleryImages = page
      .locator('section')
      .filter({ has: galleryHeading })
      .locator('img')
    await expect(galleryImages).toHaveCount(7)
    await expect(
      galleryImages.evaluateAll((images) =>
        images.map((image) => image.getAttribute('src'))
      )
    ).resolves.toEqual([
      '/images/chatgpt-image-2.5/vaporwave.webp',
      '/images/chatgpt-image-2.5/alien-convenience-store.webp',
      '/images/chatgpt-image-2.5/goldfish.webp',
      '/images/chatgpt-image-2.5/flame-engine.webp',
      '/images/chatgpt-image-2.5/canyon-chase.webp',
      '/images/chatgpt-image-2.5/anime-horizon.webp',
      '/images/chatgpt-image-2.5/cowfish-field.webp'
    ])
  })
})

test.describe('ChatGPT Image 2.5 launch page — zh-CN', () => {
  test('renders the localized launch page', async ({ page }) => {
    await page.goto('/zh-CN/chatgpt-image-2.5')

    await expect(
      page.getByRole('heading', { level: 1, name: 'ChatGPT Image 2.5 已上线' })
    ).toBeVisible()
  })
})
