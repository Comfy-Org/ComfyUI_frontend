import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import { externalLinks } from '../src/config/routes'
import { educationFaqs } from '../src/data/educationFaq'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const PATH = '/education'
const LEARNING_PATH = '/learning'
const PRICING_PATH = '/cloud/pricing'
const STUDENT_AMBASSADOR_FORM = externalLinks.studentAmbassadorForm

const MONTHLY_LABEL = t('pricing.period.monthly.edu', 'en')
const EDU_YEARLY_TOGGLE = t('pricing.period.yearly.edu', 'en')
const eduTeamSaving = (pct: number, amount: string) =>
  t('pricing.team.educationalSaving', 'en')
    .replace('{pct}', String(pct))
    .replace('{amount}', amount)

const pricingSection = (page: Page) =>
  page.locator('section').filter({
    has: page.getByRole('heading', { name: /Choose a plan/i })
  })

// The pricing section is an Astro `client:visible` island, so the billing
// toggle only becomes interactive once it hydrates — a click can otherwise
// land before the handler is attached. Retry the click (only while the target
// state is absent, so a re-click can't deselect) until a sentinel price shows.
const switchToMonthly = async (page: Page, sentinel: Locator) => {
  const monthly = page.getByText(MONTHLY_LABEL, { exact: true })
  await expect(async () => {
    if (!(await sentinel.isVisible())) await monthly.click()
    await expect(sentinel).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 15_000 })
}
const FAQ_COUNT = educationFaqs.length
const FIRST_FAQ = educationFaqs[0]
const HERO_TITLE_TEXT = t('education.hero.title', 'en').replace(/\s+/g, ' ')
const HERO_BADGE_TEXT = t('education.hero.badge', 'en')
const FAQ_HEADING_TEXT = t('education.faq.heading', 'en')
const CTA_HEADING_TEXT = t('education.cta.heading', 'en')
const CTA_CHOOSE_PLAN_LABEL = t('education.cta.choosePlan', 'en')
const CTA_START_LEARNING_LABEL = t('education.cta.startLearning', 'en')
const CTA_TERMS_LABEL = t('education.cta.termsLabel', 'en')

test.describe('Education landing — desktop @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('renders the hero badge and headline', async ({ page }) => {
    await expect(page.getByText(HERO_BADGE_TEXT, { exact: true })).toBeVisible()
    await expect(
      page.getByRole('heading', { level: 1, name: HERO_TITLE_TEXT })
    ).toBeVisible()
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
    // The href is only useful if it resolves to a real target on the page.
    await expect(page.locator('#plans')).toBeAttached()

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

type JsonLdNode = Record<string, unknown>

// The page emits one connected @graph, so every node (FAQPage, Product,
// breadcrumbs) is read from that single ld+json block.
const readJsonLdGraph = async (page: Page): Promise<JsonLdNode[]> => {
  const raw = await page.evaluate(() => {
    const scripts = Array.from(
      document.querySelectorAll<HTMLScriptElement>(
        'script[type="application/ld+json"]'
      )
    )
    const graph = scripts.find((s) =>
      (s.textContent ?? '').includes('"@graph"')
    )
    return graph?.textContent ?? null
  })
  expect(raw, 'JSON-LD @graph script').not.toBeNull()
  return (JSON.parse(raw!) as { '@graph': JsonLdNode[] })['@graph']
}

test.describe('Education landing — desktop interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('emits FAQPage structured data with one entry per FAQ', async ({
    page
  }) => {
    const graph = await readJsonLdGraph(page)
    const faqPage = graph.find((node) => node['@type'] === 'FAQPage')
    expect(faqPage, 'FAQPage node').toBeTruthy()
    expect(Array.isArray(faqPage!.mainEntity)).toBe(true)
    expect((faqPage!.mainEntity as unknown[]).length).toBe(FAQ_COUNT)
  })

  test('describes the discounted plans as a priced Product', async ({
    page
  }) => {
    const graph = await readJsonLdGraph(page)
    const product = graph.find((node) => node['@type'] === 'Product')
    const webPage = graph.find((node) => node['@type'] === 'WebPage')
    expect(product, 'Product node').toBeTruthy()
    expect(webPage?.mainEntity).toEqual({ '@id': product!['@id'] })

    const offers = product!.offers as JsonLdNode[]
    expect(offers.length).toBeGreaterThan(0)
    for (const offer of offers) {
      expect(offer.priceCurrency).toBe('USD')
      expect(Number(offer.price)).toBeGreaterThan(0)
    }

    const breadcrumb = graph.find((node) => node['@type'] === 'BreadcrumbList')
    const names = (breadcrumb!.itemListElement as JsonLdNode[]).map(
      (item) => item.name
    )
    expect(names).toEqual([
      t('breadcrumb.home', 'en'),
      t('nav.education', 'en')
    ])
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
    await expect(page.getByText(FIRST_FAQ.answer.en)).toBeVisible()

    await firstQuestion.click()
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'false')
  })
})

test.describe('Education pricing — desktop @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('shows yearly education prices with the monthly list price struck through', async ({
    page
  }) => {
    const section = pricingSection(page)
    await section.scrollIntoViewIfNeeded()

    // Default billing period is yearly: 25% off the monthly list price.
    await expect(section.getByText('$15', { exact: true })).toBeVisible()
    await expect(section.getByText('$26.25', { exact: true })).toBeVisible()
    await expect(section.getByText('$75', { exact: true })).toBeVisible()

    // The highlighted savings row tracks the yearly discount.
    await expect(
      section.getByText('Educational savings – 25% off').first()
    ).toBeVisible()

    for (const listPrice of ['$20', '$35', '$100']) {
      await expect(
        section.locator('span.line-through', {
          hasText: new RegExp(`^\\${listPrice}$`)
        })
      ).toBeVisible()
    }

    await expect(page.getByText(EDU_YEARLY_TOGGLE)).toBeVisible()
  })

  test('education prices flip with the billing toggle', async ({ page }) => {
    const section = pricingSection(page)
    await section.scrollIntoViewIfNeeded()

    // Flip to monthly: 10% off the monthly list price.
    await switchToMonthly(page, section.getByText('$18', { exact: true }))

    await expect(section.getByText('$31.50', { exact: true })).toBeVisible()
    await expect(section.getByText('$90', { exact: true })).toBeVisible()

    // The highlighted savings row now reflects the monthly discount.
    await expect(
      section.getByText('Educational savings – 10% off').first()
    ).toBeVisible()

    // Strikethrough remains the monthly list price in both cycles.
    for (const listPrice of ['$20', '$35', '$100']) {
      await expect(
        section.locator('span.line-through', {
          hasText: new RegExp(`^\\${listPrice}$`)
        })
      ).toBeVisible()
    }
  })
})

test.describe('Education pricing — team card @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('shows the team education price with basePrice struck and a saving label', async ({
    page
  }) => {
    const section = pricingSection(page)
    await section.scrollIntoViewIfNeeded()

    // Default: yearly, default tier (basePrice $700) → 15% off → $595.
    await expect(section.getByText('$595', { exact: true })).toBeVisible()
    await expect(
      section.locator('span.line-through', { hasText: /^\$700$/ })
    ).toBeVisible()
    await expect(section.getByText(eduTeamSaving(15, '$105'))).toBeVisible()
  })

  test('slider tier change updates the team education price and saving', async ({
    page
  }) => {
    const section = pricingSection(page)
    await section.scrollIntoViewIfNeeded()

    const slider = section.getByRole('slider')
    await slider.focus()
    await page.keyboard.press('ArrowRight')

    // Next tier (basePrice $1,400) yearly → 20% off → $1,120.
    await expect(section.getByText('$1,120', { exact: true })).toBeVisible()
    await expect(section.getByText(eduTeamSaving(20, '$280'))).toBeVisible()
  })

  test('billing toggle switches the team monthly/yearly education price', async ({
    page
  }) => {
    const section = pricingSection(page)
    await section.scrollIntoViewIfNeeded()

    // Monthly, default tier (basePrice $700) → 10% off → $630.
    await switchToMonthly(page, section.getByText('$630', { exact: true }))

    await expect(
      section.locator('span.line-through', { hasText: /^\$700$/ })
    ).toBeVisible()
    await expect(section.getByText(eduTeamSaving(10, '$70'))).toBeVisible()
  })
})

test.describe('Education pricing — Creative Campus band @smoke', () => {
  const CAMPUS_LABEL = t('pricing.creativeCampus.label', 'en')
  const CAMPUS_DESC = t('pricing.creativeCampus.description', 'en')
  const CONTACT_CTA = t('pricing.enterprise.cta', 'en')

  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('renders the Creative Campus label and description', async ({
    page
  }) => {
    const section = pricingSection(page)
    await section.scrollIntoViewIfNeeded()

    await expect(section.getByText(CAMPUS_LABEL, { exact: true })).toBeVisible()
    await expect(section.getByText(CAMPUS_DESC)).toBeVisible()
  })

  test('Contact Us CTA opens the Creative Campus application form', async ({
    page
  }) => {
    const section = pricingSection(page)
    await section.scrollIntoViewIfNeeded()

    const contact = section.getByRole('link', { name: CONTACT_CTA })
    await expect(contact).toBeVisible()
    await expect(contact).toHaveAttribute(
      'href',
      externalLinks.creativeCampusApplicationForm
    )
    await expect(contact).toHaveAttribute('target', '_blank')
  })
})

test.describe('Education pricing — Student Ambassador band @smoke', () => {
  const AMBASSADOR_LABEL = t('pricing.studentAmbassador.label', 'en')
  const AMBASSADOR_TAG = t('pricing.studentAmbassador.comingSoon', 'en')
  const AMBASSADOR_DESC = t('pricing.studentAmbassador.description', 'en')
  const AMBASSADOR_CTA = t('pricing.studentAmbassador.cta', 'en')

  test('renders the band with an active Register Interest CTA to the form', async ({
    page
  }) => {
    await page.goto(PATH)
    const section = pricingSection(page)
    await section.scrollIntoViewIfNeeded()

    await expect(
      section.getByText(AMBASSADOR_LABEL, { exact: true })
    ).toBeVisible()
    await expect(
      section.getByText(AMBASSADOR_TAG, { exact: true })
    ).toBeVisible()
    await expect(section.getByText(AMBASSADOR_DESC)).toBeVisible()

    const register = section.getByRole('link', { name: AMBASSADOR_CTA })
    await expect(register).toBeVisible()
    await expect(register).toHaveAttribute('href', STUDENT_AMBASSADOR_FORM)
    await expect(register).toHaveAttribute('target', '_blank')
  })
})

test.describe('Education landing — zh-CN @smoke', () => {
  test('CTA plan anchor resolves to the pricing section', async ({ page }) => {
    await page.goto('/zh-CN/education')

    const choosePlan = page.getByRole('link', {
      name: t('education.cta.choosePlan', 'zh-CN')
    })
    await expect(choosePlan).toHaveAttribute('href', '#plans')
    await expect(page.locator('#plans')).toBeAttached()
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
