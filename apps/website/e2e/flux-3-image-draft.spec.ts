import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

const previewBuild = process.env.VERCEL_ENV === 'preview'

for (const prefix of ['', '/zh-CN']) {
  test(`gates the ${prefix || 'English'} Flux image draft by deployment environment`, async ({
    page
  }) => {
    const response = await page.goto(`${prefix}/flux-3-image/`)
    const heading = page.getByRole('heading', {
      name: 'Flux 3 Image',
      exact: true
    })

    expect(response?.status()).toBe(previewBuild ? 200 : 404)
    if (!previewBuild) {
      await expect(heading).toHaveCount(0)
      return
    }

    await expect(heading).toBeVisible()
    await expect(
      page.getByRole('img', {
        name: prefix ? '视频主视觉 · 占位' : 'Video hero · FPO'
      })
    ).toBeVisible()
    await expect(
      page.getByRole('link', {
        name: prefix ? '运行 FLUX IMAGE 3' : 'RUN FLUX IMAGE 3',
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
