import { expect, test } from '@playwright/test'

import { demos } from '../src/config/demos'
import { t } from '../src/i18n/translations'

test.describe('Demo pages @smoke', () => {
  for (const demo of demos) {
    test(`/demos/${demo.slug} renders hero, embed, transcript, and next-demo nav`, async ({
      page
    }) => {
      await page.goto(`/demos/${demo.slug}`)

      const heading = page.getByRole('heading', { level: 1 })
      await expect(heading).toBeVisible()
      await expect(heading).toContainText(t(demo.title, 'en'))

      const iframe = page.locator('iframe[title*="Interactive demo"]')
      await expect(iframe).toBeAttached()
      await expect(iframe).toHaveAttribute(
        'src',
        new RegExp(`${demo.arcadeId}`)
      )

      await expect(
        page.getByRole('button', { name: /demo transcript/i })
      ).toBeVisible()

      await expect(page.getByText(/what's next/i)).toBeVisible()
    })

    test(`/zh-CN/demos/${demo.slug} renders localized content`, async ({
      page
    }) => {
      await page.goto(`/zh-CN/demos/${demo.slug}`)
      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        t(demo.title, 'zh-CN')
      )
      await expect(
        page.getByText(t('demos.nav.nextDemo', 'zh-CN'))
      ).toBeVisible()
      await expect(
        page
          .getByRole('link', { name: t('demos.nav.viewDemo', 'zh-CN') })
          .first()
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
