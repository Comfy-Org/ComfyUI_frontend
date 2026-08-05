import { expect } from '@playwright/test'

import { externalLinks, getRoutes } from '../src/config/routes'
import { seedancePage } from '../src/data/seedance'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const PATH = '/seedance-2.5'
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
      .getByRole('navigation', { name: 'Breadcrumb' })
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

  // The announcement page omits everything the model cannot back yet. If a
  // future edit reintroduces one of these, it should be deliberate.
  test('omits the sections that need a shipped model', async ({ page }) => {
    await expect(page.locator('[id^="faq-trigger-"]')).toHaveCount(0)
    await expect(
      page.getByRole('heading', { level: 2, name: t('pricing.title', 'en') })
    ).toHaveCount(0)
    await expect(page.locator('video')).toHaveCount(0)
  })
})
