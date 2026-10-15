import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

const previewBuild = process.env.VERCEL_ENV === 'preview'

for (const prefix of ['', '/zh-CN']) {
  test(`gates the ${prefix || 'English'} Flux image draft by deployment environment`, async ({
    page
  }) => {
    const response = await page.goto(`${prefix}/flux-3-image/`)
    const heading = page.getByRole('heading', {
      name: 'FLUX 3 Image Klein',
      exact: true
    })

    expect(response?.status()).toBe(previewBuild ? 200 : 404)
    if (!previewBuild) {
      await expect(heading).toHaveCount(0)
      return
    }

    await expect(heading).toBeVisible()
    await expect(page.getByTestId('model-launch-hero-block')).toHaveCount(1)
    await expect(
      page.getByRole('link', {
        name: prefix ? '运行 FLUX 3 IMAGE KLEIN' : 'RUN FLUX 3 IMAGE KLEIN',
        exact: true
      })
    ).toHaveAttribute('href', '#launch-links')
    await expect(
      page.getByRole('link', {
        name: prefix ? '阅读文档' : 'READ DOCS',
        exact: true
      })
    ).toHaveAttribute('href', '#launch-links')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow'
    )
  })
}
