import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

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
  test(`enabled Models navigation fits at ${viewport.name}`, async ({
    page
  }) => {
    await page.setViewportSize({ width: viewport.width, height: 900 })
    await page.goto('/')

    const navigation = page.getByRole('navigation', {
      name: 'Main navigation'
    })
    const desktopLinks = navigation.getByTestId('desktop-nav-links')
    const menuButton = navigation.getByRole('button', { name: 'Toggle menu' })

    if (viewport.desktopNavigation) {
      await expect(desktopLinks).toBeVisible()
      await expect(
        desktopLinks.getByRole('link', { name: 'Models', exact: true })
      ).toHaveAttribute('href', '/models')
      await expect(menuButton).toBeHidden()
    } else {
      await expect(desktopLinks).toBeHidden()
      await expect(menuButton).toBeVisible()
      await menuButton.click()
      const menu = page.getByRole('dialog', { name: 'Menu' })
      await expect(menu).toBeVisible()
      await expect(
        menu.getByRole('link', { name: /^Models\b/ })
      ).toHaveAttribute('href', '/models')
    }

    await expectNoHorizontalOverflow(page)
  })
}
