import { expect } from '@playwright/test'

import { externalLinks, getRoutes } from '../src/config/routes'
import { creatorReviews } from '../src/data/creatorReviews'
import { ltxPage } from '../src/data/ltx'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const PATH = '/ltx-2.5'
const HERO_TITLE = t('ltx.hero.title', 'en')
const MODELS_HEADING = t('ltx.models.heading', 'en')
const MODELS_ROUTE = getRoutes('en').models
const REVIEWS_HEADING = t('ltx.reviews.heading', 'en')
const HIGHLIGHT_CTA = t('ltx.reviews.highlightCta', 'en')
const MCP_ROUTE = getRoutes('en').mcp
const FIRST_REVIEW = creatorReviews[0]
const LTX_RUN_TEMPLATE = 'https://cloud.comfy.org/?template=video_ltx2_5_i2v'

test.describe('LTX 2.5 page — desktop @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('renders the hero heading and is indexable', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: HERO_TITLE })
    ).toBeVisible()

    await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
  })

  test('renders the models section heading', async ({ page }) => {
    const heading = page.getByRole('heading', {
      level: 2,
      name: MODELS_HEADING
    })
    await heading.scrollIntoViewIfNeeded()
    await expect(heading).toBeVisible()
  })

  test('renders the reviews section heading and first quote', async ({
    page
  }) => {
    const heading = page.getByRole('heading', {
      level: 2,
      name: REVIEWS_HEADING
    })
    await heading.scrollIntoViewIfNeeded()
    await expect(heading).toBeVisible()
    await expect(page.getByText(FIRST_REVIEW.name)).toBeVisible()
  })
})

test.describe('LTX 2.5 page — link targets', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('breadcrumb trail links to the models catalog', async ({ page }) => {
    const modelsCrumb = page
      .getByRole('navigation', { name: t('ui.breadcrumb', 'en') })
      .getByRole('link', { name: t('models.breadcrumb.models', 'en') })
    await expect(modelsCrumb).toHaveAttribute('href', MODELS_ROUTE)
  })

  test('the hero run CTA opens the LTX 2.5 launch template', async ({
    page
  }) => {
    const hero = page.locator('section').filter({
      has: page.getByRole('heading', { level: 1, name: HERO_TITLE })
    })
    const runCta = hero.getByRole('link', {
      name: t('ltx.hero.primaryCta', 'en')
    })
    await expect(runCta).toHaveAttribute('href', ltxPage.hero.primaryCta.href)
    await expect(runCta).toHaveAttribute('href', LTX_RUN_TEMPLATE)
    await expect(runCta).toHaveAttribute('target', '_blank')

    await expect(
      hero.getByRole('link', { name: t('ltx.hero.secondaryCta', 'en') })
    ).toHaveAttribute('href', externalLinks.workflows)
  })

  test('MCP highlight card CTA links to the MCP page', async ({ page }) => {
    const reviewsSection = page.locator('section').filter({
      has: page.getByRole('heading', { level: 2, name: REVIEWS_HEADING })
    })
    const cta = reviewsSection.getByRole('link', { name: HIGHLIGHT_CTA })
    await cta.scrollIntoViewIfNeeded()
    await expect(cta).toHaveAttribute('href', MCP_ROUTE)
  })
})

test.describe('LTX 2.5 page — mobile @mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('renders the hero heading at narrow viewports', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: HERO_TITLE })
    ).toBeVisible()
  })
})
