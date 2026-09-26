import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

const meta = (page: Page, key: string) =>
  page.locator(`meta[property="${key}"], meta[name="${key}"]`)

test.describe('Social share tags', () => {
  test('credit @ComfyUI and describe the share image on the homepage', async ({
    page
  }) => {
    await page.goto('/')
    await expect(meta(page, 'twitter:site')).toHaveAttribute(
      'content',
      '@ComfyUI'
    )
    await expect(meta(page, 'og:image:alt')).toHaveAttribute('content', 'Comfy')
    await expect(meta(page, 'twitter:image:alt')).toHaveAttribute(
      'content',
      'Comfy'
    )
  })

  test('describe a model page share image with the model name', async ({
    page
  }) => {
    await page.goto('/models/beeble--switchx-image-edit--edit-images/')
    await expect(meta(page, 'twitter:site')).toHaveAttribute(
      'content',
      '@ComfyUI'
    )
    const modelName = (await page.title()).split(' · ')[0]
    expect(modelName).not.toBe('')
    for (const key of ['og:image:alt', 'twitter:image:alt']) {
      await expect(meta(page, key)).toHaveAttribute(
        'content',
        `${modelName} example output`
      )
    }
  })
})
