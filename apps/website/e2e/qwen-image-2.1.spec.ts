import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('Qwen Image 2.1 launch page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/qwen-image-2.1')
  })

  test('introduces the model with the supplied hero reel', async ({ page }) => {
    const heading = page.getByRole('heading', {
      level: 1,
      name: 'Qwen Image 2.1 is here'
    })

    await expect(heading).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'RUN QWEN IMAGE 2.1' })
    ).toBeVisible()
    await expect(page.locator('video')).toHaveAttribute(
      'src',
      'https://media.comfy.org/website/qwen-image-2.1/hero.mp4'
    )
  })

  test('shows every supplied image in the model gallery', async ({ page }) => {
    const galleryHeading = page.getByRole('heading', {
      level: 2,
      name: 'Made with Qwen Image 2.1'
    })
    await galleryHeading.scrollIntoViewIfNeeded()

    await expect(galleryHeading).toBeVisible()
    const galleryImages = [
      {
        name: 'Typographic concert poster generated with Qwen Image 2.1',
        src: 'https://media.comfy.org/website/qwen-image-2.1/typographic-poster.webp'
      },
      {
        name: 'Product infographic generated with Qwen Image 2.1',
        src: 'https://media.comfy.org/website/qwen-image-2.1/infographic.webp'
      },
      {
        name: 'Studio portrait generated with Qwen Image 2.1',
        src: 'https://media.comfy.org/website/qwen-image-2.1/studio-portrait.webp'
      },
      {
        name: 'Neon storefront at night generated with Qwen Image 2.1',
        src: 'https://media.comfy.org/website/qwen-image-2.1/night-storefront.webp'
      },
      {
        name: 'Comic page generated with Qwen Image 2.1',
        src: 'https://media.comfy.org/website/qwen-image-2.1/comic-page.webp'
      },
      {
        name: 'Relit interior edited with Qwen Image 2.1',
        src: 'https://media.comfy.org/website/qwen-image-2.1/interior-relight.webp'
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

test.describe('Qwen Image 2.1 launch page — zh-CN', () => {
  test('renders the localized launch page', async ({ page }) => {
    await page.goto('/zh-CN/qwen-image-2.1')

    await expect(
      page.getByRole('heading', { level: 1, name: 'Qwen Image 2.1 已上线' })
    ).toBeVisible()
  })
})
