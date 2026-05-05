import { expect, test } from '@playwright/test'

import { demos, getNextDemo } from '../src/config/demos'
import { t } from '../src/i18n/translations'

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

test.describe('Demo pages @smoke', () => {
  for (const demo of demos) {
    const nextDemo = getNextDemo(demo.slug)

    test(`/demos/${demo.slug} renders hero, embed, transcript, and next-demo nav`, async ({
      page
    }) => {
      await page.goto(`/demos/${demo.slug}`)

      const heading = page.getByRole('heading', { level: 1 })
      await expect(heading).toBeVisible()
      await expect(heading).toContainText(t(demo.title, 'en'))

      const ogImage = page.locator('head meta[property="og:image"]')
      await expect(ogImage).toHaveAttribute(
        'content',
        new RegExp(`${escapeRegExp(demo.slug)}-og\\.png`)
      )

      const iframe = page.locator('iframe[title*="Interactive demo"]')
      await expect(iframe).toBeAttached()
      await expect(iframe).toHaveAttribute(
        'src',
        new RegExp(escapeRegExp(demo.arcadeId))
      )

      await expect(
        page.getByRole('button', { name: /demo transcript/i })
      ).toBeVisible()

      await expect(
        page.getByText(t(nextDemo.title, 'en')).first()
      ).toBeVisible()
      await expect(
        page.locator(`img[src="${nextDemo.thumbnail}"]`).first()
      ).toBeVisible()
    })

    test(`/zh-CN/demos/${demo.slug} renders localized content`, async ({
      page
    }) => {
      await page.goto(`/zh-CN/demos/${demo.slug}`)

      await expect(page).toHaveURL(/\/zh-CN\/demos\//)

      const heading = page.getByRole('heading', { level: 1 })
      await expect(heading).toContainText(t(demo.title, 'zh-CN'))
      await expect(heading).toContainText(/[\u4E00-\u9FFF]/)

      await expect(
        page.getByText(t(nextDemo.title, 'zh-CN')).first()
      ).toBeVisible()
    })
  }

  test('demo library page renders', async ({ page }) => {
    await page.goto('/demos')
    await expect(page.getByText('Coming Soon')).toBeVisible()
  })

  test('non-existent demo returns 404', async ({ page }) => {
    const response = await page.goto('/demos/nonexistent')
    expect(response?.status()).toBe(404)
  })
})
