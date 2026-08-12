import { expect } from '@playwright/test'

import { externalLinks, getRoutes } from '../src/config/routes'
import { flux3Page } from '../src/data/flux3'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const PATH = '/flux-3'
const HERO_TITLE = t('flux3.hero.title', 'en')
const HERO_CTA = t('flux3.hero.primaryCta', 'en')
const RUN_OPTIONS_HEADING = t('flux3.runOptions.heading', 'en')
const CTA_HEADING = t('flux3.cta.heading', 'en')
const FAQ_COUNT = flux3Page.faq?.items.length ?? 0
const CARD_COUNT = flux3Page.gallery?.cards.length ?? 0
const MODELS_ROUTE = getRoutes('en').models

test.describe('Flux 3 page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('renders the hero and is indexable', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: HERO_TITLE })
    ).toBeVisible()
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
  })

  test('hero CTA sends visitors to the cloud in a new tab', async ({
    page
  }) => {
    const heroSection = page.locator('section').filter({
      has: page.getByRole('heading', { level: 1, name: HERO_TITLE })
    })
    const cta = heroSection.getByRole('link', { name: HERO_CTA })
    await expect(cta).toHaveAttribute('href', externalLinks.cloud)
    await expect(cta).toHaveAttribute('target', '_blank')
  })

  test('breadcrumb trail links to the models catalog', async ({ page }) => {
    const modelsCrumb = page
      .getByRole('navigation', { name: 'Breadcrumb' })
      .getByRole('link', { name: t('models.breadcrumb.models', 'en') })
    await expect(modelsCrumb).toHaveAttribute('href', MODELS_ROUTE)
  })

  test('renders pricing and run options', async ({ page }) => {
    const runOptions = page.getByRole('heading', {
      level: 2,
      name: RUN_OPTIONS_HEADING
    })
    await runOptions.scrollIntoViewIfNeeded()
    await expect(runOptions).toBeVisible()

    await expect(
      page.getByRole('heading', { level: 2, name: t('pricing.title', 'en') })
    ).toBeVisible()
  })

  test('renders one gallery card per configured clip', async ({ page }) => {
    const heading = page.getByRole('heading', {
      level: 2,
      name: t('flux3.models.heading', 'en')
    })
    await heading.scrollIntoViewIfNeeded()
    await expect(heading).toBeVisible()

    const gallery = page.locator('section').filter({ has: heading })
    await expect(gallery.locator('video')).toHaveCount(CARD_COUNT)
  })

  test('renders one FAQ entry per configured question', async ({ page }) => {
    const triggers = page.locator('[id^="faq-trigger-"]')
    await triggers.first().scrollIntoViewIfNeeded()
    await expect(triggers).toHaveCount(FAQ_COUNT)
  })

  test('closing CTA keeps visitors on Flux 3', async ({ page }) => {
    const ctaSection = page.locator('section').filter({
      has: page.getByRole('heading', { level: 2, name: CTA_HEADING })
    })

    const primary = ctaSection.getByRole('link', {
      name: t('flux3.cta.primaryCta', 'en')
    })
    await primary.scrollIntoViewIfNeeded()
    await expect(primary).toHaveAttribute('href', externalLinks.cloud)

    const secondary = ctaSection.getByRole('link', {
      name: t('flux3.cta.secondaryCta', 'en')
    })
    await expect(secondary).toHaveAttribute('href', externalLinks.workflows)
  })

  test('emits FAQ structured data for the configured questions', async ({
    page
  }) => {
    const types = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll<HTMLScriptElement>(
          'script[type="application/ld+json"]'
        )
      ).flatMap((script) => {
        const parsed = JSON.parse(script.textContent ?? '{}') as {
          '@graph'?: { '@type': string }[]
        }
        return (parsed['@graph'] ?? []).map((node) => node['@type'])
      })
    )
    expect(types).toContain('WebPage')
    expect(types).toContain('FAQPage')
  })
})
