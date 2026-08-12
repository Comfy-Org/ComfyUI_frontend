import { expect } from '@playwright/test'

import { getRoutes } from '../src/config/routes'
import { creatorReviews } from '../src/data/creatorReviews'
import { ltxPage } from '../src/data/ltx'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const PATH = '/ltx-2.5'
const ZH_PATH = '/zh-CN/ltx-2.5'
const HERO_TITLE = t('ltx.hero.title', 'en')
const MODELS_HEADING = t('ltx.models.heading', 'en')
const MODELS_ROUTE = getRoutes('en').models
const REVIEWS_HEADING = t('ltx.reviews.heading', 'en')
const HIGHLIGHT_CTA = t('ltx.reviews.highlightCta', 'en')
const MCP_ROUTE = getRoutes('en').mcp
const FIRST_REVIEW = creatorReviews[0]
const LTX_RUN_TEMPLATE = 'https://cloud.comfy.org/?template=video_ltx2_5_i2v'
const LTX_HUB_MODEL = 'https://comfy.org/workflows/model/ltx'

// Counts are fixed rather than read off the config: four labels and six cards are
// the launch requirement, and deriving them would let a dropped one pass.
const REQUIRED_BADGES = 4
const REQUIRED_CARDS = 6

const BADGE_KEYS = ltxPage.hero.badgeKeys ?? []

const GALLERY = ltxPage.gallery
if (!GALLERY) throw new Error('ltxPage must configure a gallery')

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

  test('renders all four hero badges', async ({ page }) => {
    expect(BADGE_KEYS).toHaveLength(REQUIRED_BADGES)

    const hero = page.locator('section').filter({
      has: page.getByRole('heading', { level: 1, name: HERO_TITLE })
    })

    for (const key of BADGE_KEYS) {
      await expect(hero.getByText(t(key, 'en'), { exact: true })).toBeVisible()
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

    const secondary = hero.getByRole('link', {
      name: t('ltx.hero.secondaryCta', 'en')
    })
    await expect(secondary).toHaveAttribute(
      'href',
      ltxPage.hero.secondaryCta?.href ?? ''
    )
    await expect(secondary).toHaveAttribute('href', LTX_HUB_MODEL)
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

test.describe('LTX 2.5 gallery', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
    await page
      .getByRole('heading', { level: 2, name: MODELS_HEADING })
      .scrollIntoViewIfNeeded()
  })

  test('ships all six cards, titled as the Figma titles them', async ({
    page
  }) => {
    // Scoped to the gallery: the testimonial carousel below also uses <article>.
    const gallery = page.locator('section').filter({
      has: page.getByRole('heading', { level: 2, name: MODELS_HEADING })
    })
    await expect(gallery.locator('article')).toHaveCount(REQUIRED_CARDS)

    for (const card of GALLERY.cards) {
      await expect(
        gallery.getByText(card.description.en, { exact: true })
      ).toBeVisible()
    }
  })

  test('every gallery clip carries a poster', async ({ page }) => {
    const gallery = page.locator('section').filter({
      has: page.getByRole('heading', { level: 2, name: MODELS_HEADING })
    })
    const videos = gallery.locator('video')
    await expect(videos).toHaveCount(REQUIRED_CARDS)

    for (const card of GALLERY.cards) {
      if (card.media.kind !== 'video') continue
      expect(card.media.posterSrc, `${card.id} needs a poster`).toBeTruthy()
      await expect(
        gallery.locator(`video[poster="${card.media.posterSrc}"]`)
      ).toHaveCount(1)
    }
  })
})

test.describe('LTX 2.5 page — zh-CN', () => {
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
      name: t('ltx.reviews.heading', 'zh-CN')
    })
    await reviews.scrollIntoViewIfNeeded()
    await expect(reviews).toBeVisible()
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

  test('hero CTA stays within the viewport width', async ({ page }) => {
    const cta = page
      .locator('section')
      .filter({
        has: page.getByRole('heading', { level: 1, name: HERO_TITLE })
      })
      .getByRole('link', { name: t('ltx.hero.primaryCta', 'en') })

    await expect(cta).toBeVisible()

    const box = await cta.boundingBox()
    const viewport = page.viewportSize()
    if (!box || !viewport) throw new Error('hero CTA has no layout box')

    // Both edges, so a CTA overflowing left cannot pass. One pixel of tolerance
    // for subpixel rounding. Vertical position is not asserted: the hero leads
    // with the video, so the CTA sits below the fold by design.
    expect(box.x).toBeGreaterThanOrEqual(-1)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
  })
})
