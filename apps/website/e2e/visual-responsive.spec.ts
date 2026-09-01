import type { Locator, Page } from '@playwright/test'

import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
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
    trigger: 'details > summary',
    opened: 'details[open]'
  },
  {
    name: 'enterprise',
    url: '/enterprise',
    trigger: 'button[data-slot="accordion-trigger"]',
    opened: '[data-slot="accordion-item"][data-state="open"]'
  }
]

async function openFirstTwoEntries(
  faq: Locator,
  { trigger, opened }: { trigger: string; opened: string }
) {
  const triggers = faq.locator(trigger)
  const openEntries = faq.locator(opened)

  // Fail in seconds when the FAQ markup changes. Clicking a selector that
  // matches nothing instead burns the whole 60s test timeout, on every retry,
  // for every viewport — enough on its own to blow the job's time budget.
  await expect(triggers.nth(1)).toBeVisible()

  // Enterprise hydrates its accordion as a client:visible island, so the first
  // click can land before the component is listening. Re-click until both
  // entries report themselves open.
  await expect
    .poll(
      async () => {
        const open = await openEntries.count()
        if (open < 2) await triggers.nth(open).click()
        return openEntries.count()
      },
      { message: 'FAQ entries did not open', timeout: 10_000 }
    )
    .toBe(2)
}

for (const { name, url, trigger, opened } of FAQ_PAGES) {
  test.describe(`${name} FAQ`, { tag: '@visual' }, () => {
    for (const vp of VIEWPORTS) {
      test(`${name}-faq-${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        await navigateAndSettle(page, url)

        const faq = page.locator('#faq')
        await faq.scrollIntoViewIfNeeded()
        await openFirstTwoEntries(faq, { trigger, opened })

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
