import { expect } from '@playwright/test'

import { getRoutes } from '../src/config/routes'
import { creatorReviews } from '../src/data/creatorReviews'
import { wanAnimate2Page } from '../src/data/wanAnimate2'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const PATH = '/wan-animate-2'
const ZH_PATH = '/zh-CN/wan-animate-2'
const HERO_TITLE = t('wanAnimate2.hero.title', 'en')
const HERO_PRIMARY = t('wanAnimate2.hero.primaryCta', 'en')
const MODELS_ROUTE = getRoutes('en').models
const STEPS_HEADING = t('wanAnimate2.steps.heading', 'en')
const REVIEWS_HEADING = t('wanAnimate2.reviews.heading', 'en')
const HIGHLIGHT_CTA = t('wanAnimate2.reviews.highlightCta', 'en')
const MCP_ROUTE = getRoutes('en').mcp
const FIRST_REVIEW = creatorReviews[0]
const WORKFLOW_URL = wanAnimate2Page.hero.primaryCta.href

test.describe('Wan Animate 2 page — desktop @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('renders the hero heading and is indexable', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: HERO_TITLE })
    ).toBeVisible()

    await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
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

test.describe('Wan Animate 2 page — link targets', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('breadcrumb trail links to the models catalog', async ({ page }) => {
    const modelsCrumb = page
      .getByRole('navigation', { name: t('ui.breadcrumb', 'en') })
      .getByRole('link', { name: t('models.breadcrumb.models', 'en') })
    await expect(modelsCrumb).toHaveAttribute('href', MODELS_ROUTE)
  })

  // Wan Animate 2 ships one workflow template, so both CTAs on the page have to
  // resolve to that same URL.
  test('every CTA points at the single Wan Animate 2 workflow', async ({
    page
  }) => {
    const ctas = page.getByRole('link', { name: HERO_PRIMARY })
    await expect(ctas).toHaveCount(2)
    for (const cta of await ctas.all()) {
      await expect(cta).toHaveAttribute('href', WORKFLOW_URL)
      await expect(cta).toHaveAttribute('target', '_blank')
    }
  })

  // The examples we were sent were Wan 2.6 renders, not Wan Animate 2, so the
  // gallery is hidden until real output arrives. Assert it is actually gone
  // rather than just empty, and that no stray hub link came back with it.
  test('ships no gallery and no Try Workflows CTA', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: t('modelLaunch.copyPrompt', 'en') })
    ).toHaveCount(0)
    // Named explicitly so the diff records exactly which clips were pulled. The
    // hero also lives under /wan-animate-2/, so a path-wide check would match it.
    for (const clip of ['dragon', 'cat', 'fisherman', 'highway']) {
      await expect(page.locator(`video[src*="${clip}.webm"]`)).toHaveCount(0)
    }
    await expect(
      page.locator('a[href="https://comfy.org/workflows"]')
    ).toHaveCount(0)
  })

  test('renders one step card per configured step', async ({ page }) => {
    const heading = page.getByRole('heading', { level: 2, name: STEPS_HEADING })
    await heading.scrollIntoViewIfNeeded()
    const steps = page
      .locator('section')
      .filter({ has: heading })
      .locator('ol > li')
    await expect(steps).toHaveCount(wanAnimate2Page.steps?.items.length ?? 0)
  })

  test('footer links back to this page', async ({ page }) => {
    const footerLink = page
      .locator('footer')
      .getByRole('link', { name: t('footer.wanAnimate2', 'en') })
    await expect(footerLink).toHaveAttribute(
      'href',
      getRoutes('en').wanAnimate2
    )
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

test.describe('Wan Animate 2 page — interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  // The Q&A is hidden until real answers land (better no info than poor info).
  // Assert it is gone from the page AND from the structured data, so restoring
  // it has to be deliberate.
  test('ships no Q&A section and no FAQPage structured data', async ({
    page
  }) => {
    await expect(page.getByRole('heading', { name: 'Q&A' })).toHaveCount(0)

    const hasFaqNode = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll('script[type="application/ld+json"]')
      ).some((s) => (s.textContent ?? '').includes('FAQPage'))
    )
    expect(hasFaqNode).toBe(false)
  })
})

test.describe('Wan Animate 2 page — zh-CN', () => {
  test('renders the localized hero and keeps the footer in locale', async ({
    page
  }) => {
    await page.goto(ZH_PATH)

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: t('wanAnimate2.hero.title', 'zh-CN')
      })
    ).toBeVisible()

    const footerLink = page
      .locator('footer')
      .getByRole('link', { name: t('footer.wanAnimate2', 'zh-CN') })
    await expect(footerLink).toHaveAttribute(
      'href',
      getRoutes('zh-CN').wanAnimate2
    )
  })
})

test.describe('Wan Animate 2 page — mobile @mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('renders the hero heading at narrow viewports', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: HERO_TITLE })
    ).toBeVisible()
  })

  test('steps heading stays within the viewport width', async ({ page }) => {
    const ctaHeading = page.getByRole('heading', {
      level: 2,
      name: STEPS_HEADING
    })
    await ctaHeading.scrollIntoViewIfNeeded()
    await expect(ctaHeading).toBeVisible()

    const box = await ctaHeading.boundingBox()
    expect(box, 'CTA heading bounding box').not.toBeNull()
    expect(box!.x + box!.width).toBeLessThanOrEqual(
      page.viewportSize()!.width + 1
    )
  })
})
