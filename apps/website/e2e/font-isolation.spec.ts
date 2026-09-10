import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'
import { textWidth, waitForAnimations } from './fixtures/textMetrics'

test('homepage animation preserves navigation and footer typography @interaction', async ({
  page
}) => {
  await page.goto('/')
  const products = page
    .getByRole('navigation', { name: 'Main navigation', exact: true })
    .getByRole('button', { name: 'Products NEW', exact: true })
  await waitForIsland(page, products)
  await products.press('Enter')
  const dropdownLink = page
    .getByTestId('nav-dropdown')
    .getByRole('link', { name: 'Comfy Desktop', exact: true })
  const menuViewport = page.locator('[data-slot="navigation-menu-viewport"]')
  const footerLink = page
    .getByRole('contentinfo')
    .getByRole('link', { name: 'Comfy Desktop', exact: true })
    .filter({ visible: true })
  await expect(dropdownLink).toBeVisible()
  await waitForAnimations(menuViewport)
  await page.evaluate(() => document.fonts.ready)
  const dropdownWidth = await textWidth(
    dropdownLink.getByText('Comfy Desktop', { exact: true })
  )
  const footerWidth = await textWidth(footerLink)
  await products.press('Escape')

  await page
    .getByRole('button', { name: /Full Control with Nodes/ })
    .scrollIntoViewIfNeeded()
  await expect(page.getByText('CANNY EDGE', { exact: true })).toBeAttached()
  await page.evaluate(() => document.fonts.ready)

  await footerLink.scrollIntoViewIfNeeded()
  expect(await textWidth(footerLink)).toBeCloseTo(footerWidth, 2)
  await products.scrollIntoViewIfNeeded()
  await products.press('Enter')
  await expect(dropdownLink).toBeVisible()
  await waitForAnimations(menuViewport)
  expect(
    await textWidth(dropdownLink.getByText('Comfy Desktop', { exact: true }))
  ).toBeCloseTo(dropdownWidth, 2)
})
