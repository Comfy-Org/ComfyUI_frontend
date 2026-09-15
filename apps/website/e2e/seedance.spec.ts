import { expect } from '@playwright/test'

import { getRoutes } from '../src/config/routes'
import { creatorReviews } from '../src/data/creatorReviews'
import { seedancePage } from '../src/data/seedance'
import { t } from '../src/i18n/translations'
import type { ModelLaunchCta } from '../src/templates/model-launch/types'
import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'

const PATH = '/seedance-2.5'
const HERO_TITLE = t('seedance.hero.title', 'en')
const MODELS_HEADING = t('seedance.models.heading', 'en')
const MODELS_ROUTE = getRoutes('en').models
const STEPS_HEADING = t('seedance.steps.heading', 'en')
const STEPS_SECONDARY = t('seedance.steps.secondaryCta', 'en')
const STEPS_PRIMARY = t('seedance.steps.primaryCta', 'en')
const HERO_PRIMARY_CTA: ModelLaunchCta | undefined =
  seedancePage.hero.primaryCta
if (!HERO_PRIMARY_CTA)
  throw new Error('seedancePage must configure a hero primary CTA')
const SEEDANCE_RUN: string = HERO_PRIMARY_CTA.href
// The hub's Seedance family page, which lists the shipped 2.5 workflows. The
// CTA used to open the hub root, leaving the reader to find the model they had
// just read about.
const SEEDANCE_HUB_PAGE: string = seedancePage.hero.secondaryCta?.href ?? ''
const PROMPT_CTA = t('seedance.hero.promptCta', 'en')
const COPY_PROMPT = t('modelLaunch.copyPrompt', 'en')
// `faq` is optional on the template (Wan Animate 2 ships without one), but
// this page must have it, so fail loudly rather than silently testing nothing.
const FAQ_SECTION = seedancePage.faq
if (!FAQ_SECTION) throw new Error('seedancePage must configure a FAQ section')
const FAQS = FAQ_SECTION.items
const FAQ_COUNT = FAQS.length
const FIRST_FAQ = FAQS[0]
const REVIEWS_HEADING = t('seedance.reviews.heading', 'en')
const HIGHLIGHT_CTA = t('seedance.reviews.highlightCta', 'en')
const MCP_ROUTE = getRoutes('en').mcp
const FIRST_REVIEW = creatorReviews[0]

test.describe('Seedance 2.5 page — desktop @smoke', () => {
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

test.describe('Seedance 2.5 page — link targets', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('breadcrumb trail links to the models catalog', async ({ page }) => {
    const modelsCrumb = page
      .getByRole('navigation', { name: t('ui.breadcrumb', 'en') })
      .getByRole('link', { name: t('models.breadcrumb.models', 'en') })
    await expect(modelsCrumb).toHaveAttribute('href', MODELS_ROUTE)
  })

  // Every "run Seedance" CTA opens the same Cloud workflow, and the free-draft
  // CTA beside it opens Wan 2.2 instead. Asserting both together is what stops
  // one of them silently drifting back to the generic hub.
  test('steps CTAs open the Seedance run and the free Wan 2.2 draft', async ({
    page
  }) => {
    const stepsSection = page.locator('section').filter({
      has: page.getByRole('heading', { level: 2, name: STEPS_HEADING })
    })

    const secondary = stepsSection.getByRole('link', { name: STEPS_SECONDARY })
    await secondary.scrollIntoViewIfNeeded()
    await expect(secondary).toBeVisible()
    await expect(secondary).toHaveAttribute('href', SEEDANCE_RUN)
    await expect(secondary).toHaveAttribute('target', '_blank')

    const primary = stepsSection.getByRole('link', { name: STEPS_PRIMARY })
    await expect(primary).toHaveAttribute(
      'href',
      seedancePage.steps?.primaryCta?.href ?? ''
    )
    await expect(primary).toHaveAttribute('href', /video_wan2_2/)
  })

  test('the hero CTAs open Cloud to run and the hub to browse', async ({
    page
  }) => {
    const hero = page.locator('section').filter({
      has: page.getByRole('heading', { level: 1, name: HERO_TITLE })
    })
    await expect(
      hero.getByRole('link', { name: t('seedance.hero.primaryCta', 'en') })
    ).toHaveAttribute('href', SEEDANCE_RUN)

    await expect(
      hero.getByRole('link', { name: t('seedance.hero.secondaryCta', 'en') })
    ).toHaveAttribute('href', SEEDANCE_HUB_PAGE)
    await expect(
      hero.getByRole('link', { name: t('seedance.hero.secondaryCta', 'en') })
    ).toHaveAttribute('href', /\/workflows\/model\/seedance\/$/)
  })

  test('renders one step card per configured step', async ({ page }) => {
    const heading = page.getByRole('heading', { level: 2, name: STEPS_HEADING })
    await heading.scrollIntoViewIfNeeded()
    const steps = page
      .locator('section')
      .filter({ has: heading })
      .locator('ol > li')
    await expect(steps).toHaveCount(seedancePage.steps?.items.length ?? 0)
  })

  test('hero prompt bar links into a workflow', async ({ page }) => {
    const promptBar = page.getByRole('link', { name: new RegExp(PROMPT_CTA) })
    await expect(promptBar).toHaveAttribute(
      'href',
      seedancePage.hero.promptBar?.cta.href ?? ''
    )
  })

  test('cards with a prompt offer a copy button', async ({ page }) => {
    const gallery = seedancePage.gallery
    if (!gallery) throw new Error('seedancePage must configure a gallery')
    const withPrompt = gallery.cards.filter((card) => card.prompt)
    const buttons = page.getByRole('button', { name: COPY_PROMPT })
    await buttons.first().scrollIntoViewIfNeeded()
    await expect(buttons).toHaveCount(withPrompt.length)
  })

  // Seedance 2.5 does not render 4K, and a prompt is copyable text that would
  // re-publish the claim the rest of this page had it removed for. Scoped to the
  // prompt boxes rather than every paragraph, so a card description can neither
  // satisfy nor trip this.
  test('no rendered gallery prompt advertises 4K', async ({ page }) => {
    const gallery = page.locator('section').filter({
      has: page.getByRole('heading', { level: 2, name: MODELS_HEADING })
    })
    await gallery.scrollIntoViewIfNeeded()

    // All six cards carry a prompt.
    const EXPECTED_PROMPTS = 6

    const prompts = gallery.getByTestId('gallery-card-prompt')
    await expect(prompts).toHaveCount(EXPECTED_PROMPTS)

    for (const text of await prompts.allInnerTexts()) {
      expect(text).not.toMatch(/\b4k\b/i)
    }
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

test.describe('Seedance 2.5 page — interactions', () => {
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

  test('FAQ items toggle open and closed on click', async ({ page }) => {
    const firstQuestion = page.getByRole('button', {
      name: FIRST_FAQ.question.en
    })
    await waitForIsland(page, firstQuestion)
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'false')

    await firstQuestion.click()
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByText(FIRST_FAQ.answer.en)).toBeVisible()

    await firstQuestion.click()
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'false')
  })

  test('reviews carousel advances when Next is clicked', async ({ page }) => {
    const reviewsSection = page.locator('section').filter({
      has: page.getByRole('heading', { level: 2, name: REVIEWS_HEADING })
    })
    const track = reviewsSection.getByRole('article').first().locator('..')
    const nextButton = reviewsSection.getByRole('button', { name: 'Next' })
    await waitForIsland(page, nextButton)

    const startScroll = await track.evaluate((el) => el.scrollLeft)
    await nextButton.click()
    await expect
      .poll(() => track.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(startScroll)
  })
})

test.describe('Seedance 2.5 page — mobile @mobile', () => {
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
