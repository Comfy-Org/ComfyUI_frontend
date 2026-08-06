import { expect } from '@playwright/test'

import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

test.describe('FDCT page @smoke', () => {
  test('responds 200 and has the localized title', async ({ page }) => {
    const response = await page.goto('/fdct')
    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle(t('fdct.meta.title', 'en'))
  })

  test('hero renders the h1 and CTA pair with decided hrefs', async ({
    page
  }) => {
    await page.goto('/fdct')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      t('fdct.hero.title', 'en')
    )
    const main = page.getByRole('main')
    await expect(
      main.getByRole('link', { name: t('fdct.hero.contactCta', 'en') })
    ).toHaveAttribute('href', '/contact')
    await expect(
      main.getByRole('link', { name: t('fdct.hero.applyCta', 'en') })
    ).toHaveAttribute('href', '#')
  })
})

test.describe('FDCT page (zh-CN) @smoke', () => {
  test('responds 200 and has the localized title', async ({ page }) => {
    const response = await page.goto('/zh-CN/fdct')
    expect(response?.status()).toBe(200)
    await expect(page).toHaveTitle(t('fdct.meta.title', 'zh-CN'))
  })

  test('hero renders the localized h1 and locale-prefixed contact CTA', async ({
    page
  }) => {
    await page.goto('/zh-CN/fdct')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      t('fdct.hero.title', 'zh-CN')
    )
    const main = page.getByRole('main')
    await expect(
      main.getByRole('link', { name: t('fdct.hero.contactCta', 'zh-CN') })
    ).toHaveAttribute('href', '/zh-CN/contact')
    await expect(
      main.getByRole('link', { name: t('fdct.hero.applyCta', 'zh-CN') })
    ).toHaveAttribute('href', '#')
  })
})
