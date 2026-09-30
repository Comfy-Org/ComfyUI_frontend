import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { tAgent } from '../src/components/agent/agentTranslations'
import { t } from '../src/i18n/site'
import { test } from './fixtures/blockExternalMedia'

const PATH_EN = '/agent/'
const PATH_ZH = '/zh-CN/agent/'
const CANONICAL: Record<'en' | 'zh-CN', string> = {
  en: 'https://comfy.org/agent/',
  'zh-CN': 'https://comfy.org/zh-CN/agent/'
}

async function assertLandingPage(
  page: Page,
  path: string,
  locale: 'en' | 'zh-CN'
) {
  await page.goto(path)

  await expect(page).toHaveTitle(tAgent('agentPage.meta.title', locale))
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    CANONICAL[locale]
  )
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0)

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: `${tAgent('agentPage.hero.titleLine1', locale)} ${tAgent('agentPage.hero.titleLine2', locale)}`
    })
  ).toBeVisible()
  await expect(
    page.getByText(tAgent('agentPage.hero.subtitle', locale))
  ).toBeVisible()

  await expect(
    page
      .getByRole('link', { name: tAgent('agentPage.cta', locale), exact: true })
      .first()
  ).toHaveAttribute('href', 'https://cloud.comfy.org')

  await expect(
    page.getByRole('heading', {
      level: 2,
      name: tAgent('agentPage.capabilities.heading', locale)
    })
  ).toBeVisible()
  for (const key of [
    'agentPage.capabilities.1.title',
    'agentPage.capabilities.2.title',
    'agentPage.capabilities.3.title'
  ] as const) {
    await expect(
      page.getByRole('heading', { level: 3, name: tAgent(key, locale) })
    ).toBeVisible()
  }

  await expect(
    page.getByRole('heading', {
      level: 2,
      name: tAgent('agentPage.usecases.heading', locale)
    })
  ).toBeVisible()

  await expect(
    page.getByRole('heading', {
      level: 2,
      name: tAgent('agentPage.faq.heading', locale)
    })
  ).toBeVisible()

  await page
    .getByText(tAgent('agentPage.faq.6.q', locale), { exact: true })
    .click()
  await expect(
    page.getByRole('link', {
      name: tAgent('agentPage.faq.6.linkLabel', locale)
    })
  ).toHaveAttribute('href', locale === 'en' ? '/pricing/' : '/zh-CN/pricing/')
}

test.describe('Agent landing — desktop @smoke', () => {
  test('renders the English page at /agent', async ({ page }) => {
    await assertLandingPage(page, PATH_EN, 'en')
  })

  test('renders the Chinese page at /zh-CN/agent', async ({ page }) => {
    await assertLandingPage(page, PATH_ZH, 'zh-CN')
    await expect(
      page.getByRole('img', { name: '一组创意图像与社区工作流' })
    ).toBeAttached()
    await expect(
      page.getByRole('region', { name: 'Comfy Agent 构建工作流', exact: true })
    ).toBeAttached()
    await expect(
      page.getByRole('img', { name: '用户与智能体协作' })
    ).toBeAttached()
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
        .getByRole('button', {
          name: t('nav.products', {}, { locale: locale })
        })
        .hover()
      const headerLink = nav.getByTestId('nav-dropdown').getByRole('link', {
        name: t('nav.comfyAgent', {}, { locale: locale })
      })
      await expect(headerLink).toBeVisible()
      await expect(headerLink).toHaveAttribute('href', expectedHref)

      const footerLink = page.getByRole('contentinfo').getByRole('link', {
        name: t('nav.comfyAgent', {}, { locale: locale })
      })
      await expect(footerLink).toHaveAttribute('href', expectedHref)
    })
  }
})
