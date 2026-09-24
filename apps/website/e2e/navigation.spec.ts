import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/workshopVisibility'

function settleAnimations(root: Locator) {
  return root.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished))
  )
}

async function badgePlacement(row: Locator, label: string) {
  const labelBox = await row.getByText(label, { exact: true }).boundingBox()
  const badgeBox = await row.locator('[data-slot="badge"]').boundingBox()
  if (!labelBox || !badgeBox)
    throw new Error(`"${label}" row is missing its label or NEW badge`)
  return {
    gap: badgeBox.x - (labelBox.x + labelBox.width),
    centerOffset:
      badgeBox.y + badgeBox.height / 2 - (labelBox.y + labelBox.height / 2),
    width: badgeBox.width,
    height: badgeBox.height
  }
}

const minimaxLabel = 'MiniMax H3'
const minimaxLabelZh = 'MiniMax H3'
const minimaxRoute = '/minimax-h3'
const minimaxRouteZh = '/zh-CN/minimax-h3'

const TOP_LEVEL_LABELS = [
  'Models',
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

  test('NEW badge shows on Workshop, Products and Community only', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    const desktopLinks = nav.getByTestId('desktop-nav-links')

    await expect(
      desktopLinks
        .getByRole('link', { name: 'Models' })
        .getByText('NEW', { exact: true })
    ).toBeVisible()
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
      desktopCTA.getByRole('link', { name: 'TRY CLOUD FOR FREE' })
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
      'Developer Platform',
      'Comfy Enterprise'
    ]) {
      await expect(dropdown.getByText(item)).toBeVisible()
    }
  })

  test('COMMUNITY dropdown badges Events and leaves Affiliates and Learning bare', async ({
    page
  }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    const desktopLinks = nav.getByTestId('desktop-nav-links')
    await desktopLinks.getByRole('button', { name: 'Community' }).hover()

    const dropdown = nav.getByTestId('nav-dropdown')
    await expect(
      dropdown.getByRole('link', { name: 'Events' }).getByText('NEW', {
        exact: true
      })
    ).toBeVisible()

    const affiliates = dropdown.getByRole('link', { name: 'Affiliates' })
    await expect(affiliates).toBeVisible()
    await expect(affiliates.locator('[data-slot="badge"]')).toHaveCount(0)

    const learning = dropdown.getByRole('link', { name: 'Learning' })
    await expect(learning).toBeVisible()
    await expect(learning.locator('[data-slot="badge"]')).toHaveCount(0)
  })

  test('BETA badge paints the plum token behind warm-white text', async ({
    page
  }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    const desktopLinks = nav.getByTestId('desktop-nav-links')
    await desktopLinks.getByRole('button', { name: 'Products' }).hover()

    const badge = nav
      .getByTestId('nav-dropdown')
      .getByRole('link', { name: 'Developer Platform' })
      .locator('[data-slot="badge"]')
    await expect(badge).toBeVisible()

    const palette = await page.evaluate(() => {
      const probe = document.createElement('span')
      document.body.append(probe)
      const token = (name: string) => {
        probe.style.color = `var(${name})`
        return getComputedStyle(probe).color
      }
      const resolved = {
        text: token('--color-primary-warm-white'),
        fill: token('--color-primary-comfy-plum')
      }
      probe.remove()
      return resolved
    })

    await expect
      .poll(() =>
        badge.evaluate((el) => ({
          text: getComputedStyle(el).color,
          fill: getComputedStyle(el, '::before').backgroundColor
        }))
      )
      .toEqual(palette)
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

    for (const label of ['Models', 'Products', 'Pricing', 'Community']) {
      await expect(menu.getByText(label, { exact: true }).first()).toBeVisible()
    }
  })

  test('NEW badge shows on Workshop, Products and Community only', async ({
    page
  }) => {
    await page.getByRole('button', { name: 'Toggle menu' }).click()

    const menu = page.getByRole('dialog')

    await expect(
      menu.getByRole('link', { name: 'Models' }).getByText('NEW', {
        exact: true
      })
    ).toBeVisible()
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

  test('NEW badge sits beside the label the same way on top-level and drill-down rows', async ({
    page
  }) => {
    await page.getByRole('button', { name: 'Toggle menu' }).click()

    const menu = page.getByRole('dialog')
    await settleAnimations(menu)
    const products = menu.getByRole('button', { name: 'Products' })
    const topLevel = await badgePlacement(products, 'Products')

    await products.click()
    const agent = menu.getByRole('link', { name: 'Comfy Agent' })
    await expect(agent).toBeVisible()
    await settleAnimations(menu)
    const drillDown = await badgePlacement(agent, 'Comfy Agent')

    expect(topLevel.gap).toBeGreaterThan(0)
    expect(Math.abs(topLevel.gap - drillDown.gap)).toBeLessThanOrEqual(1)
    expect(
      Math.abs(topLevel.centerOffset - drillDown.centerOffset)
    ).toBeLessThanOrEqual(1)
    expect(Math.abs(topLevel.width - drillDown.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(topLevel.height - drillDown.height)).toBeLessThanOrEqual(1)
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

  test('MiniMax H3 link navigates to the model page', async ({ page }) => {
    const link = page
      .locator('footer')
      .getByRole('link', { name: minimaxLabel })
    await link.scrollIntoViewIfNeeded()
    await expect(link).toHaveAttribute('href', minimaxRoute)

    await link.click()
    await expect(page).toHaveURL(minimaxRoute)
  })
})

test.describe('Footer zh-CN @smoke', () => {
  test('MiniMax H3 link navigates to the localized model page', async ({
    page
  }) => {
    await page.goto('/zh-CN/')

    const link = page
      .locator('footer')
      .getByRole('link', { name: minimaxLabelZh })
    await link.scrollIntoViewIfNeeded()
    await expect(link).toHaveAttribute('href', minimaxRouteZh)

    await link.click()
    await expect(page).toHaveURL(minimaxRouteZh)
  })
})
