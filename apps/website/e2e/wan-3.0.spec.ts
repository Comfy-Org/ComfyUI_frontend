import { expect } from '@playwright/test'

import { externalLinks, getRoutes } from '../src/config/routes'
import { wan3Page } from '../src/data/wan3'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'

const PATH = '/wan-3.0'
const ZH_PATH = '/zh-CN/wan-3.0'
const HERO_TITLE = t('wan3.hero.title')
const HERO_CTA = t('wan3.hero.primaryCta')
const HERO_SECONDARY_CTA = t('wan3.hero.secondaryCta')
const FAQ_HEADING = t('wan3.faq.heading')
const RUN_OPTIONS_HEADING = t('wan3.runOptions.heading')
const REVIEWS_HEADING = t('wan3.reviews.heading')
const MODELS_ROUTE = getRoutes('en').models
const WAN3_TEMPLATE = 'https://cloud.comfy.org/?template=api_wan3_0_t2v'

// Counts are the launch requirement rather than a snapshot of the config:
// deriving them from `wan3Page` would let a dropped badge or Q&A entry pass,
// because both sides of the assertion would move together.
const REQUIRED_BADGES = 3
const REQUIRED_FAQS = 6
// The three modalities the launch ships with, in render order. Listing them
// exactly means a duplicate, dropped or off-brief badge (e.g. an open-weights
// claim) fails rather than slipping past a bare count.
const REQUIRED_BADGE_LABELS = [
  t('wan3.hero.tagImageToVideo'),
  t('wan3.hero.tagTextToVideo'),
  t('wan3.hero.tagReferenceToVideo')
]

const FAQ_SECTION = wan3Page.faq
if (!FAQ_SECTION) throw new Error('wan3Page must configure a FAQ section')
const FIRST_FAQ = FAQ_SECTION.items[0]

test.describe('Wan 3.0 launch page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('renders the hero and is indexable', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: HERO_TITLE })
    ).toBeVisible()
    await expect(page.getByText(t('wan3.hero.description'))).toBeVisible()
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
  })

  // Wan 3.0 runs through partner nodes against an API, so the page must not
  // claim open weights the way the open-source Wan pages do.
  test('hero badges describe the model without claiming open weights', async ({
    page
  }) => {
    const hero = page.locator('section').filter({
      has: page.getByRole('heading', { level: 1, name: HERO_TITLE })
    })
    const badges = hero.getByTestId('model-launch-hero-badge')
    await expect(badges).toHaveCount(REQUIRED_BADGES)
    await expect(badges).toHaveText(REQUIRED_BADGE_LABELS)
  })

  test('hero CTAs open the cloud and the workflow hub in new tabs', async ({
    page
  }) => {
    const hero = page.locator('section').filter({
      has: page.getByRole('heading', { level: 1, name: HERO_TITLE })
    })

    const primary = hero.getByRole('link', { name: HERO_CTA })
    await expect(primary).toHaveAttribute('href', WAN3_TEMPLATE)
    await expect(primary).toHaveAttribute('target', '_blank')

    const secondary = hero.getByRole('link', { name: HERO_SECONDARY_CTA })
    await expect(secondary).toHaveAttribute(
      'href',
      `${externalLinks.workflows}/model/wan`
    )
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

  test('emits FAQPage structured data with one entry per Q&A', async ({
    page
  }) => {
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
    expect(faqJsonLd, 'FAQ JSON-LD script').not.toBeNull()
    const graph = JSON.parse(faqJsonLd!)['@graph'] as {
      '@type': string
      mainEntity?: unknown[]
    }[]
    const faqPage = graph.find((node) => node['@type'] === 'FAQPage')
    expect(faqPage, 'FAQPage node in @graph').toBeDefined()
    expect(faqPage!.mainEntity!.length).toBe(REQUIRED_FAQS)
  })

  test('Q&A items toggle open and closed on click', async ({ page }) => {
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

  // Wan 3.0 maxes out at 1080p, so a 4K claim anywhere on the page would be
  // false. The Figma frame this page was built from still carried Seedance's
  // "up to 4K" copy, which is exactly how such a claim reaches production.
  test('no rendered copy advertises 4K', async ({ page }) => {
    const body = await page.locator('body').innerText()
    // Not preceded by a digit or dot, so the credit slider's "84.4K" ticks
    // (84,400 credits) cannot satisfy or trip this.
    expect(body).not.toMatch(/(?<![\d.])4k\b/i)
  })

  test('renders the Q&A, run options and reviews headings', async ({
    page
  }) => {
    for (const name of [FAQ_HEADING, RUN_OPTIONS_HEADING, REVIEWS_HEADING]) {
      const heading = page.getByRole('heading', { level: 2, name })
      await heading.scrollIntoViewIfNeeded()
      await expect(heading).toBeVisible()
    }
  })
})

test.describe('Wan 3.0 launch page — zh-CN', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(ZH_PATH)
  })

  test('renders the localized hero and Q&A', async ({ page }) => {
    const hero = page.locator('section').filter({
      has: page.getByRole('heading', {
        level: 1,
        name: t('wan3.hero.title', 'zh-CN')
      })
    })
    await expect(hero.getByRole('link').first()).toContainText(/[一-鿿]/)

    const faq = page.getByRole('heading', {
      level: 2,
      name: t('wan3.faq.heading', 'zh-CN')
    })
    await faq.scrollIntoViewIfNeeded()
    await expect(faq).toBeVisible()
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

test.describe('Wan 3.0 launch page — mobile @mobile', () => {
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
    await expect(cta).toHaveAttribute('href', WAN3_TEMPLATE)

    const box = await cta.boundingBox()
    const viewport = page.viewportSize()
    if (!box || !viewport) {
      throw new Error('hero CTA has no layout box to measure')
    }

    // Measured without scrolling first: the point is that the CTA is reachable
    // on load, so scrolling it into view would make the vertical bounds pass no
    // matter how far down the page it sat. One pixel of tolerance for subpixel
    // rounding.
    expect(box.x).toBeGreaterThanOrEqual(-1)
    expect(box.y).toBeGreaterThanOrEqual(-1)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1)
  })
})
