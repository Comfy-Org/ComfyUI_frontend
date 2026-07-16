import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

const TOP_LEVEL_LABELS = [
  'Products',
  'Resources',
  'Enterprise',
  'Pricing'
] as const

test.describe('Desktop navigation @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('has the approved top-level order and working CTAs', async ({
    page
  }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    const desktopLinks = nav.getByTestId('desktop-nav-links')
    const labels = await desktopLinks
      .locator('[data-nav-placement="desktop-top"]')
      .allTextContents()

    expect(labels.map((label) => label.trim())).toEqual(TOP_LEVEL_LABELS)
    await expect(nav.getByRole('link', { name: 'Comfy home' })).toHaveAttribute(
      'href',
      '/'
    )

    const desktopCTA = nav.getByTestId('desktop-nav-cta')
    await expect(
      desktopCTA.getByRole('link', { name: 'DOWNLOAD DESKTOP' })
    ).toHaveAttribute('href', '/download')
    await expect(
      desktopCTA.getByRole('link', { name: 'LAUNCH CLOUD' })
    ).toHaveAttribute('href', 'https://cloud.comfy.org')
  })
})

test.describe('Desktop dropdowns @interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('Products contains only usable products', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    const desktopLinks = nav.getByTestId('desktop-nav-links')
    await desktopLinks.getByRole('button', { name: 'Products' }).hover()

    for (const item of [
      'Comfy Desktop',
      'Comfy Cloud',
      'Comfy API',
      'Comfy MCP'
    ]) {
      await expect(
        desktopLinks.getByRole('link', { name: new RegExp(item) }).first()
      ).toBeVisible()
    }

    for (const removedItem of [
      'Features',
      'Docs',
      'Supported Models',
      'Comfy Enterprise'
    ]) {
      await expect(
        desktopLinks.getByText(removedItem, { exact: true })
      ).toBeHidden()
    }
  })

  test('Resources exposes the approved groups and destinations', async ({
    page
  }) => {
    const desktopLinks = page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByTestId('desktop-nav-links')
    await desktopLinks.getByRole('button', { name: 'Resources' }).hover()

    for (const group of ['Learn', 'Discover', 'Stay current', 'Community']) {
      await expect(desktopLinks.getByText(group, { exact: true })).toBeVisible()
    }

    for (const item of [
      'Docs',
      'Learning',
      'Blog',
      'Comfy Hub',
      'Gallery',
      'Supported Models',
      "What's New",
      'Customer Stories',
      'Discord',
      'GitHub',
      'YouTube',
      'Affiliate Program'
    ]) {
      await expect(
        desktopLinks.getByRole('link', { name: new RegExp(item) }).first()
      ).toBeVisible()
    }

    await expect(
      desktopLinks.getByRole('link', { name: /What's New/ })
    ).toHaveAttribute('href', '/launches')
    await expect(
      desktopLinks.getByRole('link', { name: /Docs/ })
    ).toHaveAttribute('rel', 'noopener noreferrer')
  })

  test('Enterprise provides overview, proof, sales, and support', async ({
    page
  }) => {
    const desktopLinks = page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByTestId('desktop-nav-links')
    await desktopLinks.getByRole('button', { name: 'Enterprise' }).hover()

    await expect(
      desktopLinks.getByRole('link', { name: /Enterprise Overview/ }).first()
    ).toHaveAttribute('href', '/cloud/enterprise')
    await expect(
      desktopLinks.getByRole('link', { name: /Customer Stories/ })
    ).toHaveAttribute('href', '/customers')
    await expect(
      desktopLinks.getByRole('link', { name: /Contact Sales/ })
    ).toHaveAttribute('href', '/contact')
    await expect(
      desktopLinks.getByRole('link', { name: /Support/ })
    ).toHaveAttribute('href', 'https://support.comfy.org/hc/en-us')
  })

  test('assigns a shared Customer Stories route to Enterprise', async ({
    page
  }) => {
    await page.goto('/customers')
    const desktopLinks = page.getByTestId('desktop-nav-links')
    const resources = desktopLinks.getByRole('button', { name: 'Resources' })
    const enterprise = desktopLinks.getByRole('button', {
      name: 'Enterprise'
    })

    await expect(resources).not.toHaveAttribute('data-active')
    await expect(enterprise).toHaveAttribute('data-active', '')
  })

  test('supports keyboard open and Escape focus return', async ({ page }) => {
    const productsButton = page
      .getByTestId('desktop-nav-links')
      .getByRole('button', { name: 'Products' })

    await productsButton.focus()
    await page.keyboard.press('Enter')
    await expect(productsButton).toHaveAttribute('aria-expanded', 'true')
    await expect(productsButton).toHaveAttribute('aria-controls', /.+/)

    await page.keyboard.press('Escape')
    await expect(productsButton).toHaveAttribute('aria-expanded', 'false')
    await expect(productsButton).toBeFocused()
  })

  test('closes when the pointer moves away', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    await nav
      .getByTestId('desktop-nav-links')
      .getByRole('button', { name: 'Products' })
      .hover()

    const desktopLink = nav
      .getByTestId('desktop-nav-links')
      .getByRole('link', { name: /Comfy Desktop/ })
    await expect(desktopLink).toBeVisible()

    const viewport = page.viewportSize()
    await page.mouse.move(10, (viewport?.height ?? 800) - 10)
    await expect(desktopLink).toBeHidden()
  })

  test('fits a laptop viewport and closes on outside click', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    const desktopLinks = page.getByTestId('desktop-nav-links')
    await desktopLinks.getByRole('button', { name: 'Resources' }).click()

    const dropdown = desktopLinks
      .getByTestId('nav-dropdown')
      .filter({ hasText: 'Stay current' })
    await expect(dropdown).toBeVisible()

    const bounds = await dropdown.boundingBox()
    expect(bounds).not.toBeNull()
    if (!bounds) return
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(1024)
    expect(bounds.y).toBeGreaterThanOrEqual(0)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(768)

    await page.locator('main').click({ position: { x: 10, y: 500 } })
    await expect(dropdown).toBeHidden()
  })
})

test.describe('Mobile menu @mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Toggle menu' }).click()
  })

  test('uses the desktop ordering and accessible accordions', async ({
    page
  }) => {
    const menu = page.getByRole('dialog')
    const labels = await menu
      .locator('[data-nav-placement="mobile-top"]')
      .allTextContents()
    expect(labels.map((label) => label.trim())).toEqual(TOP_LEVEL_LABELS)

    for (const label of ['Products', 'Resources', 'Enterprise']) {
      const trigger = menu.getByRole('button', { name: label })
      await expect(trigger).toHaveAttribute('aria-expanded', 'false')
      await expect(trigger).toHaveAttribute('aria-controls', /.+/)
    }
    await expect(menu.getByRole('link', { name: 'Pricing' })).toHaveAttribute(
      'href',
      '/cloud/pricing'
    )
  })

  test('preserves group hierarchy and closes the previous accordion', async ({
    page
  }) => {
    const menu = page.getByRole('dialog')
    const products = menu.getByRole('button', { name: 'Products' })
    const resources = menu.getByRole('button', { name: 'Resources' })

    await products.click()
    await expect(menu.getByRole('region', { name: 'Products' })).toBeVisible()
    await expect(menu.getByText('Create', { exact: true })).toBeVisible()
    await expect(menu.getByText('Build', { exact: true })).toBeVisible()
    await expect(menu.getByRole('link', { name: /Comfy MCP/ })).toBeVisible()

    await resources.click()
    await expect(menu.getByRole('region', { name: 'Products' })).toBeHidden()
    const resourcesPanel = menu.getByRole('region', { name: 'Resources' })
    await expect(resourcesPanel).toBeVisible()
    for (const group of ['Learn', 'Discover', 'Stay current', 'Community']) {
      await expect(
        resourcesPanel.getByText(group, { exact: true })
      ).toBeVisible()
    }
  })

  test('Escape closes an accordion, then the menu, and restores focus', async ({
    page
  }) => {
    const menu = page.getByRole('dialog')
    const enterprise = menu.getByRole('button', { name: 'Enterprise' })
    await enterprise.click()
    await menu.getByRole('link', { name: /Contact Sales/ }).focus()

    await page.keyboard.press('Escape')
    await expect(enterprise).toHaveAttribute('aria-expanded', 'false')
    await expect(enterprise).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(
      page.getByRole('button', { name: 'Toggle menu' })
    ).toBeFocused()
  })
})

test.describe('Footer @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('preserves Company and legal destinations', async ({ page }) => {
    const footer = page.locator('footer')

    for (const heading of ['Products', 'Resources', 'Company']) {
      await expect(
        footer.getByRole('heading', { name: heading }).first()
      ).toBeVisible()
    }

    for (const [label, href] of [
      ['About', '/about'],
      ['Careers', '/careers'],
      ['Contact', '/contact'],
      ['Brand', '/brand'],
      ['Terms of Service', '/terms-of-service'],
      ['Enterprise MSA', '/enterprise-msa'],
      ['Privacy Policy', '/privacy-policy'],
      ['Press', 'mailto:press@comfy.org']
    ]) {
      const link = footer.getByRole('link', { name: label }).first()
      await expect(link).toBeVisible()
      await expect(link).toHaveAttribute('href', href)
    }
  })
})
