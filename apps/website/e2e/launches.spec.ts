import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { externalLinks } from '../src/config/routes'
import { drops } from '../src/data/drops'
import type { Locale } from '../src/i18n/translations'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const PATH_EN = '/launches'
const PATH_ZH = '/zh-CN/launches'
const CLOUD_URL = 'https://cloud.comfy.org'

const LOCALES: ReadonlyArray<readonly [string, Locale]> = [
  [PATH_EN, 'en'],
  [PATH_ZH, 'zh-CN']
]

function heroSection(page: Page, locale: Locale) {
  return page.locator('section').filter({
    has: page.getByRole('heading', {
      level: 1,
      name: t('launches.hero.title', locale)
    })
  })
}

function ctaSection(page: Page, locale: Locale) {
  return page.locator('section').filter({
    has: page.getByRole('heading', {
      level: 2,
      name: t('launches.cta.heading', locale)
    })
  })
}

function dropsSection(page: Page, locale: Locale) {
  return page.locator('section').filter({
    has: page.getByRole('heading', {
      level: 2,
      name: t('launches.section.title', locale)
    })
  })
}

test.describe('Launches landing — desktop @smoke', () => {
  test('renders the configured title at /launches', async ({ page }) => {
    await page.goto(PATH_EN)
    await expect(page).toHaveTitle(t('launches.page.title', 'en'))
  })

  test('renders the localized title at /zh-CN/launches', async ({ page }) => {
    await page.goto(PATH_ZH)
    await expect(page).toHaveTitle(t('launches.page.title', 'zh-CN'))
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
        name: t('launches.hero.title', 'en')
      })
    ).toBeVisible()

    await page.goto(PATH_ZH)
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: t('launches.hero.title', 'zh-CN')
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
        name: t('launches.hero.primary', locale)
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
        name: t('launches.hero.secondary', locale)
      })
      await expect(secondary).toBeVisible()
      await expect(secondary).toHaveAttribute('href', CLOUD_URL)
      await expect(secondary).toHaveAttribute('target', '_blank')
      await expect(secondary).toHaveAttribute('rel', 'noopener noreferrer')
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
          name: t('launches.cta.heading', locale)
        })
      ).toBeVisible()

      const primary = section.getByRole('link', {
        name: t('launches.cta.primary', locale)
      })
      await expect(primary).toBeVisible()
      await expect(primary).toHaveAttribute('href', externalLinks.cloud)
      await expect(primary).toHaveAttribute('target', '_blank')
      await expect(primary).toHaveAttribute('rel', 'noopener noreferrer')

      const secondary = section.getByRole('link', {
        name: t('launches.cta.secondary', locale)
      })
      await expect(secondary).toBeVisible()
      await expect(secondary).toHaveAttribute('href', externalLinks.workflows)
      await expect(secondary).toHaveAttribute('target', '_blank')
      await expect(secondary).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })

  test('drops section renders one card per data entry with the correct localized href in both locales', async ({
    page
  }) => {
    for (const [path, locale] of LOCALES) {
      await page.goto(path)
      const section = dropsSection(page, locale)

      await expect(
        section.getByRole('heading', {
          level: 2,
          name: t('launches.section.title', locale)
        })
      ).toBeVisible()

      const cards = section.locator('[data-slot="card"]')
      await expect(cards).toHaveCount(drops.length)

      for (const [i, drop] of drops.entries()) {
        const card = cards.nth(i)
        await expect(card).toContainText(drop.title[locale])
        const explore = card.getByRole('link', {
          name: drop.cta.label[locale]
        })
        await expect(explore).toBeVisible()
        await expect(explore).toHaveAttribute('href', drop.cta.href[locale])
      }
    }
  })

  test('desktop: first 4 drop cards are wider than cards 5+', async ({
    page
  }) => {
    await page.goto(PATH_EN)
    const cards = dropsSection(page, 'en').locator('[data-slot="card"]')
    await expect(cards).toHaveCount(drops.length)

    await expect
      .poll(async () => {
        const firstWidth = (await cards.nth(0).boundingBox())?.width ?? 0
        const fifthWidth = (await cards.nth(4).boundingBox())?.width ?? 0
        return firstWidth - fifthWidth
      })
      .toBeGreaterThan(0)
  })
})

test.describe('Launches landing — mobile @mobile', () => {
  test('drops grid stacks in a single column at mobile width', async ({
    page
  }) => {
    await page.goto(PATH_EN)
    const cards = dropsSection(page, 'en').locator('[data-slot="card"]')
    await expect(cards).toHaveCount(drops.length)

    const viewport = page.viewportSize()
    expect(viewport, 'viewport size').not.toBeNull()

    await expect
      .poll(async () => (await cards.nth(0).boundingBox())?.width ?? 0)
      .toBeGreaterThanOrEqual(viewport!.width * 0.7)

    await expect
      .poll(async () => {
        const firstBox = await cards.nth(0).boundingBox()
        const secondBox = await cards.nth(1).boundingBox()
        if (!firstBox || !secondBox) return false
        return secondBox.y >= firstBox.y + firstBox.height
      })
      .toBe(true)
  })

  test('closing CTA heading stays within viewport width', async ({ page }) => {
    await page.goto(PATH_EN)
    const heading = page.getByRole('heading', {
      level: 2,
      name: t('launches.cta.heading', 'en')
    })
    await heading.scrollIntoViewIfNeeded()
    await expect(heading).toBeVisible()

    const box = await heading.boundingBox()
    expect(box, 'CTA heading bounding box').not.toBeNull()
    const viewport = page.viewportSize()
    expect(viewport, 'viewport size').not.toBeNull()
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1)
  })
})
