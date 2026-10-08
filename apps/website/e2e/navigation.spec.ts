import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'

import { externalLinks } from '@/config/routes'
import { test } from './fixtures/workshopVisibility'
import { waitForIsland } from './fixtures/islands'

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
const minimaxRoute = '/minimax-h3/'
const minimaxRouteZh = '/zh-CN/minimax-h3/'

const TOP_LEVEL_LABELS = [
  'Hub',
  'Products',
  'Enterprise',
  'Pricing',
  'Company'
] as const

const SOCIAL_LINKS = [
  ['GitHub', externalLinks.github],
  ['Discord', externalLinks.discord],
  ['X', externalLinks.x],
  ['YouTube', externalLinks.youtube],
  ['LinkedIn', externalLinks.linkedin],
  ['Instagram', externalLinks.instagram]
] as const

const RETIRED_BADGE_PANELS = [
  {
    section: 'Products',
    badged: [
      { label: 'Comfy Agent', href: '/agent/' },
      { label: 'Developer Platform', href: '/platform/' },
      { label: 'Comfy Router', href: '/platform/router/' }
    ],
    bare: [
      { label: 'Comfy CLI', href: '/cli/' },
      { label: 'Managed Builds', href: '/enterprise/managed-builds/' }
    ]
  },
  {
    section: 'Company',
    badged: [
      { label: 'Events', href: '/events/' },
      { label: 'Customer Stories', href: '/customers/' }
    ],
    bare: [
      { label: 'Affiliates', href: '/affiliates/' },
      { label: 'Learning', href: '/learning/' }
    ]
  }
] as const

const BADGE_PALETTES = [
  {
    link: 'Comfy Agent',
    label: 'NEW',
    text: '--color-primary-comfy-ink',
    fill: '--color-primary-comfy-yellow'
  }
] as const

async function expectRetiredBadges(
  panel: Locator,
  { badged, bare }: (typeof RETIRED_BADGE_PANELS)[number]
) {
  for (const { label, href } of badged) {
    const link = panel.getByRole('link', { name: label })
    await expect(link).toHaveAttribute('href', href)
    await expect(link.getByText('NEW', { exact: true })).toBeVisible()
  }
  for (const { label, href } of bare) {
    const link = panel.getByRole('link', { name: label })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', href)
    await expect(link.locator('[data-slot="badge"]')).toHaveCount(0)
  }
}

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

  test('NEW badge shows on Hub only', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    const desktopLinks = nav.getByTestId('desktop-nav-links')

    for (const label of TOP_LEVEL_LABELS) {
      await expect(
        desktopLinks.getByText(label, { exact: true }).first()
      ).toBeVisible()
    }
    await expect(
      desktopLinks
        .getByRole('button', { name: 'Hub' })
        .getByText('NEW', { exact: true })
    ).toBeVisible()
    await expect(desktopLinks.getByText('NEW', { exact: true })).toHaveCount(1)
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
    await waitForIsland(page, productsButton)
    await productsButton.hover()

    const dropdown = nav.getByTestId('nav-dropdown')
    for (const item of [
      'Comfy Desktop',
      'Browse Models',
      'Comfy Cloud',
      'Comfy Agent',
      'Developer Platform',
      'Managed Builds',
      'Docs'
    ]) {
      await expect(dropdown.getByText(item)).toBeVisible()
    }
  })

  test('hovering ENTERPRISE shows the enterprise offers', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    const enterpriseButton = nav
      .getByTestId('desktop-nav-links')
      .getByRole('button', { name: 'Enterprise' })
    await waitForIsland(page, enterpriseButton)
    await enterpriseButton.hover()

    const dropdown = nav.getByTestId('nav-dropdown')
    for (const item of [
      'Comfy Enterprise',
      'Forward Deployed Creatives',
      'Team Billing',
      'Commercial Licensing',
      'Contact Sales'
    ]) {
      await expect(dropdown.getByText(item)).toBeVisible()
    }
  })

  for (const { reducedMotion, autoplay } of [
    { reducedMotion: 'no-preference', autoplay: true },
    { reducedMotion: 'reduce', autoplay: false }
  ] as const) {
    test(`Products featured video ${autoplay ? 'autoplays' : 'does not autoplay'} with ${reducedMotion} motion`, async ({
      page
    }) => {
      await page.emulateMedia({ reducedMotion })
      const nav = page.getByRole('navigation', { name: 'Main navigation' })
      await nav
        .getByTestId('desktop-nav-links')
        .getByRole('button', { name: 'Products' })
        .hover()

      const card = nav.getByTestId('nav-dropdown').getByRole('link', {
        name: 'Explore the Gemini Omni 1.1 Flash release'
      })
      await expect(card).toHaveAttribute('href', '/gemini-omni/')
      const video = card.locator('video')
      await expect(video).toHaveAttribute(
        'src',
        'https://media.comfy.org/website/gemini-omni/card-5.webm'
      )
      await expect(video).toHaveJSProperty('autoplay', autoplay)
      await expect(video).toHaveJSProperty('loop', false)
    })
  }

  test('hovering HUB shows the Explore row, then the Models examples with their meta lines', async ({
    page
  }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    const hubButton = nav
      .getByTestId('desktop-nav-links')
      .getByRole('button', { name: 'Hub' })
    await waitForIsland(page, hubButton)
    await hubButton.hover()

    const dropdown = nav.getByTestId('nav-dropdown')
    await expect(
      dropdown.getByText('Run, call by API or download')
    ).toBeVisible()
    await expect(dropdown.getByTestId('nav-explore-row')).toContainText(
      'Try in the browser, call by API, or take it into ComfyUI'
    )
    const seedream = dropdown.getByRole('link', { name: /^Seedream 5\.0 Pro/ })
    await expect(seedream).toHaveAttribute(
      'href',
      '/hub/models/seedream-5-0-pro-text-to-image/'
    )
    await expect(seedream).toContainText('ByteDance · Image')
    await expect(dropdown.getByRole('img')).toHaveCount(0)
    await expect(dropdown.locator('video')).toHaveCount(0)
    await expect(
      dropdown.getByRole('link', { name: 'All models' })
    ).toHaveAttribute('href', '/hub/models/')
    await expect(dropdown.getByRole('link', { name: /API/ })).toHaveCount(0)
    await expect(
      dropdown.getByRole('link', { name: /^Explore the Hub/ })
    ).toHaveAttribute('href', '/hub/')
  })

  for (const name of ['Hub', 'Products'])
    test(`opens the ${name} panel under its trigger, not at the page edge`, async ({
      page
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      const nav = page.getByRole('navigation', { name: 'Main navigation' })
      const trigger = nav
        .getByTestId('desktop-nav-links')
        .getByRole('button', { name })
      await waitForIsland(page, trigger)
      await trigger.hover()

      const panel = page.locator('[data-slot="navigation-menu-viewport"]')
      await expect(nav.getByTestId('nav-dropdown')).toBeVisible()
      await expect
        .poll(async () => {
          const [at, under] = [
            await trigger.boundingBox(),
            await panel.boundingBox()
          ]
          return at && under ? Math.abs(Math.round(under.x - at.x)) : undefined
        })
        .toBe(0)
    })

  test('PRODUCTS keeps social links out and shows its card before the columns', async ({
    page
  }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    await nav
      .getByTestId('desktop-nav-links')
      .getByRole('button', { name: 'Products' })
      .hover()

    const dropdown = nav.getByTestId('nav-dropdown')
    for (const [name] of SOCIAL_LINKS) {
      await expect(
        dropdown.getByRole('link', { name, exact: true })
      ).toHaveCount(0)
    }
    const column = await dropdown
      .getByRole('link', { name: 'Comfy Cloud' })
      .boundingBox()
    const card = await dropdown
      .getByRole('link', { name: 'Explore the Gemini Omni 1.1 Flash release' })
      .boundingBox()
    expect(card?.x).toBeLessThan(column?.x ?? -Infinity)
  })

  test('Company dropdown folds in Community and names each social icon link', async ({
    page
  }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    await nav
      .getByTestId('desktop-nav-links')
      .getByRole('button', { name: 'Company' })
      .hover()

    const dropdown = nav.getByTestId('nav-dropdown')
    for (const item of ['Events', 'About Us', 'Customer Stories', 'Launches']) {
      await expect(dropdown.getByText(item, { exact: true })).toBeVisible()
    }
    await expect(
      dropdown.getByRole('link', {
        name: 'Discord (opens in new tab)',
        exact: true
      })
    ).toHaveAttribute('href', 'https://discord.com/invite/comfyorg')
    await expect(
      dropdown.getByRole('link', {
        name: 'YouTube (opens in new tab)',
        exact: true
      })
    ).toBeVisible()
  })

  for (const panel of RETIRED_BADGE_PANELS) {
    test(`${panel.section} dropdown keeps NEW on ${panel.badged.map((b) => b.label).join(', ')} and drops it from the retired entries`, async ({
      page
    }) => {
      const nav = page.getByRole('navigation', { name: 'Main navigation' })
      const desktopLinks = nav.getByTestId('desktop-nav-links')
      await desktopLinks.getByRole('button', { name: panel.section }).hover()

      await expectRetiredBadges(nav.getByTestId('nav-dropdown'), panel)
    })
  }

  test('NEW badges paint ink on yellow', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Main navigation' })
    const desktopLinks = nav.getByTestId('desktop-nav-links')
    await desktopLinks.getByRole('button', { name: 'Products' }).hover()
    const dropdown = nav.getByTestId('nav-dropdown')

    for (const { link, label, text, fill } of BADGE_PALETTES) {
      const badge = dropdown
        .getByRole('link', { name: link })
        .getByText(label, { exact: true })
      await expect(badge).toBeVisible()

      const expected = await page.evaluate(
        ([textToken, fillToken]) => {
          const probe = document.createElement('span')
          document.body.append(probe)
          const resolve = (name: string) => {
            probe.style.color = `var(${name})`
            return getComputedStyle(probe).color
          }
          const resolved = {
            text: resolve(textToken),
            fill: resolve(fillToken)
          }
          probe.remove()
          return resolved
        },
        [text, fill] as const
      )

      await expect
        .poll(() =>
          badge.evaluate((el) => {
            let host: Element | null = el
            while (
              host &&
              getComputedStyle(host, '::before').backgroundColor ===
                'rgba(0, 0, 0, 0)'
            )
              host = host.parentElement
            return {
              text: getComputedStyle(el).color,
              fill: host && getComputedStyle(host, '::before').backgroundColor
            }
          })
        )
        .toEqual(expected)
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
    await waitForIsland(page, page.getByRole('button', { name: 'Toggle menu' }))
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

    for (const label of TOP_LEVEL_LABELS) {
      await expect(menu.getByText(label, { exact: true }).first()).toBeVisible()
    }
  })

  test('NEW badge shows on Hub only', async ({ page }) => {
    await page.getByRole('button', { name: 'Toggle menu' }).click()

    const menu = page.getByRole('dialog')

    await expect(
      menu
        .getByRole('button', { name: 'Hub' })
        .getByText('NEW', { exact: true })
    ).toBeVisible()
    await expect(menu.getByRole('button', { name: 'Products' })).toBeVisible()
    await expect(menu.getByText('NEW', { exact: true })).toHaveCount(1)
  })

  test('Hub drill-down shows the examples without images and ends with the Explore link', async ({
    page
  }) => {
    await page.getByRole('button', { name: 'Toggle menu' }).click()

    const menu = page.getByRole('dialog')
    await menu.getByRole('button', { name: 'Hub' }).click()

    const seedream = menu.getByRole('link', { name: /^Seedream 5\.0 Pro/ })
    await expect(seedream).toContainText('ByteDance · Image')
    await expect(seedream.getByRole('img')).toHaveCount(0)

    await expect(
      menu.getByRole('link', { name: 'All models' })
    ).toHaveAttribute('href', '/hub/models/')
    await expect(
      menu.getByRole('link', { name: /^Explore the Hub/ })
    ).toHaveAttribute('href', '/hub/')
  })

  test('Company drill-down folds in Community and names each social icon link', async ({
    page
  }) => {
    await page.getByRole('button', { name: 'Toggle menu' }).click()

    const menu = page.getByRole('dialog')
    await menu.getByRole('button', { name: /^Company/ }).click()

    await expect(menu.getByRole('link', { name: 'Affiliates' })).toBeVisible()
    await expect(
      menu.getByRole('link', {
        name: 'Discord (opens in new tab)',
        exact: true
      })
    ).toHaveAttribute('href', externalLinks.discord)
  })

  for (const panel of RETIRED_BADGE_PANELS) {
    test(`${panel.section} drill-down keeps NEW on ${panel.badged.map((b) => b.label).join(', ')} and drops it from the retired entries`, async ({
      page
    }) => {
      await page.getByRole('button', { name: 'Toggle menu' }).click()

      const menu = page.getByRole('dialog')
      await menu.getByRole('button', { name: panel.section }).click()

      await expectRetiredBadges(menu, panel)
    })
  }

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

  test('NEW badge sits beside the label the same way on every drill-down row', async ({
    page
  }) => {
    await page.getByRole('button', { name: 'Toggle menu' }).click()

    const menu = page.getByRole('dialog')
    await menu.getByRole('button', { name: 'Products' }).click()
    const models = menu.getByRole('link', { name: 'Browse Models' })
    const agent = menu.getByRole('link', { name: 'Comfy Agent' })
    await expect(agent).toBeVisible()
    await settleAnimations(menu)
    const first = await badgePlacement(models, 'Browse Models')
    const second = await badgePlacement(agent, 'Comfy Agent')

    expect(first.gap).toBeGreaterThan(0)
    expect(Math.abs(first.gap - second.gap)).toBeLessThanOrEqual(1)
    expect(
      Math.abs(first.centerOffset - second.centerOffset)
    ).toBeLessThanOrEqual(1)
    expect(Math.abs(first.width - second.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(first.height - second.height)).toBeLessThanOrEqual(1)
  })
})

test.describe('Footer @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('footer is visible with link sections', async ({ page }) => {
    const footer = page.locator('footer')
    await expect(footer).toBeVisible()

    for (const heading of ['Products', 'Features', 'Resources', 'Company']) {
      await expect(
        footer.getByRole('heading', { name: heading }).first()
      ).toBeVisible()
    }
  })

  test('lays the five link columns and the social buttons out in one row each on desktop, with Contact below', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const footer = page.locator('footer')
    await footer.scrollIntoViewIfNeeded()

    const tops = async (locator: Locator) =>
      locator.evaluateAll((elements) =>
        elements.map((element) =>
          Math.round(element.getBoundingClientRect().top)
        )
      )
    const [contact, ...columns] = (
      await tops(footer.getByRole('heading', { level: 3 }))
    ).reverse()
    expect(columns).toHaveLength(5)
    expect(new Set(columns).size).toBe(1)
    expect(contact).toBeGreaterThan(columns[0])
    const social = await tops(
      footer.getByRole('navigation', { name: 'Follow Comfy' }).getByRole('link')
    )
    expect(new Set(social).size).toBe(1)
  })

  test('social links are round icon buttons that open a new tab', async ({
    page
  }) => {
    const social = page
      .locator('footer')
      .getByRole('navigation', { name: 'Follow Comfy' })
    await social.scrollIntoViewIfNeeded()

    for (const [name, href] of SOCIAL_LINKS) {
      const link = social.getByRole('link', { name, exact: true })
      await expect(link).toHaveAttribute('href', href)
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(link).toHaveText('')
      const box = await link.boundingBox()
      expect(box?.width).toBe(box?.height)
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
