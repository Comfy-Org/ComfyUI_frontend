import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('ChatGPT Images 2.5 launch page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chatgpt-image-2.5')
  })

  test('introduces the model with the supplied hero reel', async ({ page }) => {
    const heading = page.getByRole('heading', {
      level: 1,
      name: 'ChatGPT Images 2.5 is here'
    })

    await expect(heading).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'RUN CHATGPT IMAGES 2.5' })
    ).toBeVisible()
    await expect(page.locator('video')).toHaveAttribute(
      'src',
      'https://media.comfy.org/website/chatgpt-image-2.5/hero.mp4'
    )
  })

  test('shows every supplied image in the model gallery', async ({ page }) => {
    const galleryHeading = page.getByRole('heading', {
      level: 2,
      name: 'Made with ChatGPT Images 2.5'
    })
    await galleryHeading.scrollIntoViewIfNeeded()

    await expect(galleryHeading).toBeVisible()
    const galleryImages = [
      {
        name: 'Vaporwave architecture generated with ChatGPT Images 2.5',
        src: 'https://media.comfy.org/website/chatgpt-image-2.5/vaporwave.webp'
      },
      {
        name: 'Aliens in a convenience store generated with ChatGPT Images 2.5',
        src: 'https://media.comfy.org/website/chatgpt-image-2.5/alien-convenience-store.webp'
      },
      {
        name: 'Goldfish in a glass bowl generated with ChatGPT Images 2.5',
        src: 'https://media.comfy.org/website/chatgpt-image-2.5/goldfish.webp'
      },
      {
        name: 'Flaming engine watercolor generated with ChatGPT Images 2.5',
        src: 'https://media.comfy.org/website/chatgpt-image-2.5/flame-engine.webp'
      },
      {
        name: 'Canyon car chase generated with ChatGPT Images 2.5',
        src: 'https://media.comfy.org/website/chatgpt-image-2.5/canyon-chase.webp'
      },
      {
        name: 'Anime hero at a red horizon generated with ChatGPT Images 2.5',
        src: 'https://media.comfy.org/website/chatgpt-image-2.5/anime-horizon.webp'
      }
    ]

    for (const expectedImage of galleryImages) {
      const image = page.getByRole('img', { name: expectedImage.name })
      await expect(image).toHaveAttribute('src', expectedImage.src)
      await expect
        .poll(() =>
          image.evaluate(
            (element) => (element as HTMLImageElement).naturalWidth
          )
        )
        .toBeGreaterThan(0)
    }
  })
})

test.describe('ChatGPT Images 2.5 launch page — zh-CN', () => {
  test('renders the localized launch page', async ({ page }) => {
    await page.goto('/zh-CN/chatgpt-image-2.5')

    await expect(
      page.getByRole('heading', { level: 1, name: 'ChatGPT Images 2.5 已上线' })
    ).toBeVisible()
  })
})
