import { expect } from '@playwright/test'

import { externalLinks, getRoutes } from '../src/config/routes'
import { seedancePage } from '../src/data/seedance'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const PATH = '/seedance-2.5'
const ZH_PATH = '/zh-CN/seedance-2.5'
const HERO_TITLE = t('seedance.hero.title', 'en')
const HERO_EYEBROW = t('seedance.hero.eyebrow', 'en')
const HERO_CTA = t('seedance.hero.primaryCta', 'en')
const RUN_OPTIONS_HEADING = t('seedance.runOptions.heading', 'en')
const REVIEWS_HEADING = t('seedance.reviews.heading', 'en')
const MODELS_ROUTE = getRoutes('en').models

test.describe('Seedance 2.5 announcement page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('renders the hero over its backdrop and is indexable', async ({
    page
  }) => {
    const hero = page.locator('section').filter({
      has: page.getByRole('heading', { level: 1, name: HERO_TITLE })
    })
    await expect(hero.getByText(HERO_EYEBROW)).toBeVisible()
    await expect(
      page.getByRole('heading', { level: 1, name: HERO_TITLE })
    ).toBeVisible()
    await expect(hero.locator('img')).toHaveAttribute(
      'src',
      seedancePage.hero.placeholderImageSrc ?? ''
    )
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
  })

  test('hero CTA sends visitors to the cloud in a new tab', async ({
    page
  }) => {
    const cta = page
      .locator('section')
      .filter({
        has: page.getByRole('heading', { level: 1, name: HERO_TITLE })
      })
      .getByRole('link', { name: HERO_CTA })
    await expect(cta).toHaveAttribute('href', externalLinks.cloud)
    await expect(cta).toHaveAttribute('target', '_blank')
  })

  test('breadcrumb trail links to the models catalog', async ({ page }) => {
    const modelsCrumb = page
      .getByRole('navigation', { name: t('ui.breadcrumb', 'en') })
      .getByRole('link', { name: t('models.breadcrumb.models', 'en') })
    await expect(modelsCrumb).toHaveAttribute('href', MODELS_ROUTE)
  })

  test('renders run options and reviews', async ({ page }) => {
    const runOptions = page.getByRole('heading', {
      level: 2,
      name: RUN_OPTIONS_HEADING
    })
    await runOptions.scrollIntoViewIfNeeded()
    await expect(runOptions).toBeVisible()

    const reviews = page.getByRole('heading', {
      level: 2,
      name: REVIEWS_HEADING
    })
    await reviews.scrollIntoViewIfNeeded()
    await expect(reviews).toBeVisible()
  })

  // The announcement omits gallery, pricing, FAQ and closing CTA, so these two
  // are the only sections it should show. Asserting the whole set means
  // reintroducing any of them has to be deliberate.
  test('shows only the sections the announcement configures', async ({
    page
  }) => {
    await expect(page.getByRole('heading', { level: 2 })).toHaveText([
      RUN_OPTIONS_HEADING,
      REVIEWS_HEADING
    ])
    await expect(page.locator('video')).toHaveCount(0)
  })
})

test.describe('Seedance 2.5 announcement page — zh-CN', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ZH_PATH)
  })

  test('renders the localized hero and run options', async ({ page }) => {
    const hero = page.locator('section').filter({
      has: page.getByRole('heading', { level: 1, name: HERO_TITLE })
    })
    await expect(
      hero.getByText(t('seedance.hero.eyebrow', 'zh-CN'))
    ).toBeVisible()
    await expect(hero.getByRole('link')).toContainText(/[一-鿿]/)

    await expect(
      page.getByRole('heading', {
        level: 2,
        name: t('seedance.runOptions.heading', 'zh-CN')
      })
    ).toBeVisible()
  })

  test('breadcrumb keeps visitors inside the locale', async ({ page }) => {
    const modelsCrumb = page
      .getByRole('navigation', { name: t('ui.breadcrumb', 'zh-CN') })
      .getByRole('link', { name: t('models.breadcrumb.models', 'zh-CN') })
    await expect(modelsCrumb).toHaveAttribute('href', getRoutes('zh-CN').models)
  })
})

test.describe('Seedance 2.5 announcement page — mobile @mobile', () => {
  test('hero CTA stays visible and linked at narrow viewports', async ({
    page
  }) => {
    await page.goto(PATH)

    const cta = page
      .locator('section')
      .filter({
        has: page.getByRole('heading', { level: 1, name: HERO_TITLE })
      })
      .getByRole('link', { name: HERO_CTA })

    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', externalLinks.cloud)

    const box = await cta.boundingBox()
    expect(box, 'hero CTA bounding box').not.toBeNull()
    expect(box!.x + box!.width).toBeLessThanOrEqual(
      page.viewportSize()!.width + 1
    )
  })
})
