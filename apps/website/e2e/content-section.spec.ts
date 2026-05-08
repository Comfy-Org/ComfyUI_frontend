import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

// Regression for FE-604. Viewport matches the 14" M4 Pro logical resolution
// from the original bug report; /privacy-policy reliably reproduces it
// because of its many short trailing sections.
test.describe('ContentSection scroll-spy @smoke', () => {
  test.use({ viewport: { width: 2016, height: 1310 } })

  test('activates the last badge when scrolled to the bottom', async ({
    page
  }) => {
    await page.goto('/privacy-policy')

    const sidebarNav = page.getByRole('navigation', { name: 'Category filter' })
    const badges = sidebarNav.getByRole('button')
    const lastBadge = badges.last()

    await expect(badges.first()).toHaveAttribute('aria-pressed', 'true')
    await expect(lastBadge).toHaveAttribute('aria-pressed', 'false')

    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight)
    })

    await expect(lastBadge).toHaveAttribute('aria-pressed', 'true')
  })

  // Hash makes the page mount already at the bottom; covers the onMounted()
  // path that runs before any scroll event fires.
  test('activates the last badge on initial render at the bottom', async ({
    page
  }) => {
    await page.goto('/privacy-policy#contact')

    const sidebarNav = page.getByRole('navigation', { name: 'Category filter' })
    const lastBadge = sidebarNav.getByRole('button').last()

    await expect(lastBadge).toHaveAttribute('aria-pressed', 'true')
  })
})
