import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

const PATH = '/affiliates'
const APPLY_URL = 'https://forms.gle/RS8L2ttcuGap4Q1v6'

const SECTION_TESTIDS = [
  'affiliate-trust-band',
  'affiliate-how-it-works',
  'affiliate-audience',
  'affiliate-program-details',
  'affiliate-brand-assets',
  'affiliate-footer-cta'
] as const

test.describe('Affiliates landing — desktop @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('renders the hero heading and is marked noindex', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Become a Comfy Partner', level: 1 })
    ).toBeVisible()

    const robotsContent = await page
      .locator('meta[name="robots"]')
      .getAttribute('content')
    expect(robotsContent).toContain('noindex')
  })

  test('exposes every page section in order', async ({ page }) => {
    for (const id of SECTION_TESTIDS) {
      await expect(page.getByTestId(id)).toBeVisible()
    }
  })

  test('renders the program details table on desktop', async ({ page }) => {
    const table = page.getByTestId('affiliate-program-details-table')
    await expect(table).toBeVisible()
    const rows = table.getByRole('row')
    await expect(rows).toHaveCount(7)
  })

  test('emits FAQPage structured data', async ({ page }) => {
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
    const parsed = JSON.parse(faqJsonLd!)
    expect(parsed['@type']).toBe('FAQPage')
    expect(Array.isArray(parsed.mainEntity)).toBe(true)
    expect(parsed.mainEntity.length).toBe(8)
  })

  test('hero and footer CTAs target the application form in a new tab', async ({
    page
  }) => {
    const heroCta = page.getByTestId('affiliate-hero-cta')
    await expect(heroCta).toBeVisible()
    await expect(heroCta).toHaveAttribute('href', APPLY_URL)
    await expect(heroCta).toHaveAttribute('target', '_blank')
    await expect(heroCta).toHaveAttribute('rel', 'noopener noreferrer')

    const footerCta = page.getByTestId('affiliate-footer-cta-button')
    await expect(footerCta).toHaveAttribute('href', APPLY_URL)
    await expect(footerCta).toHaveAttribute('target', '_blank')
    await expect(footerCta).toHaveAttribute('rel', 'noopener noreferrer')
  })

  test('footer links to the affiliate terms page', async ({ page }) => {
    const link = page
      .getByTestId('affiliate-footer-cta')
      .getByRole('link', { name: /Read the affiliate program terms/i })
    await expect(link).toBeVisible()
    await expect(link).toBeEnabled()
    await expect(link).toHaveAttribute('href', '/affiliates/terms')
    await expect(link).not.toHaveAttribute('target', '_blank')
  })
})

test.describe('Affiliates landing — desktop interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('Apply Now CTA opens the application form in a new tab', async ({
    page,
    context
  }) => {
    const popupPromise = context.waitForEvent('page')
    await page.getByTestId('affiliate-hero-cta').click()
    const popup = await popupPromise
    const popupUrl = popup.url()
    expect(
      popupUrl.includes('forms.gle/RS8L2ttcuGap4Q1v6') ||
        popupUrl.includes('docs.google.com/forms')
    ).toBe(true)
    await popup.close()
  })

  test('FAQ items toggle open and closed on click', async ({ page }) => {
    const firstQuestion = page.getByRole('button', {
      name: 'How do I track my referrals?'
    })
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'false')

    await firstQuestion.click()
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'true')
    await expect(
      page.getByText('Real-time dashboard via our partner portal.')
    ).toBeVisible()

    await firstQuestion.click()
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'false')
  })
})

test.describe('Affiliates landing — mobile @mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('renders the hero heading and primary CTA at narrow viewports', async ({
    page
  }) => {
    await expect(
      page.getByRole('heading', { name: 'Become a Comfy Partner', level: 1 })
    ).toBeVisible()
    await expect(page.getByTestId('affiliate-hero-cta')).toBeVisible()
  })

  test('program details collapse to a stacked definition list', async ({
    page
  }) => {
    await expect(
      page.getByTestId('affiliate-program-details-table')
    ).toBeHidden()
    const detailsList = page
      .getByTestId('affiliate-program-details')
      .locator('dl')
    await expect(detailsList).toBeVisible()
    await expect(detailsList.getByText('Commission rate')).toBeVisible()
    await expect(detailsList.getByText('30% recurring')).toBeVisible()
  })

  test('all major sections remain visible without horizontal overflow', async ({
    page
  }) => {
    for (const id of SECTION_TESTIDS) {
      const section = page.getByTestId(id)
      await expect(section).toBeVisible()
      const box = await section.boundingBox()
      expect(box, `${id} bounding box`).not.toBeNull()
      expect(box!.x + box!.width).toBeLessThanOrEqual(
        page.viewportSize()!.width + 1
      )
    }
  })
})
