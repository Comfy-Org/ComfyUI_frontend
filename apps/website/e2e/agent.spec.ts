import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const PATH_EN = '/agent'
const PATH_ZH = '/zh-CN/agent'
const CANONICAL: Record<'en' | 'zh-CN', string> = {
  en: 'https://comfy.org/agent/',
  'zh-CN': 'https://comfy.org/zh-CN/agent/'
}

// The hero paints a permanently animated backdrop — a blurred radial gradient
// plus a drifting masked dot grid — which pins the compositor for as long as
// the page is open. Several parallel workers each holding an /agent tab starve
// the main thread badly enough to time out unrelated navigations, so this spec
// asserts a whole locale from a single visit rather than one visit per claim.
async function assertLandingPage(
  page: Page,
  path: string,
  locale: 'en' | 'zh-CN'
) {
  await page.goto(path)

  await expect(page).toHaveTitle(t('agentPage.meta.title', locale))
  // Both locales are real, indexable pages now — losing that would drop them
  // from search.
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    CANONICAL[locale]
  )
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0)

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: `${t('agentPage.hero.titleLine1', locale)} ${t('agentPage.hero.titleLine2', locale)}`
    })
  ).toBeVisible()
  await expect(
    page.getByText(t('agentPage.hero.subtitle', locale))
  ).toBeVisible()

  await expect(
    page
      .getByRole('link', { name: t('agentPage.cta', locale), exact: true })
      .first()
  ).toHaveAttribute('href', 'https://cloud.comfy.org')

  await expect(
    page.getByRole('heading', {
      level: 2,
      name: t('agentPage.capabilities.heading', locale)
    })
  ).toBeVisible()
  for (const key of [
    'agentPage.capabilities.1.title',
    'agentPage.capabilities.2.title',
    'agentPage.capabilities.3.title'
  ] as const) {
    await expect(
      page.getByRole('heading', { level: 3, name: t(key, locale) })
    ).toBeVisible()
  }

  await expect(
    page.getByRole('heading', {
      level: 2,
      name: t('agentPage.usecases.heading', locale)
    })
  ).toBeVisible()

  await expect(
    page.getByRole('heading', {
      level: 2,
      name: t('agentPage.faq.heading', locale)
    })
  ).toBeVisible()
}

test.describe('Agent landing — desktop @smoke', () => {
  test('renders the English page at /agent', async ({ page }) => {
    await assertLandingPage(page, PATH_EN, 'en')
  })

  test('renders the Chinese page at /zh-CN/agent', async ({ page }) => {
    await assertLandingPage(page, PATH_ZH, 'zh-CN')
  })
})

test.describe('Agent navigation @smoke', () => {
  for (const [homePath, locale, expectedHref] of [
    ['/', 'en', PATH_EN],
    ['/zh-CN', 'zh-CN', PATH_ZH]
  ] as const) {
    test(`header and footer link the agent page (${locale})`, async ({
      page
    }) => {
      await page.goto(homePath)

      const nav = page.getByRole('navigation', { name: 'Main navigation' })
      await nav
        .getByTestId('desktop-nav-links')
        .getByRole('button', { name: t('nav.products', locale) })
        .hover()
      const headerLink = nav
        .getByTestId('nav-dropdown')
        .getByRole('link', { name: t('nav.comfyAgent', locale) })
      await expect(headerLink).toBeVisible()
      await expect(headerLink).toHaveAttribute('href', expectedHref)

      const footerLink = page
        .getByRole('contentinfo')
        .getByRole('link', { name: t('nav.comfyAgent', locale) })
      await expect(footerLink).toHaveAttribute('href', expectedHref)
    })
  }
})
