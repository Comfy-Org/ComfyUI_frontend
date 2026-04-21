import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'

import { VIEWPORTS } from './viewports'

test.describe.configure({ timeout: 60_000 })

const SMALL_VIEWPORTS = VIEWPORTS.filter(
  (v) => v.name === '1-sm' || v.name === '2-md'
)

async function assertNoOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth
  )
  expect(overflow, 'page has horizontal overflow').toBe(false)
}

async function blockVideoRequests(page: Page) {
  await page.route('**/*.{webm,mp4}', (route) => route.abort())
}

async function navigateAndSettle(page: Page, url: string) {
  await blockVideoRequests(page)
  await page.goto(url)
  await page.waitForLoadState('networkidle')
}

test.describe('Home', { tag: '@visual' }, () => {
  for (const vp of VIEWPORTS) {
    test.describe(vp.name, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        await navigateAndSettle(page, '/')
      })

      test('product-cards screenshot', async ({ page }) => {
        const section = page.locator('section', {
          has: page.getByRole('heading', { name: /The AI creation/i })
        })
        await expect(section).toBeVisible()
        await section.scrollIntoViewIfNeeded()
        await expect(page).toHaveScreenshot(`home-product-cards-${vp.name}.png`)
      })

      test('get-started screenshot', async ({ page }) => {
        const section = page.locator('section', {
          has: page.getByRole('heading', { name: /Get started/i })
        })
        await expect(section).toBeVisible()
        await section.scrollIntoViewIfNeeded()
        await expect(page).toHaveScreenshot(`home-get-started-${vp.name}.png`)
      })
    })
  }
})

test.describe('Pricing', { tag: '@visual' }, () => {
  for (const vp of VIEWPORTS) {
    test(`pricing-tiers-${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await navigateAndSettle(page, '/cloud/pricing')
      await assertNoOverflow(page)

      const section = page.locator('section', {
        has: page.getByRole('heading', { name: /Pricing/i })
      })
      await expect(section).toBeVisible()
      await section.scrollIntoViewIfNeeded()
      await expect(page).toHaveScreenshot(`pricing-tiers-${vp.name}.png`)
    })
  }
})

test.describe('Contact', { tag: '@visual' }, () => {
  for (const vp of SMALL_VIEWPORTS) {
    test(`form-${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await navigateAndSettle(page, '/contact')

      const section = page.locator('section', {
        has: page.getByRole('heading', { name: /Create powerful workflows/i })
      })
      await expect(section).toBeVisible()
      await section.scrollIntoViewIfNeeded()
      await expect(page).toHaveScreenshot(`contact-form-${vp.name}.png`)
    })
  }
})

test.describe('Gallery', { tag: '@visual' }, () => {
  for (const vp of SMALL_VIEWPORTS) {
    test(`gallery-grid-${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await navigateAndSettle(page, '/gallery')

      const section = page.getByTestId('gallery-grid')
      await expect(section).toBeVisible()
      await section.scrollIntoViewIfNeeded()
      await expect(page).toHaveScreenshot(`gallery-grid-${vp.name}.png`)
    })
  }
})

test.describe('About', { tag: '@visual' }, () => {
  for (const vp of SMALL_VIEWPORTS) {
    test(`hero-${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await navigateAndSettle(page, '/about')

      const hero = page.locator('section', {
        has: page.getByRole('heading', { name: /Build the tools/i })
      })
      await expect(hero).toBeVisible()
      await hero.scrollIntoViewIfNeeded()
      await expect(page).toHaveScreenshot(`about-hero-${vp.name}.png`)
    })
  }
})

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

      test(`${url} ${vp.name} no overflow`, async ({ page }) => {
        test.skip(OVERFLOW_SKIP.has(key), 'Known overflow bug at this viewport')
        await page.setViewportSize({ width: vp.width, height: vp.height })
        await page.goto(url)
        await assertNoOverflow(page)
      })
    }
  }
})
