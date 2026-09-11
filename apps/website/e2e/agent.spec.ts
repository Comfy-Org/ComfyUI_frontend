import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { getAgentCards } from '../src/components/agent/agentCards'
import type { Locale } from '../src/i18n/translations'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const PATH_EN = '/agent'
const PATH_ZH = '/zh-CN/agent'

// The hero paints a permanently animated backdrop — a blurred radial gradient
// plus a drifting masked dot grid — which pins the compositor for as long as
// the page is open. Several parallel workers each holding an /agent tab starve
// the main thread badly enough to time out unrelated navigations, so this spec
// asserts a whole locale from a single visit rather than one visit per claim.
async function assertLandingPage(page: Page, path: string, locale: Locale) {
  await page.goto(path)

  await expect(page).toHaveTitle(t('agent.meta.title', locale))
  // The page is an unlisted beta waitlist: losing noindex would publish it.
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex, nofollow'
  )

  await expect(
    page.getByRole('heading', { level: 1, name: t('agent.hero.title', locale) })
  ).toBeVisible()
  await expect(page.getByText(t('agent.hero.subtitle', locale))).toBeVisible()

  await expect(
    page.getByRole('heading', {
      level: 2,
      name: t('agent.cards.heading', locale)
    })
  ).toBeVisible()

  const cards = getAgentCards(locale)
  expect(cards).toHaveLength(4)
  for (const card of cards) {
    await expect(page.getByText(card.tag, { exact: true })).toBeVisible()
    await expect(
      page.getByRole('heading', { level: 3, name: card.title })
    ).toBeVisible()
  }

  // The waitlist form only renders once Customer.io is configured, so builds
  // without the write key skip it rather than failing.
  const submit = page.getByRole('button', {
    name: t('agent.form.submit', locale)
  })
  if ((await submit.count()) > 0) {
    await expect(submit).toBeVisible()
    await expect(
      page.getByPlaceholder(t('agent.form.placeholder', locale))
    ).toBeVisible()
  }
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
