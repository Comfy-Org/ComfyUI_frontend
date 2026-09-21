import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { getRoutes } from '../src/config/routes'
import { creatorReviews } from '../src/data/creatorReviews'
import { geminiOmniPage } from '../src/data/geminiOmni'
import { t } from '../src/i18n/translations'
import type { ModelLaunchCta } from '../src/templates/model-launch/types'
import { test } from './fixtures/blockExternalMedia'

const PATH = '/gemini-omni'
const ZH_PATH = '/zh-CN/gemini-omni'
const HERO_TITLE = `${t('geminiOmni.hero.titleModel', 'en')}${t('geminiOmni.hero.titleRest', 'en')}`
const MODELS_HEADING = t('geminiOmni.models.heading', 'en')
const STEPS_HEADING = t('geminiOmni.steps.heading', 'en')
const STEPS_CTA = t('geminiOmni.steps.secondaryCta', 'en')
const REVIEWS_HEADING = t('geminiOmni.reviews.heading', 'en')
const HIGHLIGHT_CTA = t('geminiOmni.reviews.highlightCta', 'en')
const COPY_PROMPT = t('modelLaunch.copyPrompt', 'en')
const MODELS_ROUTE = getRoutes('en').models
const MCP_ROUTE = getRoutes('en').mcp
const FIRST_REVIEW = creatorReviews[0]

// The Figma's launch requirement, not a snapshot of the config: deriving these
// would let a dropped badge, card or step pass silently.
const REQUIRED_BADGES = 4
const REQUIRED_CARDS = 6
const REQUIRED_STEPS = 3

const RUN_TEMPLATE =
  'https://cloud.comfy.org/?template=api_google_gemini_omni_flash_1_1_t2v'
// Not /workflows/model/gemini-omni: the hub API returns `models: null` for
// every Gemini Omni entry, so that family page is never generated.
const HUB_OVERVIEW = 'https://comfy.org/workflows/a0e9a3b16f63-a0e9a3b16f63/'

const BADGE_KEYS = geminiOmniPage.hero.badgeKeys ?? []

const GALLERY = geminiOmniPage.gallery
if (!GALLERY) throw new Error('geminiOmniPage must configure a gallery')

const STEPS = geminiOmniPage.steps
if (!STEPS) throw new Error('geminiOmniPage must configure a steps section')

const HERO_PRIMARY_CTA: ModelLaunchCta | undefined =
  geminiOmniPage.hero.primaryCta
if (!HERO_PRIMARY_CTA)
  throw new Error('geminiOmniPage must configure a hero primary CTA')

const gallerySection = (page: Page) =>
  page.locator('section').filter({
    has: page.getByRole('heading', { level: 2, name: MODELS_HEADING })
  })

const heroSection = (page: Page) =>
  page.locator('section').filter({
    has: page.getByRole('heading', { level: 1, name: HERO_TITLE })
  })

test.describe('Gemini Omni page — desktop @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('renders the hero heading and is indexable', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: HERO_TITLE })
    ).toBeVisible()

    await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
  })

  test('renders all four hero badges', async ({ page }) => {
    expect(BADGE_KEYS).toHaveLength(REQUIRED_BADGES)

    for (const key of BADGE_KEYS) {
      await expect(
        heroSection(page).getByText(t(key, 'en'), { exact: true })
      ).toBeVisible()
    }
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

test.describe('Gemini Omni page — link targets', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('breadcrumb trail links to the models catalog', async ({ page }) => {
    const modelsCrumb = page
      .getByRole('navigation', { name: t('ui.breadcrumb', 'en') })
      .getByRole('link', { name: t('models.breadcrumb.models', 'en') })
    await expect(modelsCrumb).toHaveAttribute('href', MODELS_ROUTE)
  })

  test('hero CTAs open the run template and the hub workflow', async ({
    page
  }) => {
    const hero = heroSection(page)

    const runCta = hero.getByRole('link', {
      name: t('geminiOmni.hero.primaryCta', 'en')
    })
    await expect(runCta).toHaveAttribute('href', HERO_PRIMARY_CTA.href)
    await expect(runCta).toHaveAttribute('href', RUN_TEMPLATE)
    await expect(runCta).toHaveAttribute('target', '_blank')

    const secondary = hero.getByRole('link', {
      name: t('geminiOmni.hero.secondaryCta', 'en')
    })
    await expect(secondary).toHaveAttribute(
      'href',
      geminiOmniPage.hero.secondaryCta?.href ?? ''
    )
    await expect(secondary).toHaveAttribute('href', HUB_OVERVIEW)
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

test.describe('Gemini Omni gallery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
    await page
      .getByRole('heading', { level: 2, name: MODELS_HEADING })
      .scrollIntoViewIfNeeded()
  })

  test('ships all six cards, described as the Figma describes them', async ({
    page
  }) => {
    // Scoped to the gallery: the testimonial carousel below also uses <article>.
    const gallery = gallerySection(page)
    await expect(gallery.locator('article')).toHaveCount(REQUIRED_CARDS)

    for (const card of GALLERY.cards) {
      await expect(
        gallery.getByText(card.description.en, { exact: true })
      ).toBeVisible()
    }
  })

  test('every gallery clip carries a poster', async ({ page }) => {
    const gallery = gallerySection(page)
    await expect(gallery.locator('video')).toHaveCount(REQUIRED_CARDS)

    for (const card of GALLERY.cards) {
      if (card.media.kind !== 'video') continue
      expect(card.media.posterSrc, `${card.id} needs a poster`).toBeTruthy()
      await expect(
        gallery.locator(`video[poster="${card.media.posterSrc}"]`)
      ).toHaveCount(1)
    }
  })

  // The Figma puts a prompt box under every card, which is what makes this page
  // useful: a reader copies the prompt and runs it. A card that loses its prompt
  // still renders, so nothing else would catch it.
  test('every card offers its prompt with a copy button', async ({ page }) => {
    const gallery = gallerySection(page)
    const prompts = gallery.getByTestId('gallery-card-prompt')
    await expect(prompts).toHaveCount(REQUIRED_CARDS)
    await expect(
      gallery.getByRole('button', { name: COPY_PROMPT })
    ).toHaveCount(REQUIRED_CARDS)

    for (const card of GALLERY.cards) {
      expect(card.prompt, `${card.id} needs a prompt`).toBeDefined()
    }
  })
})

test.describe('Gemini Omni — how to direct your shot', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
    await page
      .getByRole('heading', { level: 2, name: STEPS_HEADING })
      .scrollIntoViewIfNeeded()
  })

  test('renders three numbered steps', async ({ page }) => {
    const steps = page
      .locator('section')
      .filter({
        has: page.getByRole('heading', { level: 2, name: STEPS_HEADING })
      })
      .locator('ol > li')

    await expect(steps).toHaveCount(REQUIRED_STEPS)

    for (const step of STEPS.items) {
      await expect(page.getByText(step.title.en, { exact: true })).toBeVisible()
    }
  })

  // `description` is optional on a step and this page is the first to omit one.
  // The step-count and title assertions above pass whether the paragraph is
  // absent or rendered empty, so target the step itself: each step renders a
  // "Step 0N" label and a title, and a third paragraph only when it configures
  // a description.
  test('a step configuring no description renders no paragraph', async ({
    page
  }) => {
    const without = STEPS.items.filter((step) => !step.description)
    const withDescription = STEPS.items.filter((step) => step.description)
    expect(
      without.length,
      'vacuous unless at least one step omits its description'
    ).toBeGreaterThan(0)

    const stepsList = page
      .locator('section')
      .filter({
        has: page.getByRole('heading', { level: 2, name: STEPS_HEADING })
      })
      .locator('ol > li')

    for (const step of without) {
      await expect(
        stepsList.filter({ hasText: step.title.en }).locator('p')
      ).toHaveCount(2)
    }
    for (const step of withDescription) {
      await expect(
        stepsList.filter({ hasText: step.title.en }).locator('p')
      ).toHaveCount(3)
    }
  })

  test('footer links back to this page in both locales', async ({ page }) => {
    const footerLink = page
      .locator('footer')
      .getByRole('link', { name: t('footer.geminiOmni', 'en') })
    await expect(footerLink).toHaveAttribute('href', getRoutes('en').geminiOmni)

    await page.goto(ZH_PATH)
    const zhFooterLink = page
      .locator('footer')
      .getByRole('link', { name: t('footer.geminiOmni', 'zh-CN') })
    await expect(zhFooterLink).toHaveAttribute(
      'href',
      getRoutes('zh-CN').geminiOmni
    )
  })

  test('the single steps CTA opens the run template', async ({ page }) => {
    const cta = page
      .locator('section')
      .filter({
        has: page.getByRole('heading', { level: 2, name: STEPS_HEADING })
      })
      .getByRole('link', { name: STEPS_CTA })

    await expect(cta).toHaveAttribute('href', RUN_TEMPLATE)
    await expect(cta).toHaveAttribute('target', '_blank')
  })
})

test.describe('Gemini Omni — Q&A', () => {
  // Asserts the render agrees with the config rather than pinning either state,
  // so this keeps working when Rob's Q&A copy lands and `faq` is filled in.
  // Until then the page deliberately ships no Q&A: the Figma's block is still
  // Seedance 2.0 placeholder text, and rendering it would publish those answers
  // to search engines as FAQPage structured data.
  test('FAQ structured data matches the page config', async ({ page }) => {
    await page.goto(PATH)

    const faqJsonLd = await page.evaluate(() => {
      const scripts = Array.from(
        document.querySelectorAll<HTMLScriptElement>(
          'script[type="application/ld+json"]'
        )
      )
      return (
        scripts.find((s) => (s.textContent ?? '').includes('FAQPage'))
          ?.textContent ?? null
      )
    })

    const faq = geminiOmniPage.faq
    if (!faq) {
      expect(faqJsonLd, 'no Q&A configured, so no FAQPage node').toBeNull()
      return
    }

    expect(faqJsonLd, 'FAQ JSON-LD script').not.toBeNull()
    const graph = JSON.parse(faqJsonLd!)['@graph'] as {
      '@type': string
      mainEntity?: unknown[]
    }[]
    const faqPage = graph.find((node) => node['@type'] === 'FAQPage')
    expect(faqPage, 'FAQPage node in @graph').toBeDefined()
    expect(faqPage!.mainEntity!.length).toBe(faq.items.length)
  })
})

test.describe('Gemini Omni page — zh-CN', () => {
  test('renders the localized hero and reviews', async ({ page }) => {
    await page.goto(ZH_PATH)

    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toBeVisible()
    // Chinese present and the English title absent, so serving the en copy under
    // the zh route fails here rather than passing on a key lookup.
    await expect(heading).toContainText(/[一-鿿]/)
    await expect(heading).not.toHaveText(HERO_TITLE)

    const reviews = page.getByRole('heading', {
      level: 2,
      name: t('geminiOmni.reviews.heading', 'zh-CN')
    })
    await reviews.scrollIntoViewIfNeeded()
    await expect(reviews).toBeVisible()
  })
})

test.describe('Gemini Omni page — mobile @mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('renders the hero heading at narrow viewports', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: HERO_TITLE })
    ).toBeVisible()
  })

  test('hero CTA stays within the viewport width', async ({ page }) => {
    const cta = heroSection(page).getByRole('link', {
      name: t('geminiOmni.hero.primaryCta', 'en')
    })

    await expect(cta).toBeVisible()

    const box = await cta.boundingBox()
    const viewport = page.viewportSize()
    if (!box || !viewport) throw new Error('hero CTA has no layout box')

    // Both edges, so a CTA overflowing left cannot pass. One pixel of tolerance
    // for subpixel rounding.
    expect(box.x).toBeGreaterThanOrEqual(-1)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
  })
})
