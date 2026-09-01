import type { Page } from '@playwright/test'

import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'
import { VIEWPORTS } from './viewports'

test.describe.configure({ timeout: 60_000 })

const SMALL_VIEWPORTS = VIEWPORTS.filter(
  (v) => v.name === '1-sm' || v.name === '2-md'
)

async function assertNoOverflow(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth
        ),
      { message: 'page has horizontal overflow', timeout: 5_000 }
    )
    .toBe(false)
}

async function navigateAndSettle(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('load')
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
        has: page.getByRole('heading', { name: /Choose a plan/i })
      })
      await expect(section).toBeVisible()
      await section.scrollIntoViewIfNeeded()
      await expect(page).toHaveScreenshot(`pricing-tiers-${vp.name}.png`)
    })
  }
})

// Pricing renders a native <details> FAQ; Enterprise renders FAQSplit01, whose
// Reka accordion has no <details> at all. Each page names its own trigger and
// its own "this entry is open" marker.
const FAQ_PAGES = [
  {
    name: 'pricing',
    url: '/cloud/pricing',
    // PricingFaq.astro is plain markup — there is no island to wait for.
    island: false,
    trigger: 'details > summary',
    opened: 'details[open]'
  },
  {
    name: 'enterprise',
    url: '/enterprise',
    // FAQSplit01.vue, mounted client:visible.
    island: true,
    trigger: 'button[data-slot="accordion-trigger"]',
    opened: '[data-slot="accordion-item"][data-state="open"]'
  }
]

for (const { name, url, island, trigger, opened } of FAQ_PAGES) {
  test.describe(`${name} FAQ`, { tag: '@visual' }, () => {
    for (const vp of VIEWPORTS) {
      test(`${name}-faq-${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        await navigateAndSettle(page, url)

        const faq = page.locator('#faq')
        if (island) await waitForIsland(page, faq)
        else await faq.scrollIntoViewIfNeeded()

        const triggers = faq.locator(trigger)
        // Fail in seconds when the FAQ markup changes. Clicking a selector that
        // matches nothing instead burns the whole 60s test timeout, on every
        // retry and every viewport — enough to blow the job's time budget.
        await expect(triggers.nth(1)).toBeVisible()
        await triggers.nth(0).click()
        await triggers.nth(1).click()
        await expect(faq.locator(opened)).toHaveCount(2)

        await expect(faq).toHaveScreenshot(`${name}-faq-${vp.name}.png`)
      })
    }
  })
}

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

test.describe('Overflow guards', { tag: '@visual' }, () => {
  const pages = [
    '/',
    '/cloud',
    '/enterprise',
    '/enterprise/managed-builds',
    '/cloud/pricing',
    '/contact',
    '/download',
    '/gallery',
    '/about',
    '/careers'
  ]
  for (const url of pages) {
    for (const vp of VIEWPORTS) {
      test(`${url} ${vp.name} no overflow`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        await page.goto(url)
        await assertNoOverflow(page)
      })
    }
  }
})
