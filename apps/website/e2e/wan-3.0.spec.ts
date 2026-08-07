import { expect } from '@playwright/test'

import { externalLinks, getRoutes } from '../src/config/routes'
import { wan3Page } from '../src/data/wan3'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const PATH = '/wan-3.0'
const ZH_PATH = '/zh-CN/wan-3.0'
const HERO_TITLE = t('wan3.hero.title')
const HERO_EYEBROW = t('wan3.hero.eyebrow')
const HERO_CTA = t('wan3.hero.primaryCta')
const RUN_OPTIONS_HEADING = t('wan3.runOptions.heading')
const REVIEWS_HEADING = t('wan3.reviews.heading')
const MODELS_ROUTE = getRoutes('en').models

test.describe('Wan 3.0 announcement page @smoke', () => {
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
      wan3Page.hero.placeholderImageSrc ?? ''
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
      .getByRole('navigation', { name: t('ui.breadcrumb') })
      .getByRole('link', { name: t('models.breadcrumb.models') })
    await expect(modelsCrumb).toHaveAttribute('href', MODELS_ROUTE)
  })

  test('footer links back to this page', async ({ page }) => {
    const footerLink = page
      .locator('footer')
      .getByRole('link', { name: t('footer.wan3') })
    await expect(footerLink).toHaveAttribute('href', getRoutes('en').wan3)
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

test.describe('Wan 3.0 announcement page — zh-CN', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ZH_PATH)
  })

  test('renders the localized hero and run options', async ({ page }) => {
    const hero = page.locator('section').filter({
      has: page.getByRole('heading', { level: 1, name: HERO_TITLE })
    })
    await expect(hero.getByText(t('wan3.hero.eyebrow', 'zh-CN'))).toBeVisible()
    await expect(hero.getByRole('link')).toContainText(/[一-鿿]/)

    await expect(
      page.getByRole('heading', {
        level: 2,
        name: t('wan3.runOptions.heading', 'zh-CN')
      })
    ).toBeVisible()
  })

  test('breadcrumb and footer keep visitors inside the locale', async ({
    page
  }) => {
    const modelsCrumb = page
      .getByRole('navigation', { name: t('ui.breadcrumb', 'zh-CN') })
      .getByRole('link', { name: t('models.breadcrumb.models', 'zh-CN') })
    await expect(modelsCrumb).toHaveAttribute('href', getRoutes('zh-CN').models)

    const footerLink = page
      .locator('footer')
      .getByRole('link', { name: t('footer.wan3', 'zh-CN') })
    await expect(footerLink).toHaveAttribute('href', getRoutes('zh-CN').wan3)
  })
})

test.describe('Wan 3.0 announcement page — mobile @mobile', () => {
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

    await cta.scrollIntoViewIfNeeded()
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', externalLinks.cloud)

    const box = await cta.boundingBox()
    const viewport = page.viewportSize()
    if (!box || !viewport) {
      throw new Error('hero CTA has no layout box to measure')
    }

    // toBeVisible() does not imply the element sits inside the viewport, so
    // check all four edges. One pixel of tolerance for subpixel rounding.
    expect(box.x).toBeGreaterThanOrEqual(-1)
    expect(box.y).toBeGreaterThanOrEqual(-1)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1)
  })
})
