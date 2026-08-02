import { expect } from '@playwright/test'

import { minimaxH3Faqs, minimaxH3Workflows } from '../src/data/minimaxH3'
import type { Locale } from '../src/i18n/translations'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const PATH_EN = '/minimax-h3'
const PATH_ZH = '/zh-CN/minimax-h3'
const LAUNCH_WORKFLOW_COUNT = 3
const FAQ_COUNT = 6

const LOCALES: ReadonlyArray<readonly [string, Locale]> = [
  [PATH_EN, 'en'],
  [PATH_ZH, 'zh-CN']
]

function heroTitle(locale: Locale) {
  return `${t('minimaxH3.hero.titleLead', locale)} ${t('minimaxH3.hero.titleTrail', locale)}`
}

test.describe('MiniMax H3 page — desktop @smoke', () => {
  for (const [path, locale] of LOCALES) {
    test(`renders the configured title at ${path}`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveTitle(t('minimaxH3.meta.title', locale))
    })

    test(`renders the hero heading at ${path}`, async ({ page }) => {
      await page.goto(path)
      await expect(
        page.getByRole('heading', { level: 1, name: heroTitle(locale) })
      ).toBeVisible()
    })
  }

  // The OSS weights are not public yet, so the page must stay out of the index
  // until the launch PR flips `noindexUntilLaunch`.
  test('stays unlisted at both locales', async ({ page }) => {
    for (const [path] of LOCALES) {
      await page.goto(path)
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex, nofollow'
      )
    }
  })

  test('renders every launch workflow', async ({ page }) => {
    await page.goto(PATH_EN)
    const heading = page.getByRole('heading', {
      level: 2,
      name: t('minimaxH3.workflows.heading', 'en')
    })
    await heading.scrollIntoViewIfNeeded()
    await expect(heading).toBeVisible()

    // Rob committed to three launch workflows; pin the count so emptying the
    // data file fails here rather than silently shipping an empty section.
    const workflows = page
      .locator('section')
      .filter({ has: heading })
      .getByRole('listitem')
    await expect(workflows).toHaveCount(LAUNCH_WORKFLOW_COUNT)
    expect(minimaxH3Workflows).toHaveLength(LAUNCH_WORKFLOW_COUNT)

    for (const workflow of minimaxH3Workflows) {
      await expect(
        page.getByRole('heading', { level: 3, name: workflow.title.en })
      ).toBeVisible()
    }
  })

  test('renders the banner heading and both CTAs', async ({ page }) => {
    await page.goto(PATH_EN)
    const heading = page.getByRole('heading', {
      level: 2,
      name: t('minimaxH3.banner.heading', 'en')
    })
    await heading.scrollIntoViewIfNeeded()
    await expect(heading).toBeVisible()

    const banner = page
      .locator('section')
      .filter({ has: heading })
      .filter({ hasText: t('minimaxH3.banner.heading', 'en') })

    await expect(
      banner.getByRole('link', { name: t('minimaxH3.banner.primaryCta', 'en') })
    ).toBeVisible()
    await expect(
      banner.getByRole('link', {
        name: t('minimaxH3.banner.secondaryCta', 'en')
      })
    ).toBeVisible()
  })

  test('renders every FAQ question', async ({ page }) => {
    await page.goto(PATH_EN)
    const heading = page.getByRole('heading', {
      level: 2,
      name: t('minimaxH3.faq.heading', 'en')
    })
    await heading.scrollIntoViewIfNeeded()
    await expect(heading).toBeVisible()

    expect(minimaxH3Faqs).toHaveLength(FAQ_COUNT)

    for (const faq of minimaxH3Faqs) {
      await expect(
        page.getByRole('button', { name: faq.question.en })
      ).toBeVisible()
    }
  })
})

test.describe('MiniMax H3 page — mobile @mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('renders the hero heading and both hero CTAs', async ({ page }) => {
    await page.goto(PATH_EN)

    const heading = page.getByRole('heading', {
      level: 1,
      name: heroTitle('en')
    })
    await expect(heading).toBeVisible()

    // Scoped: the hero and banner CTAs share the "RUN MINIMAX H3" label.
    const hero = page.locator('section').filter({ has: heading })

    await expect(
      hero.getByRole('link', { name: t('minimaxH3.hero.primaryCta', 'en') })
    ).toBeVisible()
    await expect(
      hero.getByRole('link', { name: t('minimaxH3.hero.secondaryCta', 'en') })
    ).toBeVisible()
  })
})
