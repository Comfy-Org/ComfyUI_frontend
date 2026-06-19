import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { externalLinks } from '../src/config/routes'
import type { Locale } from '../src/i18n/translations'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const PATH_EN = '/drops'
const PATH_ZH = '/zh-CN/drops'
const CLOUD_URL = 'https://cloud.comfy.org'

const LOCALES: ReadonlyArray<readonly [string, Locale]> = [
  [PATH_EN, 'en'],
  [PATH_ZH, 'zh-CN']
]

function heroSection(page: Page, locale: Locale) {
  return page.locator('section').filter({
    has: page.getByRole('heading', {
      level: 1,
      name: t('drops.hero.title', locale)
    })
  })
}

function ctaSection(page: Page, locale: Locale) {
  return page.locator('section').filter({
    has: page.getByRole('heading', {
      level: 2,
      name: t('drops.cta.heading', locale)
    })
  })
}

test.describe('Drops landing — desktop @smoke', () => {
  test('renders the configured title at /drops', async ({ page }) => {
    await page.goto(PATH_EN)
    await expect(page).toHaveTitle(t('drops.page.title', 'en'))
  })

  test('renders the localized title at /zh-CN/drops', async ({ page }) => {
    await page.goto(PATH_ZH)
    await expect(page).toHaveTitle(t('drops.page.title', 'zh-CN'))
  })

  test('is indexable at both locales', async ({ page }) => {
    await page.goto(PATH_EN)
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0)

    await page.goto(PATH_ZH)
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
  })

  test('hero h1 renders the localized title in both locales', async ({
    page
  }) => {
    await page.goto(PATH_EN)
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: t('drops.hero.title', 'en')
      })
    ).toBeVisible()

    await page.goto(PATH_ZH)
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: t('drops.hero.title', 'zh-CN')
      })
    ).toBeVisible()
  })

  test('hero primary CTA links to /download per locale', async ({ page }) => {
    for (const [path, locale, expectedHref] of [
      [PATH_EN, 'en', '/download'],
      [PATH_ZH, 'zh-CN', '/zh-CN/download']
    ] as const) {
      await page.goto(path)
      const primary = heroSection(page, locale).getByRole('link', {
        name: t('drops.hero.primary', locale)
      })
      await expect(primary).toBeVisible()
      await expect(primary).toHaveAttribute('href', expectedHref)
    }
  })

  test('hero secondary CTA opens external Cloud in a new tab on both locales', async ({
    page
  }) => {
    for (const [path, locale] of LOCALES) {
      await page.goto(path)
      const secondary = heroSection(page, locale).getByRole('link', {
        name: t('drops.hero.secondary', locale)
      })
      await expect(secondary).toBeVisible()
      await expect(secondary).toHaveAttribute('href', CLOUD_URL)
      await expect(secondary).toHaveAttribute('target', '_blank')
      await expect(secondary).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })

  test('subscribe banner shows text and a sign-up link in both locales', async ({
    page
  }) => {
    for (const [path, locale] of LOCALES) {
      await page.goto(path)
      await expect(page.getByText(t('drops.banner.text', locale))).toBeVisible()

      const signUp = page.getByRole('link', {
        name: t('drops.banner.cta', locale)
      })
      await expect(signUp).toBeVisible()
      await expect(signUp).toHaveAttribute('href', externalLinks.youtube)
      await expect(signUp).toHaveAttribute('target', '_blank')
      await expect(signUp).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })

  test('closing CTA shows heading and both action buttons in both locales', async ({
    page
  }) => {
    for (const [path, locale] of LOCALES) {
      await page.goto(path)
      const section = ctaSection(page, locale)
      await expect(
        section.getByRole('heading', {
          level: 2,
          name: t('drops.cta.heading', locale)
        })
      ).toBeVisible()

      const primary = section.getByRole('link', {
        name: t('drops.cta.primary', locale)
      })
      await expect(primary).toBeVisible()
      await expect(primary).toHaveAttribute('href', externalLinks.cloud)
      await expect(primary).toHaveAttribute('target', '_blank')
      await expect(primary).toHaveAttribute('rel', 'noopener noreferrer')

      const secondary = section.getByRole('link', {
        name: t('drops.cta.secondary', locale)
      })
      await expect(secondary).toBeVisible()
      await expect(secondary).toHaveAttribute('href', externalLinks.workflows)
      await expect(secondary).toHaveAttribute('target', '_blank')
      await expect(secondary).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })
})

test.describe('Drops landing — mobile @mobile', () => {
  test('closing CTA heading stays within viewport width', async ({ page }) => {
    await page.goto(PATH_EN)
    const heading = page.getByRole('heading', {
      level: 2,
      name: t('drops.cta.heading', 'en')
    })
    await heading.scrollIntoViewIfNeeded()
    await expect(heading).toBeVisible()

    const box = await heading.boundingBox()
    expect(box, 'CTA heading bounding box').not.toBeNull()
    expect(box!.x + box!.width).toBeLessThanOrEqual(
      page.viewportSize()!.width + 1
    )
  })
})
