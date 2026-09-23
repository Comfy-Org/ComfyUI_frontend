import { expect } from '@playwright/test'

import { bannerConfig, getBannerData } from '../src/config/banner'
import type { Locale } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const BANNER = '[data-slot="announcement-banner"]'

const HOMEPAGES: ReadonlyArray<readonly [string, Locale]> = [
  ['/', 'en'],
  ['/zh-CN/', 'zh-CN']
]

function sitewideBanner(locale: Locale) {
  const data = getBannerData(bannerConfig, locale)
  if (!data.link) throw new Error('The sitewide banner has no CTA link')
  return { title: data.title, link: data.link }
}

test.describe('Sitewide announcement banner @smoke', () => {
  for (const [homepage, locale] of HOMEPAGES) {
    const { title, link } = sitewideBanner(locale)

    test(`promotes its destination on the ${locale} homepage`, async ({
      page
    }) => {
      await page.goto(homepage)
      const banner = page.locator(BANNER)
      await expect(banner).toContainText(title)
      await expect(
        banner.getByRole('link', { name: link.title })
      ).toHaveAttribute('href', link.href)
    })

    test(`stays off the ${locale} page it promotes`, async ({ page }) => {
      const response = await page.goto(link.href)
      expect(response?.ok()).toBe(true)
      await expect(page.locator(BANNER)).toHaveCount(0)
    })
  }
})
