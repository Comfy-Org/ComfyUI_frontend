import { expect } from '@playwright/test'

import { bannerConfig, getBannerData } from '../src/config/banner'
import type { Locale } from '../src/i18n/translations'
import { evaluateBannerVisibility } from '../src/utils/banner'
import { test } from './fixtures/blockExternalMedia'

const BANNER = '[data-slot="announcement-banner"]'

const HOMEPAGES: ReadonlyArray<readonly [string, Locale]> = [
  ['/', 'en'],
  ['/zh-CN/', 'zh-CN']
]

/** The gate BaseLayout applies at build time before it renders the banner. */
function isOnAir(locale: Locale): boolean {
  return evaluateBannerVisibility(bannerConfig, {
    currentLocale: locale,
    currentSection: 'sitewide',
    now: new Date()
  })
}

test.describe('Sitewide announcement banner @smoke', () => {
  for (const [homepage, locale] of HOMEPAGES) {
    const { title, link } = getBannerData(bannerConfig, locale)

    if (!link) {
      test.skip(`sitewide banner has no CTA to follow (${locale})`, () => {})
      continue
    }

    // Retiring a campaign (isActive, startsAt/endsAt) leaves nothing to find
    // and would make the suppression assertion pass for the wrong reason.
    const offAir = !isOnAir(locale)

    test(`promotes its destination on the ${locale} homepage`, async ({
      page
    }) => {
      test.skip(offAir, 'the sitewide banner is switched off')

      await page.goto(homepage)
      const banner = page.locator(BANNER).filter({ hasText: title })
      await expect(banner).toBeVisible()
      await expect(
        banner.getByRole('link', { name: link.title })
      ).toHaveAttribute('href', link.href)
    })

    test(`stays off the ${locale} page it promotes`, async ({ page }) => {
      test.skip(offAir, 'the sitewide banner is switched off')
      test.skip(!link.href.startsWith('/'), 'the CTA leaves the site')

      const response = await page.goto(link.href)
      expect(response?.ok()).toBe(true)
      await expect(page.locator(BANNER).filter({ hasText: title })).toHaveCount(
        0
      )
    })
  }
})
