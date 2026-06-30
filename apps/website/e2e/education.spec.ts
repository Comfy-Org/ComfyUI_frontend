import { expect } from '@playwright/test'

import { educationFaqs } from '../src/data/educationFaq'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const PATH = '/edu'
const LEARNING_PATH = '/learning'
const PRICING_PATH = '/cloud/pricing'
const FAQ_COUNT = educationFaqs.length
const FIRST_FAQ = educationFaqs[0]
const FAQ_HEADING_TEXT = t('education.faq.heading', 'en')
const CTA_HEADING_TEXT = t('education.cta.heading', 'en')
const CTA_CHOOSE_PLAN_LABEL = t('education.cta.choosePlan', 'en')
const CTA_START_LEARNING_LABEL = t('education.cta.startLearning', 'en')
const CTA_TERMS_LABEL = t('education.cta.termsLabel', 'en')

test.describe('Education landing — desktop @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('renders the Q&A heading and is indexable', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 2, name: FAQ_HEADING_TEXT })
    ).toBeVisible()

    await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
  })

  test('renders the closing CTA heading and both buttons', async ({ page }) => {
    const ctaSection = page.locator('section').filter({
      has: page.getByRole('heading', { level: 2, name: CTA_HEADING_TEXT })
    })
    const ctaHeading = ctaSection.getByRole('heading', {
      level: 2,
      name: CTA_HEADING_TEXT
    })
    await ctaHeading.scrollIntoViewIfNeeded()
    await expect(ctaHeading).toBeVisible()

    const choosePlan = ctaSection.getByRole('link', {
      name: CTA_CHOOSE_PLAN_LABEL
    })
    await expect(choosePlan).toBeVisible()
    await expect(choosePlan).toHaveAttribute('href', '#plans')

    const startLearning = ctaSection.getByRole('link', {
      name: CTA_START_LEARNING_LABEL
    })
    await expect(startLearning).toBeVisible()
    await expect(startLearning).toHaveAttribute('href', LEARNING_PATH)
    await expect(startLearning).not.toHaveAttribute('target', '_blank')
  })

  test('CTA section links to the pricing FAQs in the same tab', async ({
    page
  }) => {
    const termsLink = page.getByRole('link', { name: CTA_TERMS_LABEL })
    await termsLink.scrollIntoViewIfNeeded()
    await expect(termsLink).toBeVisible()
    await expect(termsLink).toHaveAttribute('href', PRICING_PATH)
    await expect(termsLink).not.toHaveAttribute('target', '_blank')
  })
})

test.describe('Education landing — desktop interactions', () => {
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

test.describe('Education landing — mobile @mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
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
