import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('Qwen-Image 2.1 launch page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/qwen-image-2.1')
  })

  test('introduces the model with the launch sizzle', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: 'Qwen-Image 2.1 is here' })
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'RUN QWEN-IMAGE 2.1' })
    ).toHaveAttribute('href', /template=image_qwen_image_2_1_t2i/)
    await expect(page.locator('video')).toHaveAttribute(
      'src',
      'https://media.comfy.org/website/qwen-image-2.1/hero-sizzle-v2.mp4'
    )
  })

  test('shows every supplied image in the model gallery', async ({ page }) => {
    const galleryHeading = page.getByRole('heading', {
      level: 2,
      name: 'Made with Qwen-Image 2.1'
    })
    await galleryHeading.scrollIntoViewIfNeeded()
    await expect(galleryHeading).toBeVisible()

    const galleryImages = [
      {
        name: 'Coffee infographic generated with Qwen-Image 2.1',
        src: 'https://media.comfy.org/website/qwen-image-2.1/infographic.webp'
      },
      {
        name: 'Editorial portrait on a Harlem stoop generated with Qwen-Image 2.1',
        src: 'https://media.comfy.org/website/qwen-image-2.1/harlem-stoop.webp'
      },
      {
        name: 'Holi colour powder burst generated with Qwen-Image 2.1',
        src: 'https://media.comfy.org/website/qwen-image-2.1/holi-powder.webp'
      },
      {
        name: 'Floating island game environment generated with Qwen-Image 2.1',
        src: 'https://media.comfy.org/website/qwen-image-2.1/game-environment.webp'
      },
      {
        name: 'Character turnaround sheet generated with Qwen-Image 2.1',
        src: 'https://media.comfy.org/website/qwen-image-2.1/character-sheet.webp'
      },
      {
        name: 'Interior architectural visualization generated with Qwen-Image 2.1',
        src: 'https://media.comfy.org/website/qwen-image-2.1/interior-archviz.webp'
      }
    ]

    for (const expectedImage of galleryImages) {
      await expect(
        page.getByRole('img', { name: expectedImage.name })
      ).toHaveAttribute('src', expectedImage.src)
    }
  })
})

test.describe('Qwen-Image 2.1 launch page — phones', () => {
  test('plays the lighter hero encode', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/qwen-image-2.1')

    await expect(page.locator('video')).toHaveAttribute(
      'src',
      'https://media.comfy.org/website/qwen-image-2.1/hero-sizzle-v2-mobile.mp4'
    )
  })
})

test.describe('Qwen-Image 2.1 launch page — zh-CN', () => {
  test('renders the localized launch page', async ({ page }) => {
    await page.goto('/zh-CN/qwen-image-2.1')

    await expect(
      page.getByRole('heading', { level: 1, name: 'Qwen-Image 2.1 已上线' })
    ).toBeVisible()
  })
})
