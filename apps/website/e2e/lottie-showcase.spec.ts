import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

const DESKTOP_VP = { width: 1280, height: 800 }
const MOBILE_VP = { width: 393, height: 851 }

async function scrollToShowcase(page: Page) {
  // The badge text "HOW" uniquely identifies the ProductShowcase section
  const section = page.locator('section', {
    has: page.getByText('HOW', { exact: true })
  })
  await section.scrollIntoViewIfNeeded()
  return section
}

test.describe('ProductShowcase - accordion @interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('first accordion item is active by default', async ({ page }) => {
    await scrollToShowcase(page)
    const firstBtn = page
      .getByRole('button', { name: /Full Control with Nodes/i })
      .first()
    await expect(firstBtn).toHaveClass(/bg-primary-comfy-yellow/)
  })

  test('clicking second item activates it and deactivates first', async ({
    page
  }) => {
    await scrollToShowcase(page)
    const firstBtn = page
      .getByRole('button', { name: /Full Control with Nodes/i })
      .first()
    const secondBtn = page.getByRole('button', { name: /App mode/i }).first()

    await secondBtn.click()

    await expect(secondBtn).toHaveClass(/bg-primary-comfy-yellow/)
    await expect(firstBtn).not.toHaveClass(/bg-primary-comfy-yellow/)
  })

  test('clicking third item activates it', async ({ page }) => {
    await scrollToShowcase(page)
    const thirdBtn = page
      .getByRole('button', { name: /Community Workflows/i })
      .first()
    await thirdBtn.click()
    await expect(thirdBtn).toHaveClass(/bg-primary-comfy-yellow/)
  })

  test('active item description is expanded; inactive item description is collapsed', async ({
    page
  }) => {
    await scrollToShowcase(page)
    const secondBtn = page.getByRole('button', { name: /App mode/i }).first()
    await secondBtn.click()

    // Active button's description grid expands to grid-rows-[1fr]
    const activeGrid = secondBtn.locator('div[class*="grid-rows-\\[1fr\\]"]')
    await expect(activeGrid).toBeAttached()

    // First (inactive) button's description grid stays collapsed at grid-rows-[0fr]
    const firstBtn = page
      .getByRole('button', { name: /Full Control with Nodes/i })
      .first()
    const inactiveGrid = firstBtn.locator('div[class*="grid-rows-\\[0fr\\]"]')
    await expect(inactiveGrid).toBeAttached()
  })
})

test.describe('ProductShowcase - desktop Lottie layout @interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP_VP)
    await page.goto('/')
  })

  test('desktop Lottie column is present in DOM', async ({ page }) => {
    await scrollToShowcase(page)
    // The desktop column contains the border-spin container with aspect-ratio
    // class. We match by the unique combination of classes on the outer wrapper.
    const desktopCol = page
      .locator('div[class*="rounded-5xl"][class*="overflow-hidden"]')
      .first()
    await expect(desktopCol).toBeAttached()
  })

  test('all three scene wrappers are in DOM (v-show, not v-if)', async ({
    page
  }) => {
    const section = await scrollToShowcase(page)
    // Scope to the inner ink container of the desktop Lottie column
    const inkContainer = section
      .locator('div[class*="bg-primary-comfy-ink"]')
      .first()
    const wrappers = inkContainer.locator(
      'div[class*="absolute"][class*="inset-0"][class*="transition-opacity"]'
    )
    await expect(wrappers).toHaveCount(3)
  })

  test('only the active scene wrapper is opaque', async ({ page }) => {
    const section = await scrollToShowcase(page)
    const inkContainer = section
      .locator('div[class*="bg-primary-comfy-ink"]')
      .first()
    const wrappers = inkContainer.locator(
      'div[class*="absolute"][class*="inset-0"][class*="transition-opacity"]'
    )
    await expect(wrappers.nth(0)).toHaveClass(/opacity-100/)
    await expect(wrappers.nth(1)).toHaveClass(/opacity-0/)
    await expect(wrappers.nth(2)).toHaveClass(/opacity-0/)
  })

  test('clicking second accordion updates the active scene wrapper', async ({
    page
  }) => {
    const section = await scrollToShowcase(page)
    const secondBtn = page.getByRole('button', { name: /App mode/i }).first()
    await secondBtn.click()

    const inkContainer = section
      .locator('div[class*="bg-primary-comfy-ink"]')
      .first()
    const wrappers = inkContainer.locator(
      'div[class*="absolute"][class*="inset-0"][class*="transition-opacity"]'
    )
    await expect(wrappers.nth(0)).toHaveClass(/opacity-0/)
    await expect(wrappers.nth(1)).toHaveClass(/opacity-100/)
  })
})

test.describe('ProductShowcase - mobile Lottie layout @mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VP)
    await page.goto('/')
  })

  test('desktop Lottie column is absent from DOM on mobile', async ({
    page
  }) => {
    const section = await scrollToShowcase(page)
    // v-if="!isMobile" — the desktop ink container should not exist in the section
    const inkContainer = section.locator('div[class*="bg-primary-comfy-ink"]')
    await expect(inkContainer).toHaveCount(0)
  })

  test('only one mobile Lottie slot is mounted at a time', async ({ page }) => {
    await scrollToShowcase(page)
    // Mobile slots are aspect-video divs; with v-if only the active one exists
    const mobileSlots = page.locator('div[class*="aspect-video"]')
    await expect(mobileSlots).toHaveCount(1)
  })

  test('switching tab replaces the mobile Lottie slot', async ({ page }) => {
    await scrollToShowcase(page)
    const secondBtn = page.getByRole('button', { name: /App mode/i }).first()
    await secondBtn.click()
    // Still only one slot; the previous one was unmounted
    const mobileSlots = page.locator('div[class*="aspect-video"]')
    await expect(mobileSlots).toHaveCount(1)
  })
})

test.describe('ProductShowcase - poster overlay @interaction', () => {
  test('poster is visible while Lottie JSON is blocked', async ({ page }) => {
    // Block the animation JSON so assetsLoaded never flips to true
    await page.route('**/animations/scene*.json', (route) =>
      route.abort('blockedbyclient')
    )
    await page.goto('/')
    await scrollToShowcase(page)

    // Poster img should exist and not have opacity-0
    const poster = page.locator('img[src*="poster.webp"]').first()
    await expect(poster).toBeVisible()
    await expect(poster).not.toHaveClass(/opacity-0/)
  })

  test('poster has opacity-0 class after Lottie assets load', async ({
    page
  }) => {
    // Allow the JSON but stub assets via blockExternalMedia fixture
    await page.goto('/')
    await scrollToShowcase(page)

    const poster = page.locator('img[src*="poster.webp"]').first()
    // Wait for assetsLoaded to flip (stubbed assets resolve quickly)
    await expect(poster).toHaveClass(/opacity-0/, { timeout: 10_000 })
  })
})

test.describe('ProductShowcase - animate-border-spin visibility gate @interaction', () => {
  test('border container has no animate-border-spin before scrolling into view', async ({
    page
  }) => {
    await page.setViewportSize(DESKTOP_VP)
    await page.goto('/')
    // Section is below the fold; do not scroll
    const borderContainer = page
      .locator('div[class*="rounded-5xl"][class*="overflow-hidden"]')
      .first()
    await expect(borderContainer).not.toHaveClass(/animate-border-spin/)
  })

  test('border container gets animate-border-spin after scrolling into view', async ({
    page
  }) => {
    await page.setViewportSize(DESKTOP_VP)
    await page.goto('/')
    await scrollToShowcase(page)

    const borderContainer = page
      .locator('div[class*="rounded-5xl"][class*="overflow-hidden"]')
      .first()
    await expect(borderContainer).toHaveClass(/animate-border-spin/)
  })

  test('mobile border container also gated on isVisible', async ({ page }) => {
    await page.setViewportSize(MOBILE_VP)
    await page.goto('/')
    // Check before scroll: no animate-border-spin
    const borderContainer = page
      .locator('div[class*="rounded-4xl"][class*="overflow-hidden"]')
      .first()
    await expect(borderContainer).not.toHaveClass(/animate-border-spin/)

    await scrollToShowcase(page)
    await expect(borderContainer).toHaveClass(/animate-border-spin/)
  })
})

test.describe('ProductShowcase - no layout overflow @smoke', () => {
  for (const [name, vp] of [
    ['desktop', DESKTOP_VP],
    ['mobile', MOBILE_VP]
  ] as const) {
    test(`no horizontal overflow on ${name}`, async ({ page }) => {
      await page.setViewportSize(vp)
      await page.goto('/')
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
      )
      expect(overflow).toBe(false)
    })
  }
})
