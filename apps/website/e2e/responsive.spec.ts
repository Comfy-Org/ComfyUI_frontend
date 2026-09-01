import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('Desktop layout @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('navigation links visible and hamburger hidden', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    const desktopLinks = nav.getByTestId('desktop-nav-links')
    await expect(desktopLinks.getByText('PRODUCTS').first()).toBeVisible()
    await expect(desktopLinks.getByText('PRICING').first()).toBeVisible()

    await expect(page.getByRole('button', { name: 'Toggle menu' })).toBeHidden()
  })

  test('product cards in grid layout', async ({ page }) => {
    const section = page.locator('section', {
      has: page.getByRole('heading', { name: /The AI creation/ })
    })
    const cards = section.locator('a[href]')
    await expect(cards).toHaveCount(4)

    const firstBox = await cards.nth(0).boundingBox()
    const secondBox = await cards.nth(1).boundingBox()

    expect(firstBox, 'first card bounding box').not.toBeNull()
    expect(secondBox, 'second card bounding box').not.toBeNull()
    expect(firstBox!.y).toBeCloseTo(secondBox!.y, 0)
  })
})

test.describe('Mobile layout @mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('hamburger visible and desktop nav hidden', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'Toggle menu' })
    ).toBeVisible()
  })

  test('SocialProofBar shows two marquee rows on mobile', async ({ page }) => {
    const mobileContainer = page.getByTestId('social-proof-mobile')
    await expect(mobileContainer).toBeVisible()
  })

  test.describe('SocialProofBar seamless marquee', () => {
    test.use({ contextOptions: { reducedMotion: 'no-preference' } })

    test('mobile forward marquee loops seamlessly', async ({ page }) => {
      const geometry = await measureMarqueeLoopGeometry(
        page,
        '[data-testid="social-proof-mobile"] .animate-marquee'
      )
      expectSeamlessForwardLoop(geometry)
    })

    test('mobile reverse marquee loops seamlessly', async ({ page }) => {
      const geometry = await measureMarqueeLoopGeometry(
        page,
        '[data-testid="social-proof-mobile"] .animate-marquee-reverse'
      )
      expectSeamlessReverseLoop(geometry)
    })
  })
})

test.describe('Desktop SocialProofBar @smoke', () => {
  test.use({ contextOptions: { reducedMotion: 'no-preference' } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('desktop marquee loops seamlessly', async ({ page }) => {
    const geometry = await measureMarqueeLoopGeometry(
      page,
      '[data-testid="social-proof-desktop"] .animate-marquee'
    )
    expectSeamlessForwardLoop(geometry)
  })
})

type MarqueeGeometry = {
  copyWidths: number[]
  startPositions: number[]
  endPositions: number[]
}

async function measureMarqueeLoopGeometry(
  page: Page,
  selector: string
): Promise<MarqueeGeometry> {
  await page.locator(selector).first().waitFor()
  return page.evaluate((sel) => {
    const tracks = Array.from(
      document.querySelectorAll<HTMLElement>(sel)
    ).slice(0, 2)
    const firstAnimation = tracks[0]?.getAnimations()[0]
    if (!firstAnimation) {
      throw new Error(`No CSS animation found on ${sel}`)
    }
    const duration = firstAnimation.effect?.getTiming().duration
    if (typeof duration !== 'number' || duration <= 1) {
      throw new Error(
        `Animation on ${sel} has unusable duration: ${String(duration)}`
      )
    }
    const setAllTimes = (time: number) => {
      for (const track of tracks) {
        for (const anim of track.getAnimations()) {
          anim.currentTime = time
        }
      }
      void document.body.offsetWidth
    }
    const readX = () => tracks.map((track) => track.getBoundingClientRect().x)
    setAllTimes(0)
    const startPositions = readX()
    const copyWidths = tracks.map(
      (track) => track.getBoundingClientRect().width
    )
    setAllTimes(duration - 0.1)
    const endPositions = readX()
    return { copyWidths, startPositions, endPositions }
  }, selector)
}

function expectTwoMatchingCopies(geometry: MarqueeGeometry) {
  const { copyWidths } = geometry
  expect(copyWidths.length, 'expected two duplicate marquee tracks').toBe(2)
  expect(copyWidths[0]).toBeGreaterThan(0)
  expect(copyWidths[1]).toBeCloseTo(copyWidths[0], 0)
}

function expectSeamlessForwardLoop(geometry: MarqueeGeometry) {
  expectTwoMatchingCopies(geometry)
  // Copy 2 ends the cycle exactly where copy 1 started, so the restart
  // (when copy 1 jumps back to its start position) is visually indistinguishable.
  expect(geometry.endPositions[1]).toBeCloseTo(geometry.startPositions[0], 0)
}

function expectSeamlessReverseLoop(geometry: MarqueeGeometry) {
  expectTwoMatchingCopies(geometry)
  // Reverse marquee: copy 1 ends the cycle where copy 2 started.
  expect(geometry.endPositions[0]).toBeCloseTo(geometry.startPositions[1], 0)
}
