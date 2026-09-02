import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { Locale } from '../src/i18n/translations'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

/**
 * Every Vue island is its own app root, so each one receives the active locale
 * as a prop. A missed prop used to render English instead of failing; these
 * specs assert the rendered symptom so a regression cannot reach production
 * silently.
 */
const ZH_ROUTES = [
  '/zh-CN/',
  '/zh-CN/about',
  '/zh-CN/api',
  '/zh-CN/cloud/',
  '/zh-CN/cloud/pricing',
  '/zh-CN/customers',
  '/zh-CN/download',
  '/zh-CN/gallery',
  '/zh-CN/mcp',
  '/zh-CN/wan-3.0'
] as const

const EN_ROUTES = ['/', '/cloud/', '/download'] as const

/** Site-wide chrome: present on every page, and translated in both locales. */
const CHROME_KEYS = [
  'nav.products',
  'nav.pricing',
  'nav.community',
  'nav.company',
  'footer.company',
  'footer.about'
] as const

async function expectChromeLocale(page: Page, locale: Locale) {
  const other: Locale = locale === 'en' ? 'zh-CN' : 'en'

  for (const key of CHROME_KEYS) {
    await expect(
      page.getByText(t(key, locale), { exact: true }).first()
    ).toBeAttached()
    await expect(page.getByText(t(key, other), { exact: true })).toHaveCount(0)
  }
}

test.describe('locale propagation', () => {
  for (const route of ZH_ROUTES) {
    test(`${route} renders zh-CN chrome, not the English fallback`, async ({
      page
    }) => {
      await page.goto(route)

      await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
      await expectChromeLocale(page, 'zh-CN')
    })
  }

  for (const route of EN_ROUTES) {
    test(`${route} renders en chrome`, async ({ page }) => {
      await page.goto(route)

      await expect(page.locator('html')).toHaveAttribute('lang', 'en')
      await expectChromeLocale(page, 'en')
    })
  }

  test('a deeply nested island receives the locale, not just the layout', async ({
    page
  }) => {
    await page.goto('/zh-CN/')

    for (const line of t('hero.title', 'zh-CN').split('\n')) {
      await expect(
        page.getByText(line, { exact: false }).first()
      ).toBeAttached()
    }
    for (const line of t('hero.title', 'en').split('\n')) {
      await expect(page.getByText(line, { exact: false })).toHaveCount(0)
    }
  })

  test('a component nested inside another component forwards the locale', async ({
    page
  }) => {
    await page.goto('/zh-CN/about')

    // VideoPlayer is nested several components deep; its controls are only
    // localized when every ancestor forwards `locale` down.
    const localizedControl = page.locator(
      `[aria-label="${t('player.fullscreen', 'zh-CN')}"]`
    )
    const englishControl = page.locator(
      `[aria-label="${t('player.fullscreen', 'en')}"]`
    )

    await expect(localizedControl.first()).toBeAttached()
    await expect(englishControl).toHaveCount(0)
  })
})
