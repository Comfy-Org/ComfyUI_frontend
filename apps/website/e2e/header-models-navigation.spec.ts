import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { waitForIsland } from './fixtures/islands'
import { test } from './fixtures/modelsAccount'

const viewports = [
  { name: 'mobile', width: 390, desktopNavigation: false },
  { name: '1024px desktop', width: 1024, desktopNavigation: false },
  { name: 'wide desktop', width: 1440, desktopNavigation: true }
] as const

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }))
  expect(
    dimensions.scrollWidth,
    `page width at ${dimensions.clientWidth}px`
  ).toBeLessThanOrEqual(dimensions.clientWidth)
}

for (const viewport of viewports) {
  test(`simplified navigation fits at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: 900 })
    await page.goto('/')

    const navigation = page.getByRole('navigation', {
      name: 'Main navigation'
    })
    const desktopLinks = navigation.getByTestId('desktop-nav-links')
    const menuButton = navigation.getByRole('button', { name: 'Toggle menu' })

    if (viewport.desktopNavigation) {
      await expect(desktopLinks).toBeVisible()
      const hub = desktopLinks.getByRole('button', { name: /^Hub/ })
      await waitForIsland(page, hub)
      await hub.hover()
      await expect(
        navigation
          .getByTestId('nav-dropdown')
          .getByRole('link', { name: /^Explore the Hub/ })
      ).toHaveAttribute('href', '/hub/')
      await expect(
        desktopLinks.getByRole('button', { name: 'Products', exact: true })
      ).toBeVisible()
      await expect(
        desktopLinks.getByRole('button', { name: 'Enterprise', exact: true })
      ).toBeVisible()
      await expect(menuButton).toBeHidden()
    } else {
      await expect(desktopLinks).toBeHidden()
      await expect(menuButton).toBeVisible()
      await waitForIsland(page, menuButton)
      await menuButton.click()
      const menu = page.getByRole('dialog', { name: 'Menu' })
      await expect(menu).toBeVisible()
      await expect(
        menu.getByRole('button', { name: /^Products\b/ })
      ).toBeVisible()
      await expect(
        menu.getByRole('button', { name: /^Enterprise\b/ })
      ).toBeVisible()
      await menu.getByRole('button', { name: /^Hub/ }).click()
      await expect(
        menu.getByRole('link', { name: /^Explore the Hub/ })
      ).toHaveAttribute('href', '/hub/')
    }

    await expect(
      navigation.getByRole('button', { name: /^Models\b/ })
    ).toHaveCount(0)
    await expectNoHorizontalOverflow(page)
  })
}
