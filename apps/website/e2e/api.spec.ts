import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

const SDK_DOCS = 'https://docs.comfy.org/development/api-development/sdks'

test.describe('API page @smoke', () => {
  test('SDK CTAs link to the SDK docs from the integration card and the steps row', async ({
    page
  }) => {
    await page.goto('/api')

    const sdkLinks = page.getByRole('link', { name: 'TRY THE COMFY SDK' })
    await expect(sdkLinks).toHaveCount(2)
    for (const link of await sdkLinks.all()) {
      await expect(link).toHaveAttribute('href', SDK_DOCS)
    }
  })

  test('localized SDK CTAs are translated and keep the same docs target', async ({
    page
  }) => {
    await page.goto('/zh-CN/api')

    const sdkLinks = page.getByRole('link', { name: '试用 Comfy SDK' })
    await expect(sdkLinks).toHaveCount(2)
    for (const link of await sdkLinks.all()) {
      await expect(link).toHaveAttribute('href', SDK_DOCS)
    }
  })
})
