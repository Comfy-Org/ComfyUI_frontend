import { expect } from '@playwright/test'

import { externalLinks, getRoutes } from '../src/config/routes'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const PATH = '/flux-3'
const HERO_TITLE = t('flux3.hero.title', 'en')
const HERO_CTA = t('flux3.hero.primaryCta', 'en')
const RUN_OPTIONS_HEADING = t('flux3.runOptions.heading', 'en')
const MODELS_ROUTE = getRoutes('en').models

test.describe('Flux 3 announcement page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('renders the coming-soon hero and is indexable', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: HERO_TITLE })
    ).toBeVisible()
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
  })

  test('hero CTA sends visitors to the cloud in a new tab', async ({
    page
  }) => {
    const cta = page.getByRole('link', { name: HERO_CTA })
    await expect(cta).toHaveAttribute('href', externalLinks.cloud)
    await expect(cta).toHaveAttribute('target', '_blank')
  })

  test('breadcrumb trail links to the models catalog', async ({ page }) => {
    const modelsCrumb = page
      .getByRole('navigation', { name: 'Breadcrumb' })
      .getByRole('link', { name: t('models.breadcrumb.models', 'en') })
    await expect(modelsCrumb).toHaveAttribute('href', MODELS_ROUTE)
  })

  test('omits the sections the model cannot back yet', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 2, name: RUN_OPTIONS_HEADING })
    ).toBeVisible()

    // No gallery, pricing or FAQ until Flux 3 ships.
    await expect(page.getByText(t('pricing.title', 'en'))).toHaveCount(0)
    await expect(page.locator('[id^="faq-trigger-"]')).toHaveCount(0)
  })

  test('emits no FAQ structured data while the page has no FAQ', async ({
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
    expect(types).not.toContain('FAQPage')
  })
})
