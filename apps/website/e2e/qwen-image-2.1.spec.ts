import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('Qwen Image 2.1 announcement page @smoke', () => {
  test('announces the model as coming soon', async ({ page }) => {
    await page.goto('/qwen-image-2.1')

    await expect(page.getByText('Coming soon')).toBeVisible()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Qwen Image 2.1' })
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'GET NOTIFIED' })).toBeVisible()
    await expect(page.locator('video')).toHaveCount(0)
  })
})

test.describe('Qwen Image 2.1 announcement page — zh-CN', () => {
  test('renders the localized announcement page', async ({ page }) => {
    await page.goto('/zh-CN/qwen-image-2.1')

    await expect(page.getByText('即将上线')).toBeVisible()
    await expect(
      page.getByRole('heading', { level: 1, name: 'Qwen Image 2.1' })
    ).toBeVisible()
    await expect(page.getByRole('link', { name: '获取通知' })).toBeVisible()
  })
})

test.describe('Qwen Image 2.1 launch preview', () => {
  test('plays the full hero reel on desktop', async ({ page }) => {
    await page.goto('/qwen-image-2.1/launch-preview')

    await expect(
      page.getByRole('heading', { level: 1, name: 'Qwen Image 2.1 is here' })
    ).toBeVisible()
    await expect(page.locator('video')).toHaveAttribute(
      'src',
      'https://media.comfy.org/website/qwen-image-2.1/hero.mp4'
    )
  })

  test('plays the lighter hero encode on phones', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/qwen-image-2.1/launch-preview')

    await expect(page.locator('video')).toHaveAttribute(
      'src',
      'https://media.comfy.org/website/qwen-image-2.1/hero-mobile.mp4'
    )
  })

  test('shows every supplied image in the model gallery', async ({ page }) => {
    await page.goto('/qwen-image-2.1/launch-preview')

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex/
    )
    const galleryHeading = page.getByRole('heading', {
      level: 2,
      name: 'Made with Qwen Image 2.1'
    })
    await galleryHeading.scrollIntoViewIfNeeded()
    await expect(galleryHeading).toBeVisible()

    const galleryImages = [
      {
        name: 'Coffee infographic generated with Qwen Image 2.1',
        src: 'https://media.comfy.org/website/qwen-image-2.1/infographic.webp'
      },
      {
        name: 'Editorial portrait on a Harlem stoop generated with Qwen Image 2.1',
        src: 'https://media.comfy.org/website/qwen-image-2.1/harlem-stoop.webp'
      },
      {
        name: 'Holi colour powder burst generated with Qwen Image 2.1',
        src: 'https://media.comfy.org/website/qwen-image-2.1/holi-powder.webp'
      },
      {
        name: 'Floating island game environment generated with Qwen Image 2.1',
        src: 'https://media.comfy.org/website/qwen-image-2.1/game-environment.webp'
      },
      {
        name: 'Character turnaround sheet generated with Qwen Image 2.1',
        src: 'https://media.comfy.org/website/qwen-image-2.1/character-sheet.webp'
      },
      {
        name: 'Interior architectural visualization generated with Qwen Image 2.1',
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
