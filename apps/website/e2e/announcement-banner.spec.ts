import { expect } from '@playwright/test'

import { bannerConfig, getBannerData } from '../src/config/banner'
import type { Locale } from '../src/i18n/translations'
import { t } from '../src/i18n/translations'
import { evaluateBannerVisibility } from '../src/utils/banner'
import { test } from './fixtures/blockExternalMedia'

const BANNER = '[data-slot="announcement-banner"]'

// `ja` is omitted: it has no translated banner strings and no localized paths,
// so its homepage renders the copy and CTA that `/` already asserts here.
const HOMEPAGES: ReadonlyArray<readonly [string, Locale]> = [
  ['/', 'en'],
  ['/zh-CN/', 'zh-CN']
]

/**
 * The gate BaseLayout applies before it renders the banner. It reads the clock,
 * which on this static site ran at BUILD time — a `startsAt`/`endsAt` boundary
 * crossed between the build and this run makes the two disagree.
 */
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

// The pre-paint hide signal is one attribute on <html>, so a page carrying its
// own banner beside the sitewide one can lose both to a single dismissal. /mcp
// is that page, and its Comfy Agent banner is deliberately not dismissible.
test.describe('Dismissing the sitewide banner @smoke', () => {
  const { title } = getBannerData(bannerConfig, 'en')

  test("leaves a page's own banner in place", async ({ page }) => {
    test.skip(!isOnAir('en'), 'the sitewide banner is switched off')

    await page.goto('/mcp')
    const sitewide = page.locator(BANNER).filter({ hasText: title })
    const pageOwn = page.locator(BANNER).filter({ hasNotText: title })
    await expect(pageOwn).toBeVisible()

    await sitewide.getByRole('button', { name: t('nav.close', 'en') }).click()
    await expect(page.locator('html')).toHaveAttribute('data-banner-dismissed')
    await expect(pageOwn).toBeVisible()

    await page.reload()
    await expect(sitewide).toBeHidden()
    await expect(pageOwn).toBeVisible()
  })
})
