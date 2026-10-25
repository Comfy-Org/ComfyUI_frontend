import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { z } from 'zod'

import { test } from './fixtures/blockExternalMedia'

const catalogueSchema = z.array(
  z.object({
    name: z.string(),
    href: z.string(),
    thumbnail: z.object({ kind: z.string() }).optional()
  })
)

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
    page,
    request
  }) => {
    const catalogue = catalogueSchema.parse(
      await (await request.get('/models/catalogue.json')).json()
    )
    const imageModel = catalogue.find(
      (model) => model.thumbnail?.kind === 'image'
    )
    if (!imageModel) throw new Error('No model page has an image thumbnail')
    await page.goto(imageModel.href)
    await expect(meta(page, 'twitter:site')).toHaveAttribute(
      'content',
      '@ComfyUI'
    )
    for (const key of ['og:image:alt', 'twitter:image:alt']) {
      await expect(meta(page, key)).toHaveAttribute(
        'content',
        `${imageModel.name} example output`
      )
    }
  })
})
