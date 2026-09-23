import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import { getRoutes } from '../src/config/routes'
import { minimaxLicensePage } from '../src/data/minimaxLicense'
import type { Locale } from '../src/i18n/translations'
import { t } from '../src/i18n/translations'
import { faqAnswerPlainText, parseFaqAnswer } from '../src/utils/faqAnswer'
import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'

const PATH = '/minimax/license'
const ZH_PATH = '/zh-CN/minimax/license'
const CONTACT_HREF = 'https://comfy.org/contact'
const META_TITLE = t('minimaxLicense.meta.title')
const HERO_TITLE = t('minimaxLicense.hero.title')
const HERO_CTA = t('minimaxLicense.hero.primaryCta')
const HERO_VIDEO_PATTERN = /minimax-license\/hero\.mp4/
const STEPS_HEADING = t('minimaxLicense.steps.heading')
const FAQ_HEADING = t('minimaxLicense.faq.heading')
const CLOSING_HEADING = t('minimaxLicense.cta.heading')
const HAN = /\p{Script=Han}/u

function faqAnswer(id: string, locale: Locale) {
  const item = minimaxLicensePage.faq?.items.find((entry) => entry.id === id)
  if (!item) throw new Error(`no FAQ item with id "${id}"`)
  const answer = item.answer[locale] || item.answer.en
  return {
    question: item.question[locale] || item.question.en,
    plainText: faqAnswerPlainText(answer),
    emphasised: parseFaqAnswer(answer)
      .filter((part) => part.type === 'strong')
      .map((part) => part.value)
  }
}

async function openFaq(page: Page, question: string): Promise<Locator> {
  const trigger = page.getByRole('button', { name: question })
  await waitForIsland(page, trigger)
  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  return page.getByRole('region', { name: question })
}

test.describe('MiniMax license page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('renders the launched hero over the video loop and is indexable', async ({
    page
  }) => {
    const hero = page.locator('section').filter({
      has: page.getByRole('heading', { level: 1, name: HERO_TITLE })
    })
    await expect(
      page.getByRole('heading', { level: 1, name: HERO_TITLE })
    ).toBeVisible()
    await expect(hero.locator('video')).toHaveAttribute(
      'src',
      HERO_VIDEO_PATTERN
    )
    await expect(page).toHaveTitle(META_TITLE)
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0)
  })

  test('hero CTA requests a license through the contact page', async ({
    page
  }) => {
    const cta = page
      .locator('section')
      .filter({
        has: page.getByRole('heading', { level: 1, name: HERO_TITLE })
      })
      .getByRole('link', { name: HERO_CTA })
    await expect(cta).toHaveAttribute('href', CONTACT_HREF)
  })

  test('renders steps, Q&A, and the closing CTA', async ({ page }) => {
    for (const name of [STEPS_HEADING, FAQ_HEADING, CLOSING_HEADING]) {
      const heading = page.getByRole('heading', { level: 2, name })
      await heading.scrollIntoViewIfNeeded()
      await expect(heading).toBeVisible()
    }

    const closing = page
      .locator('section')
      .filter({
        has: page.getByRole('heading', { level: 2, name: CLOSING_HEADING })
      })
      .getByRole('link', { name: t('minimaxLicense.cta.primaryCta') })
    await expect(closing).toHaveAttribute('href', CONTACT_HREF)
  })

  test('renders an emphasised Q&A phrase as bold, not as markup', async ({
    page
  }) => {
    const { question, plainText, emphasised } = faqAnswer(
      'pricing-parity',
      'en'
    )
    expect(emphasised).toHaveLength(1)

    const answer = await openFaq(page, question)

    await expect(answer.locator('strong')).toBeVisible()
    await expect(answer.locator('strong')).toHaveText(emphasised[0])
    await expect(answer).toHaveText(plainText)
  })

  test('links the licence route out of the Q&A answer', async ({ page }) => {
    const { question } = faqAnswer('who-needs-a-license', 'en')

    const answer = await openFaq(page, question)

    await expect(answer.getByRole('link')).toHaveAttribute(
      'href',
      'https://platform.minimax.io/h3-license'
    )
  })

  test('footer links back to this page', async ({ page }) => {
    const footerLink = page
      .locator('footer')
      .getByRole('link', { name: t('footer.minimaxLicense') })
    await expect(footerLink).toHaveAttribute(
      'href',
      getRoutes('en').minimaxLicense
    )
  })
})

test.describe('MiniMax license page — zh-CN', () => {
  test('renders the localized hero and steps', async ({ page }) => {
    await page.goto(ZH_PATH)

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: t('minimaxLicense.hero.title', 'zh-CN')
      })
    ).toBeVisible()

    const steps = page.getByRole('heading', {
      level: 2,
      name: t('minimaxLicense.steps.heading', 'zh-CN')
    })
    await steps.scrollIntoViewIfNeeded()
    await expect(steps).toBeVisible()
  })

  test('renders an emphasised Q&A phrase as bold, not as markup', async ({
    page
  }) => {
    await page.goto(ZH_PATH)
    const { question, plainText, emphasised } = faqAnswer(
      'pricing-parity',
      'zh-CN'
    )
    expect(emphasised).toHaveLength(1)
    // faqAnswer() falls back to English, which would otherwise make an English
    // string dropped into the zh-CN slot this test's own expectation.
    expect(question).toMatch(HAN)
    expect(plainText).toMatch(HAN)
    expect(emphasised[0]).toMatch(HAN)

    const answer = await openFaq(page, question)

    await expect(answer.locator('strong')).toBeVisible()
    await expect(answer.locator('strong')).toHaveText(emphasised[0])
    await expect(answer).toHaveText(plainText)
  })
})
