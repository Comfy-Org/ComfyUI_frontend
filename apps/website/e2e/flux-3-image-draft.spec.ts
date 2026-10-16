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
    const hero = page.getByTestId('model-launch-hero-block')
    await expect(hero).toHaveCount(2)
    await expect(hero.locator('video')).toHaveAttribute(
      'src',
      'https://media.comfy.org/website/flux-3-image/flux-hero-1280.mp4'
    )
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
      hero.getByRole('link', {
        name: prefix ? '阅读文档' : 'READ DOCS',
        exact: true
      })
    ).toHaveAttribute(
      'href',
      'https://docs.comfy.org/tutorials/flux/flux-3-klein'
    )
  })
}

test('plays the FLUX 3 Image Klein hero video on phones', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/flux-3-image-klein/')

  await expect(
    page.getByTestId('model-launch-hero-block').locator('video')
  ).toHaveAttribute(
    'src',
    'https://media.comfy.org/website/flux-3-image/flux-hero-1280.mp4'
  )
})
