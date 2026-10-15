import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

for (const prefix of ['', '/zh-CN']) {
  test(`serves the ${prefix || 'English'} FLUX 3 Image Klein launch page`, async ({
    page
  }) => {
    const response = await page.goto(`${prefix}/flux-3-image-klein/`)

    expect(response?.status()).toBe(200)
    await expect(
      page.getByRole('heading', { name: 'FLUX 3 Image Klein', exact: true })
    ).toBeVisible()
    await expect(page.getByTestId('model-launch-hero-block')).toHaveCount(1)
    await expect(
      page.getByRole('link', {
        name: prefix ? '运行 FLUX 3 IMAGE KLEIN' : 'RUN FLUX 3 IMAGE KLEIN',
        exact: true
      })
    ).toHaveAttribute(
      'href',
      'https://cloud.comfy.org/?template=image_flux3_klein_t2i'
    )
    await expect(
      page.getByRole('link', {
        name: prefix ? '阅读文档' : 'READ DOCS',
        exact: true
      })
    ).toBeVisible()
  })
}
