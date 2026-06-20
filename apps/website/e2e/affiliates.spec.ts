import { expect } from '@playwright/test'

import { affiliateFaqs } from '../src/data/affiliateFaq'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const PATH = '/affiliates'
const APPLY_URL = 'https://forms.gle/RS8L2ttcuGap4Q1v6'
const TERMS_PATH = '/affiliates/terms'
const FAQ_COUNT = affiliateFaqs.length
const FIRST_FAQ = affiliateFaqs[0]
const HERO_HEADING_TEXT = `${t('affiliate.hero.headingHighlight', 'en')} ${t('affiliate.hero.headingMuted', 'en')}`
const CTA_HEADING_TEXT = t('affiliate.cta.heading', 'en')
const CTA_APPLY_LABEL = t('affiliate.cta.apply', 'en')
const CTA_TERMS_LABEL = t('affiliate.cta.termsLabel', 'en')

test.describe('Affiliates landing — desktop @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('renders the hero heading and is indexable', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: HERO_HEADING_TEXT })
    ).toBeVisible()

    await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
  })

  test('renders the closing CTA heading and apply button', async ({ page }) => {
    const ctaSection = page.locator('section').filter({
      has: page.getByRole('heading', { level: 2, name: CTA_HEADING_TEXT })
    })
    const ctaHeading = ctaSection.getByRole('heading', {
      level: 2,
      name: CTA_HEADING_TEXT
    })
    await ctaHeading.scrollIntoViewIfNeeded()
    await expect(ctaHeading).toBeVisible()

    const applyButton = ctaSection.getByRole('link', { name: CTA_APPLY_LABEL })
    await expect(applyButton).toBeVisible()
    await expect(applyButton).toHaveAttribute('href', APPLY_URL)
    await expect(applyButton).toHaveAttribute('target', '_blank')
    await expect(applyButton).toHaveAttribute('rel', 'noopener noreferrer')
  })

  test('CTA section links to the affiliate terms page in the same tab', async ({
    page
  }) => {
    const termsLink = page.getByRole('link', { name: CTA_TERMS_LABEL })
    await termsLink.scrollIntoViewIfNeeded()
    await expect(termsLink).toBeVisible()
    await expect(termsLink).toHaveAttribute('href', TERMS_PATH)
    await expect(termsLink).not.toHaveAttribute('target', '_blank')
  })
})

test.describe('Affiliates landing — desktop interactions', () => {
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
    const parsed = JSON.parse(faqJsonLd!)
    expect(parsed['@type']).toBe('FAQPage')
    expect(Array.isArray(parsed.mainEntity)).toBe(true)
    expect(parsed.mainEntity.length).toBe(FAQ_COUNT)
  })

  test('Apply Now CTA opens the application form in a new tab', async ({
    page,
    context
  }) => {
    const ctaSection = page.locator('section').filter({
      has: page.getByRole('heading', { level: 2, name: CTA_HEADING_TEXT })
    })
    const applyButton = ctaSection.getByRole('link', { name: CTA_APPLY_LABEL })
    await applyButton.scrollIntoViewIfNeeded()

    const popupPromise = context.waitForEvent('page')
    await applyButton.click()
    const popup = await popupPromise
    await popup.waitForLoadState('domcontentloaded')
    const popupUrl = popup.url()
    expect(
      popupUrl.includes('forms.gle/RS8L2ttcuGap4Q1v6') ||
        popupUrl.includes('docs.google.com/forms')
    ).toBe(true)
    await popup.close()
  })

  test('FAQ items toggle open and closed on click', async ({ page }) => {
    const firstQuestion = page.getByRole('button', {
      name: FIRST_FAQ.question.en
    })
    await firstQuestion.scrollIntoViewIfNeeded()
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'false')

    await firstQuestion.click()
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByText(FIRST_FAQ.answer.en)).toBeVisible()

    await firstQuestion.click()
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'false')
  })
})

test.describe('Affiliates landing — mobile @mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('renders the hero heading at narrow viewports', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: HERO_HEADING_TEXT })
    ).toBeVisible()
  })

  test('closing CTA stays within the viewport width', async ({ page }) => {
    const ctaHeading = page.getByRole('heading', {
      level: 2,
      name: CTA_HEADING_TEXT
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
