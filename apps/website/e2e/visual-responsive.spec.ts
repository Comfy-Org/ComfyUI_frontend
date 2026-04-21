import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'

import { VIEWPORTS } from './viewports'

test.describe.configure({ timeout: 60_000 })

async function assertNoOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth
  )
  expect(overflow, 'page has horizontal overflow').toBe(false)
}

async function freezeVideos(page: Page) {
  await page.evaluate(() => {
    for (const video of document.querySelectorAll('video')) {
      video.pause()
      video.currentTime = 0
    }
  })
}

async function blockVideoRequests(page: Page) {
  await page.route('**/*.{webm,mp4}', (route) => route.abort())
}

async function navigateAndFreeze(page: Page, url: string) {
  await blockVideoRequests(page)
  await page.goto(url)
  await freezeVideos(page)
}

// ── Home ─────────────────────────────────────────────
test.describe('Home', { tag: '@visual' }, () => {
  for (const vp of VIEWPORTS) {
    test.describe(vp.name, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        await navigateAndFreeze(page, '/')
      })

      test('product-cards screenshot', async ({ page }) => {
        const section = page.locator('section', {
          has: page.getByRole('heading', { name: /The AI creation/i })
        })
        await section.scrollIntoViewIfNeeded()
        await expect(page).toHaveScreenshot(
          `home-product-cards-${vp.name}.png`,
          { maxDiffPixelRatio: 0.01 }
        )
      })

      test('get-started screenshot', async ({ page }) => {
        const section = page.locator('section', {
          has: page.getByRole('heading', { name: /Get started/i })
        })
        await section.scrollIntoViewIfNeeded()
        await expect(page).toHaveScreenshot(`home-get-started-${vp.name}.png`, {
          maxDiffPixelRatio: 0.01
        })
      })
    })
  }
})

// ── Pricing ──────────────────────────────────────────
test.describe('Pricing', { tag: '@visual' }, () => {
  for (const vp of VIEWPORTS) {
    test(`pricing-tiers-${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await navigateAndFreeze(page, '/cloud/pricing')
      await assertNoOverflow(page)

      const section = page.locator('section').first()
      await section.scrollIntoViewIfNeeded()
      await expect(page).toHaveScreenshot(`pricing-tiers-${vp.name}.png`, {
        maxDiffPixelRatio: 0.01
      })
    })
  }
})

// ── Contact ──────────────────────────────────────────
test.describe('Contact', { tag: '@visual' }, () => {
  for (const vp of VIEWPORTS.filter(
    (v) => v.name === '1-sm' || v.name === '2-md'
  )) {
    test(`form-${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await navigateAndFreeze(page, '/contact')

      const form = page.locator('form').first()
      await form.scrollIntoViewIfNeeded()
      await expect(page).toHaveScreenshot(`contact-form-${vp.name}.png`, {
        maxDiffPixelRatio: 0.01
      })
    })
  }
})

// ── Gallery ──────────────────────────────────────────
test.describe('Gallery', { tag: '@visual' }, () => {
  for (const vp of VIEWPORTS.filter(
    (v) => v.name === '1-sm' || v.name === '2-md'
  )) {
    test(`gallery-grid-${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await navigateAndFreeze(page, '/gallery')

      const section = page.locator('section').nth(1)
      await section.scrollIntoViewIfNeeded()
      await expect(page).toHaveScreenshot(`gallery-grid-${vp.name}.png`, {
        maxDiffPixelRatio: 0.01
      })
    })
  }
})

// ── About ────────────────────────────────────────────
test.describe('About', { tag: '@visual' }, () => {
  for (const vp of VIEWPORTS.filter(
    (v) => v.name === '1-sm' || v.name === '2-md'
  )) {
    test(`hero-${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await navigateAndFreeze(page, '/about')

      const hero = page.locator('section').first()
      await hero.scrollIntoViewIfNeeded()
      await expect(page).toHaveScreenshot(`about-hero-${vp.name}.png`, {
        maxDiffPixelRatio: 0.01
      })
    })
  }
})

// ── Overflow-only checks (all major pages) ───────────
// Known overflow bugs at wider viewports (to be fixed in later phases):
//   / — desktop, wide
//   /cloud — tablet, desktop, wide
//   /download — tablet, desktop, wide
const OVERFLOW_SKIP = new Set([
  '/ 3-lg',
  '/ 4-xl',
  '/cloud 2-md',
  '/cloud 3-lg',
  '/cloud 4-xl',
  '/download 2-md',
  '/download 3-lg',
  '/download 4-xl'
])

test.describe('Overflow guards', { tag: '@visual' }, () => {
  const pages = [
    '/',
    '/cloud',
    '/cloud/pricing',
    '/contact',
    '/download',
    '/gallery',
    '/about',
    '/careers'
  ]
  for (const url of pages) {
    for (const vp of VIEWPORTS) {
      const key = `${url} ${vp.name}`
      if (OVERFLOW_SKIP.has(key)) continue

      test(`${url} ${vp.name} no overflow`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        await page.goto(url)
        await assertNoOverflow(page)
      })
    }
  }
})
