import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { waitForIsland } from './fixtures/islands'
import { test } from './fixtures/modelsAccount'
import { stubWorkshopFlags } from './fixtures/workshopFlags'
import { t } from '@/i18n/translations'

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
      const hub = desktopLinks.getByRole('button', { name: 'Hub', exact: true })
      await hub.click()
      await expect(
        navigation
          .getByTestId('nav-dropdown')
          .getByRole('link', { name: 'All models' })
      ).toHaveAttribute('href', '/hub/models/')
      await hub.press('Escape')
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
      await menuButton.click()
      const menu = page.getByRole('dialog', { name: 'Menu' })
      await expect(menu).toBeVisible()
      await menu.getByRole('button', { name: /^Hub\b/ }).click()
      await expect(
        menu.getByRole('link', { name: 'All models' })
      ).toHaveAttribute('href', '/hub/models/')
      await menu.getByRole('button', { name: 'Back' }).click()
      await expect(
        menu.getByRole('button', { name: /^Products\b/ })
      ).toBeVisible()
      await expect(
        menu.getByRole('button', { name: /^Enterprise\b/ })
      ).toBeVisible()
    }

    await expect(
      navigation.getByRole('button', { name: /^Models\b/ })
    ).toHaveCount(0)
    await expectNoHorizontalOverflow(page)
  })
}

for (const { locale, path } of [
  { locale: 'en', path: '/' },
  { locale: 'zh-CN', path: '/zh-CN/' }
] as const) {
  for (const width of [1280, 1440]) {
    test(`open Hub menu with every column fits at ${width}px in ${locale}`, async ({
      context,
      page
    }) => {
      await stubWorkshopFlags(context, {
        'workshop-enabled': true,
        'workshop-workflows-enabled': true,
        'workshop-apps-enabled': true,
        'workshop-reshoot-app-enabled': true
      })
      await page.setViewportSize({ width, height: 900 })
      await page.goto(path)

      const desktopLinks = page
        .getByRole('navigation', { name: 'Main navigation' })
        .getByTestId('desktop-nav-links')
      await waitForIsland(page, desktopLinks)
      await desktopLinks
        .getByRole('button', { name: 'Hub', exact: true })
        .click()
      const hubMenu = page.getByTestId('nav-dropdown')
      for (const column of [
        'nav.hubModels',
        'nav.hubWorkflows',
        'nav.hubApps'
      ] as const)
        await expect(
          hubMenu.getByRole('list', { name: t(column, {}, { locale }) })
        ).toBeVisible()
      await expect(
        hubMenu.getByRole('link', { name: t('nav.reshoot', {}, { locale }) })
      ).toBeVisible()

      await expectNoHorizontalOverflow(page)
    })
  }
}
