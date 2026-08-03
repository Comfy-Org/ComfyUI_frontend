import { expect } from '@playwright/test'

import { externalLinks, getRoutes } from '../src/config/routes'
import { minimaxFaqs, minimaxReviews } from '../src/data/minimax'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const PATH = '/minimax'
const HERO_TITLE = t('minimax.hero.title', 'en')
const MODELS_HEADING = t('minimax.models.heading', 'en')
const MODELS_ROUTE = getRoutes('en').models
const CTA_HEADING = t('minimax.cta.heading', 'en')
const CTA_PRIMARY = t('minimax.cta.primaryCta', 'en')
const CLOUD_URL = externalLinks.cloud
const FAQ_COUNT = minimaxFaqs.length
const FIRST_FAQ = minimaxFaqs[0]
const REVIEWS_HEADING = t('minimax.reviews.heading', 'en')
const HIGHLIGHT_CTA = t('minimax.reviews.highlightCta', 'en')
const MCP_ROUTE = getRoutes('en').mcp
const FIRST_REVIEW = minimaxReviews[0]

test.describe('MiniMax H3 page — desktop @smoke', () => {
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

test.describe('MiniMax H3 page — link targets', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('breadcrumb trail links to the models catalog', async ({ page }) => {
    const modelsCrumb = page
      .getByRole('navigation', { name: 'Breadcrumb' })
      .getByRole('link', { name: t('models.breadcrumb.models', 'en') })
    await expect(modelsCrumb).toHaveAttribute('href', MODELS_ROUTE)
  })

  test('closing CTA links to cloud signup in a new tab', async ({ page }) => {
    const ctaSection = page.locator('section').filter({
      has: page.getByRole('heading', { level: 2, name: CTA_HEADING })
    })
    const primary = ctaSection.getByRole('link', { name: CTA_PRIMARY })
    await primary.scrollIntoViewIfNeeded()
    await expect(primary).toBeVisible()
    await expect(primary).toHaveAttribute('href', CLOUD_URL)
    await expect(primary).toHaveAttribute('target', '_blank')
    await expect(primary).toHaveAttribute('rel', /noopener/)
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

test.describe('MiniMax H3 page — pricing section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('renders the free banner with a cloud signup CTA', async ({ page }) => {
    const banner = page.getByText(t('minimax.pricing.banner.title', 'en'))
    await banner.scrollIntoViewIfNeeded()
    await expect(banner).toBeVisible()

    const tryFree = page.getByRole('link', {
      name: t('minimax.pricing.banner.cta', 'en')
    })
    await expect(tryFree).toHaveAttribute('href', CLOUD_URL)
  })

  test('shows per-plan descriptions and cumulative feature groups', async ({
    page
  }) => {
    const planCard = (label: string) =>
      page
        .locator('[class*="rounded-4.5xl"]')
        .filter({ has: page.getByText(label, { exact: true }) })

    const standardCard = planCard(t('pricing.plan.standard.label', 'en'))
    const creatorCard = planCard(t('pricing.plan.creator.label', 'en'))
    const proCard = planCard(t('pricing.plan.pro.label', 'en'))

    await standardCard.scrollIntoViewIfNeeded()
    await expect(
      standardCard.getByText(
        t('minimax.pricing.plan.standard.description', 'en')
      )
    ).toBeVisible()

    await expect(
      creatorCard.getByText(t('minimax.pricing.plan.creator.description', 'en'))
    ).toBeVisible()
    await expect(
      creatorCard.getByText(t('minimax.pricing.everythingInStandard', 'en'))
    ).toBeVisible()

    await expect(
      proCard.getByText(t('minimax.pricing.plan.pro.description', 'en'))
    ).toBeVisible()
    await expect(
      proCard.getByText(t('minimax.pricing.everythingInCreator', 'en'))
    ).toBeVisible()
  })
})

test.describe('MiniMax H3 page — interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('emits FAQPage structured data with one entry per FAQ', async ({
    page
  }) => {
    const faqJsonLd = await page.evaluate(() => {
      const scripts = Array.from(
        document.querySelectorAll<HTMLScriptElement>(
          'script[type="application/ld+json"]'
        )
      )
      const match = scripts.find((s) =>
        (s.textContent ?? '').includes('FAQPage')
      )
      return match?.textContent ?? null
    })
    expect(faqJsonLd, 'FAQ JSON-LD script').not.toBeNull()
    const graph = JSON.parse(faqJsonLd!)['@graph'] as {
      '@type': string
      mainEntity?: unknown[]
    }[]
    const faqPage = graph.find((node) => node['@type'] === 'FAQPage')
    expect(faqPage, 'FAQPage node in @graph').toBeDefined()
    expect(faqPage!.mainEntity!.length).toBe(FAQ_COUNT)
  })

  test('emits no Product or review JSON-LD for the third-party model', async ({
    page
  }) => {
    const graphTypes = await page.evaluate(() => {
      const scripts = Array.from(
        document.querySelectorAll<HTMLScriptElement>(
          'script[type="application/ld+json"]'
        )
      )
      return scripts.flatMap((s) => {
        try {
          const parsed = JSON.parse(s.textContent ?? '{}') as {
            '@graph'?: { '@type': string }[]
          }
          return (parsed['@graph'] ?? []).map((node) => node['@type'])
        } catch {
          return []
        }
      })
    })
    expect(graphTypes).not.toContain('Product')
    expect(graphTypes).not.toContain('AggregateRating')
    expect(graphTypes).not.toContain('Review')
  })

  test('FAQ items toggle open and closed on click', async ({ page }) => {
    const firstQuestion = page.getByRole('button', {
      name: FIRST_FAQ.question.en
    })
    await firstQuestion.scrollIntoViewIfNeeded()
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'false')

    // The trigger renders aria-expanded="false" server-side, so a click can
    // land before the island hydrates. Re-click until it actually toggles.
    await expect(async () => {
      await firstQuestion.click()
      await expect(firstQuestion).toHaveAttribute('aria-expanded', 'true')
    }).toPass()
    await expect(page.getByText(FIRST_FAQ.answer.en)).toBeVisible()

    await firstQuestion.click()
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'false')
  })

  test('reviews carousel advances when Next is clicked', async ({ page }) => {
    const reviewsSection = page.locator('section').filter({
      has: page.getByRole('heading', { level: 2, name: REVIEWS_HEADING })
    })
    const track = reviewsSection
      .locator('div.overflow-x-auto')
      .filter({ has: page.getByRole('article') })
    const nextButton = reviewsSection.getByRole('button', { name: 'Next' })
    await nextButton.scrollIntoViewIfNeeded()

    const startScroll = await track.evaluate((el) => el.scrollLeft)
    await nextButton.click()
    await expect
      .poll(() => track.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(startScroll)
  })
})

test.describe('MiniMax H3 page — mobile @mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('renders the hero heading at narrow viewports', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: HERO_TITLE })
    ).toBeVisible()
  })

  test('closing CTA heading stays within the viewport width', async ({
    page
  }) => {
    const ctaHeading = page.getByRole('heading', {
      level: 2,
      name: CTA_HEADING
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
