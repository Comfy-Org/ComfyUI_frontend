import { expect, test } from '@playwright/test'

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
    const desktopLinks = nav.locator('.md\\:flex').first()

    for (const label of ['PRODUCTS', 'PRICING', 'COMMUNITY', 'RESOURCES', 'COMPANY']) {
      await expect(
        desktopLinks.getByText(label).first()
      ).toBeVisible()
    }
  })

  test('CTA buttons are visible', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    const desktopCTA = nav.locator('.md\\:flex').last()
    await expect(
      desktopCTA.getByRole('link', { name: 'DOWNLOAD LOCAL' })
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
    const desktopLinks = nav.locator('.md\\:flex').first()
    const productsButton = desktopLinks.getByRole('button', {
      name: /PRODUCTS/i
    })
    await productsButton.hover()

    const dropdown = productsButton
      .locator('..')
      .locator('.backdrop-blur-md')
    for (const item of [
      'Comfy Local',
      'Comfy Cloud',
      'Comfy API',
      'Comfy Enterprise'
    ]) {
      await expect(dropdown.getByText(item)).toBeVisible()
    }
  })

  test('moving mouse away closes dropdown', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    const desktopLinks = nav.locator('.md\\:flex').first()
    await desktopLinks.getByRole('button', { name: /PRODUCTS/i }).hover()

    const comfyLocal = nav.getByRole('link', { name: 'Comfy Local' }).first()
    await expect(comfyLocal).toBeVisible()

    await page.locator('main').hover()
    await expect(comfyLocal).toBeHidden()
  })

  test('Escape key closes dropdown', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    const desktopLinks = nav.locator('.md\\:flex').first()
    await desktopLinks.getByRole('button', { name: /PRODUCTS/i }).hover()

    const comfyLocal = nav.getByRole('link', { name: 'Comfy Local' }).first()
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

    const menu = page.locator('#site-mobile-menu')
    await expect(menu).toBeVisible()

    for (const label of ['PRODUCTS', 'PRICING', 'COMMUNITY']) {
      await expect(menu.getByText(label).first()).toBeVisible()
    }
  })

  test('clicking section with subitems drills down and back works', async ({
    page
  }) => {
    await page.getByRole('button', { name: 'Toggle menu' }).click()

    const menu = page.locator('#site-mobile-menu')
    await menu.getByText('PRODUCTS').first().click()

    await expect(menu.getByText('Comfy Local')).toBeVisible()
    await expect(menu.getByText('Comfy Cloud')).toBeVisible()

    await menu.getByRole('button', { name: /BACK/i }).click()
    await expect(menu.getByText('PRODUCTS').first()).toBeVisible()
  })

  test('CTA buttons visible in mobile menu', async ({ page }) => {
    await page.getByRole('button', { name: 'Toggle menu' }).click()

    const menu = page.locator('#site-mobile-menu')
    await expect(
      menu.getByRole('link', { name: 'DOWNLOAD LOCAL' })
    ).toBeVisible()
    await expect(
      menu.getByRole('link', { name: 'LAUNCH CLOUD' })
    ).toBeVisible()
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
      page.locator('footer').getByText(/© 2026 Comfy Org/)
    ).toBeVisible()
  })
})
