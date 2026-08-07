import { expect } from '@playwright/test'

import { technologists } from '../src/data/fdct'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const builderReasonKeys = [
  'fdct.builders.reason1',
  'fdct.builders.reason2',
  'fdct.builders.reason3',
  'fdct.builders.reason4'
] as const

const howItWorksStepTitleKeys = [
  'fdct.howItWorks.step1.title',
  'fdct.howItWorks.step2.title',
  'fdct.howItWorks.step3.title',
  'fdct.howItWorks.step4.title'
] as const

const whatYouGetItemKeys = [
  'fdct.whatYouGet.item1',
  'fdct.whatYouGet.item2',
  'fdct.whatYouGet.item3',
  'fdct.whatYouGet.item4',
  'fdct.whatYouGet.item5'
] as const

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

  test('builders section renders the node label, reasons, and marquee', async ({
    page
  }) => {
    await page.goto('/fdct')
    await expect(
      page.getByRole('heading', { name: t('fdct.builders.title', 'en') })
    ).toBeVisible()
    await expect(
      page
        .getByText(t('fdct.builders.nodeLabel', 'en'), { exact: true })
        .first()
    ).toBeVisible()
    for (const key of builderReasonKeys) {
      await expect(page.getByText(t(key, 'en')).first()).toBeVisible()
    }
    await expect(page.getByTestId('social-proof-desktop')).toBeVisible()
  })

  test('how it works steps and what-you-get checklist render', async ({
    page
  }) => {
    await page.goto('/fdct')
    await expect(
      page.getByRole('heading', { name: t('fdct.howItWorks.title', 'en') })
    ).toBeVisible()
    for (const key of howItWorksStepTitleKeys) {
      await expect(
        page.getByRole('heading', { name: t(key, 'en'), exact: true })
      ).toBeVisible()
    }
    await expect(
      page.getByText(t('fdct.howItWorks.footnote', 'en'))
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: t('fdct.whatYouGet.title', 'en') })
    ).toBeVisible()
    for (const key of whatYouGetItemKeys) {
      await expect(page.getByText(t(key, 'en'))).toBeVisible()
    }
  })

  test('featured technologists renders the heading and three cards', async ({
    page
  }) => {
    await page.goto('/fdct')
    await expect(
      page.getByRole('heading', { name: t('fdct.technologists.title', 'en') })
    ).toBeVisible()
    for (const person of technologists) {
      await expect(page.getByText(person.name, { exact: true })).toBeVisible()
    }
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

  test('builders section renders the localized node label and reasons', async ({
    page
  }) => {
    await page.goto('/zh-CN/fdct')
    await expect(
      page.getByRole('heading', { name: t('fdct.builders.title', 'zh-CN') })
    ).toBeVisible()
    await expect(
      page
        .getByText(t('fdct.builders.nodeLabel', 'zh-CN'), { exact: true })
        .first()
    ).toBeVisible()
    for (const key of builderReasonKeys) {
      await expect(page.getByText(t(key, 'zh-CN')).first()).toBeVisible()
    }
  })

  test('how it works steps and what-you-get checklist render localized', async ({
    page
  }) => {
    await page.goto('/zh-CN/fdct')
    await expect(
      page.getByRole('heading', { name: t('fdct.howItWorks.title', 'zh-CN') })
    ).toBeVisible()
    for (const key of howItWorksStepTitleKeys) {
      await expect(
        page.getByRole('heading', { name: t(key, 'zh-CN'), exact: true })
      ).toBeVisible()
    }
    await expect(
      page.getByText(t('fdct.howItWorks.footnote', 'zh-CN'))
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: t('fdct.whatYouGet.title', 'zh-CN') })
    ).toBeVisible()
    for (const key of whatYouGetItemKeys) {
      await expect(page.getByText(t(key, 'zh-CN'))).toBeVisible()
    }
  })

  test('featured technologists renders the localized heading and three cards', async ({
    page
  }) => {
    await page.goto('/zh-CN/fdct')
    await expect(
      page.getByRole('heading', {
        name: t('fdct.technologists.title', 'zh-CN')
      })
    ).toBeVisible()
    for (const person of technologists) {
      await expect(page.getByText(person.name, { exact: true })).toBeVisible()
    }
  })
})
