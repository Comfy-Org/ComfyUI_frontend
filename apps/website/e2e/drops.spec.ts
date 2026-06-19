import { expect } from '@playwright/test'

import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const PATH_EN = '/drops'
const PATH_ZH = '/zh-CN/drops'
const CLOUD_URL = 'https://cloud.comfy.org'

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
      const heroSection = page.locator('section').filter({
        has: page.getByRole('heading', {
          level: 1,
          name: t('drops.hero.title', locale)
        })
      })
      const primary = heroSection.getByRole('link', {
        name: t('drops.hero.primary', locale)
      })
      await expect(primary).toBeVisible()
      await expect(primary).toHaveAttribute('href', expectedHref)
    }
  })

  test('hero secondary CTA opens external Cloud in a new tab on both locales', async ({
    page
  }) => {
    for (const [path, locale] of [
      [PATH_EN, 'en'],
      [PATH_ZH, 'zh-CN']
    ] as const) {
      await page.goto(path)
      const heroSection = page.locator('section').filter({
        has: page.getByRole('heading', {
          level: 1,
          name: t('drops.hero.title', locale)
        })
      })
      const secondary = heroSection.getByRole('link', {
        name: t('drops.hero.secondary', locale)
      })
      await expect(secondary).toBeVisible()
      await expect(secondary).toHaveAttribute('href', CLOUD_URL)
      await expect(secondary).toHaveAttribute('target', '_blank')
      await expect(secondary).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })
})
