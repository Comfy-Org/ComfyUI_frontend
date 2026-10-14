import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

for (const prefix of ['', '/zh-CN']) {
  test(`excludes the Flux image draft from ${prefix || 'English'} production pages`, async ({
    page
  }) => {
    const response = await page.goto(`${prefix}/flux-3-image/`)

    expect(response?.status()).toBe(404)
    await expect(
      page.getByRole('heading', { name: 'Flux 3 Image', exact: true })
    ).toHaveCount(0)
  })
}
