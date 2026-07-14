import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

const TOP_LEVEL_LABELS = [
  'Products',
  'Pricing',
  'Community',
  'Company'
] as const

test.describe('Desktop navigation @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('logo links to homepage', async ({ page }) => {
    const logo = page.getByRole('link', { name: 'Comfy home' })
    await expect(logo).toBeVisible()
    await expect(logo).toHaveAttribute('href', '/')
  })

  test('has all top-level nav items', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    const desktopLinks = nav.getByTestId('desktop-nav-links')

    for (const label of TOP_LEVEL_LABELS) {
      await expect(
        desktopLinks.getByText(label, { exact: true }).first()
      ).toBeVisible()
    }
  })

  test('NEW badge shows on Products and Community only', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    const desktopLinks = nav.getByTestId('desktop-nav-links')

    for (const label of ['Products', 'Community']) {
      await expect(
        desktopLinks
          .getByRole('button', { name: label })
          .getByText('NEW', { exact: true })
      ).toBeVisible()
    }

    await expect(
      desktopLinks.getByRole('button', { name: 'Company' }).getByText('NEW')
    ).toHaveCount(0)
    await expect(
      desktopLinks.getByRole('link', { name: 'Pricing' }).getByText('NEW')
    ).toHaveCount(0)
  })

  test('CTA buttons are visible', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    const desktopCTA = nav.getByTestId('desktop-nav-cta')
    await expect(
      desktopCTA.getByRole('link', { name: 'DOWNLOAD DESKTOP' })
    ).toBeVisible()
    await expect(
      desktopCTA.getByRole('link', { name: 'LAUNCH CLOUD' })
    ).toBeVisible()
  })
})

test.describe('Desktop dropdown @interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('hovering PRODUCTS shows dropdown items', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    const desktopLinks = nav.getByTestId('desktop-nav-links')
    const productsButton = desktopLinks.getByRole('button', {
      name: 'Products'
    })
    await productsButton.hover()

    const dropdown = nav.getByTestId('nav-dropdown')
    for (const item of [
      'Comfy Desktop',
      'Comfy Cloud',
      'Comfy API',
      'Comfy Enterprise'
    ]) {
      await expect(dropdown.getByText(item)).toBeVisible()
    }
  })

  test('moving mouse away closes dropdown', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    const desktopLinks = nav.getByTestId('desktop-nav-links')
    await desktopLinks.getByRole('button', { name: 'Products' }).hover()

    const comfyLocal = nav.getByRole('link', { name: 'Comfy Desktop' }).first()
    await expect(comfyLocal).toBeVisible()

    const viewport = page.viewportSize()
    await page.mouse.move(10, (viewport?.height ?? 800) - 10)
    await expect(comfyLocal).toBeHidden()
  })

  test('Escape key closes dropdown', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    const desktopLinks = nav.getByTestId('desktop-nav-links')
    await desktopLinks.getByRole('button', { name: 'Products' }).hover()

    const comfyLocal = nav.getByRole('link', { name: 'Comfy Desktop' }).first()
    await expect(comfyLocal).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(comfyLocal).toBeHidden()
  })
})

test.describe('Mobile menu @mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('hamburger button is visible', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'Toggle menu' })
    ).toBeVisible()
  })

  test('clicking hamburger opens mobile menu with nav items', async ({
    page
  }) => {
    await page.getByRole('button', { name: 'Toggle menu' }).click()

    const menu = page.getByRole('dialog')
    await expect(menu).toBeVisible()

    for (const label of ['Products', 'Pricing', 'Community']) {
      await expect(menu.getByText(label, { exact: true }).first()).toBeVisible()
    }
  })

  test('NEW badge shows on Products and Community only', async ({ page }) => {
    await page.getByRole('button', { name: 'Toggle menu' }).click()

    const menu = page.getByRole('dialog')

    for (const label of ['Products', 'Community']) {
      await expect(
        menu.getByRole('button', { name: label }).getByText('NEW', {
          exact: true
        })
      ).toBeVisible()
    }

    await expect(
      menu.getByRole('button', { name: 'Company' }).getByText('NEW')
    ).toHaveCount(0)
    await expect(
      menu.getByRole('link', { name: 'Pricing' }).getByText('NEW')
    ).toHaveCount(0)
  })

  test('clicking section with subitems drills down and back works', async ({
    page
  }) => {
    await page.getByRole('button', { name: 'Toggle menu' }).click()

    const menu = page.getByRole('dialog')
    await menu.getByRole('button', { name: 'Products' }).click()

    await expect(menu.getByText('Comfy Desktop')).toBeVisible()
    await expect(menu.getByText('Comfy Cloud')).toBeVisible()

    await menu.getByRole('button', { name: /BACK/i }).click()
    await expect(menu.getByRole('button', { name: 'Products' })).toBeVisible()
  })
})

test.describe('Footer @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('footer is visible with link sections', async ({ page }) => {
    const footer = page.locator('footer')
    await expect(footer).toBeVisible()

    for (const heading of ['Products', 'Resources', 'Company']) {
      await expect(
        footer.getByRole('heading', { name: heading }).first()
      ).toBeVisible()
    }
  })

  test('copyright text is visible', async ({ page }) => {
    await expect(
      page.locator('footer').getByText(/© \d{4} Comfy Org/)
    ).toBeVisible()
  })
})
