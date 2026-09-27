import { expect } from '@playwright/test'

import { getRoutes } from '../src/config/routes'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

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
})
