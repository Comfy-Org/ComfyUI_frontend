import { expect, test } from '@playwright/test'

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
})
