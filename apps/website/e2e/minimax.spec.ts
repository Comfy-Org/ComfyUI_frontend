import { expect } from '@playwright/test'

import { externalLinks, getRoutes } from '../src/config/routes'
import { creatorReviews } from '../src/data/creatorReviews'
import { minimaxLinks, minimaxPage } from '../src/data/minimax'
import { t } from '../src/i18n/translations'
import { faqAnswerPlainText } from '../src/utils/faqAnswer'
import { test } from './fixtures/blockExternalMedia'

const PATH = '/minimax'
const HERO_TITLE =
  t('minimax.hero.titleModel', 'en') + t('minimax.hero.titleRest', 'en')
const MODELS_HEADING = t('minimax.models.heading', 'en')
const MODELS_ROUTE = getRoutes('en').models
const CTA_HEADING = t('minimax.cta.heading', 'en')
const CTA_PRIMARY = t('minimax.cta.primaryCta', 'en')
const CLOUD_URL = externalLinks.cloud
const CLOUD_RUN_URL = minimaxLinks.cloudRun
const FAQS = minimaxPage.faq.items
const FAQ_COUNT = FAQS.length
const FIRST_FAQ = FAQS[0]
const PRICING_HEADING = t('pricing.title', 'en')
const REVIEWS_HEADING = t('minimax.reviews.heading', 'en')
const HIGHLIGHT_CTA = t('minimax.reviews.highlightCta', 'en')
const MCP_ROUTE = getRoutes('en').mcp
const FIRST_REVIEW = creatorReviews[0]

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

  test('closing CTA links to the cloud workflow in a new tab', async ({
    page
  }) => {
    const ctaSection = page.locator('section').filter({
      has: page.getByRole('heading', { level: 2, name: CTA_HEADING })
    })
    const primary = ctaSection.getByRole('link', { name: CTA_PRIMARY })
    await primary.scrollIntoViewIfNeeded()
    await expect(primary).toBeVisible()
    await expect(primary).toHaveAttribute('href', CLOUD_RUN_URL)
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

  test('renders the shared pricing plans, team card and enterprise band', async ({
    page
  }) => {
    const pricingSection = page.locator('section').filter({
      has: page.getByRole('heading', { level: 2, name: PRICING_HEADING })
    })
    await pricingSection.scrollIntoViewIfNeeded()

    const standardCard = pricingSection
      .locator('[class*="rounded-4.5xl"]')
      .filter({
        has: page.getByText(t('pricing.plan.standard.label', 'en'), {
          exact: true
        })
      })
    await expect(
      standardCard.getByText(t('pricing.plan.standard.estimate', 'en'))
    ).toBeVisible()

    await expect(
      pricingSection.getByText(t('pricing.plan.team.label', 'en'), {
        exact: true
      })
    ).toBeVisible()
    await expect(
      pricingSection.getByText(t('pricing.enterprise.label', 'en'), {
        exact: true
      })
    ).toBeVisible()
  })

  test('opens on monthly billing, as the launch design specifies', async ({
    page
  }) => {
    const subscribe = page.getByRole('link', {
      name: t('pricing.plan.standard.cta', 'en')
    })
    await subscribe.scrollIntoViewIfNeeded()
    await expect(subscribe).toHaveAttribute('href', /cycle=monthly/)
  })
})

test.describe('MiniMax H3 page — FAQ interlinks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('links the answers to the docs tutorial and the launch post', async ({
    page
  }) => {
    // Answers live in a collapsed accordion, and the trigger renders
    // aria-expanded="false" server-side, so re-click until the island hydrates.
    const openAnswer = async (question: string) => {
      const trigger = page.getByRole('button', { name: question })
      await trigger.scrollIntoViewIfNeeded()
      await expect(async () => {
        await trigger.click()
        await expect(trigger).toHaveAttribute('aria-expanded', 'true')
      }).toPass()
    }

    await openAnswer(FAQS[0].question.en)
    await expect(
      page.getByRole('link', { name: 'the day-0 launch post' })
    ).toHaveAttribute('href', minimaxLinks.blog)

    await openAnswer(FAQS[FAQS.length - 1].question.en)
    await expect(
      page.getByRole('link', { name: 'the MiniMax H3 workflow tutorial' })
    ).toHaveAttribute('href', minimaxLinks.docs)
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
    await expect(
      page.getByText(faqAnswerPlainText(FIRST_FAQ.answer.en))
    ).toBeVisible()

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

    // The button renders server-side, so a click can land before the island
    // hydrates and scroll nowhere. Re-click until the track actually moves.
    await expect(async () => {
      await nextButton.click()
      await expect
        .poll(() => track.evaluate((el) => el.scrollLeft))
        .toBeGreaterThan(startScroll)
    }).toPass()
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
