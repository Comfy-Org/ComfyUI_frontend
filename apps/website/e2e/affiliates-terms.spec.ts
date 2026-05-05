import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

const PATH = '/affiliates/terms'

const SECTION_IDS = [
  '1-program-overview',
  '2-eligible-products',
  '3-commission-structure',
  '4-attribution-rules',
  '5-prohibited-activities',
  '6-content-guidelines',
  '7-termination',
  '8-program-modifications',
  '9-indemnification',
  '10-governing-law',
  '11-miscellaneous'
] as const

test.describe('Affiliate Terms — desktop @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('renders heading and is marked noindex', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Affiliate Terms', level: 1 })
    ).toBeVisible()

    const robotsContent = await page
      .locator('meta[name="robots"]')
      .getAttribute('content')
    expect(robotsContent).toContain('noindex')
  })

  test('exposes one anchor per legal section in order', async ({ page }) => {
    for (const id of SECTION_IDS) {
      await expect(page.locator(`[id="${id}"]`)).toBeAttached()
    }
  })

  test('clicking a desktop TOC link scrolls to the matching section', async ({
    page
  }) => {
    const desktopToc = page.getByRole('navigation', { name: 'On this page' })
    await expect(desktopToc).toBeVisible()

    const link = desktopToc.getByRole('link', { name: /5\. Prohibited/ })
    await link.click()

    const target = page.locator('[id="5-prohibited-activities"]')
    await expect(target).toBeInViewport()
  })

  test('renders an effective date footer', async ({ page }) => {
    await expect(page.getByText(/Effective Date:/)).toBeVisible()
  })

  test('skips internal-only sections (competitive analysis, open questions)', async ({
    page
  }) => {
    await expect(page.getByText(/Competitive analysis/i)).toHaveCount(0)
    await expect(
      page.getByText(/Open questions for legal review/i)
    ).toHaveCount(0)
  })
})

test.describe('Affiliate Terms — mobile @mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PATH)
  })

  test('shows a collapsed accordion TOC by default', async ({ page }) => {
    const accordion = page.locator('details', {
      has: page.getByText('On this page')
    })
    await expect(accordion).toBeVisible()
    await expect(accordion).not.toHaveAttribute('open', '')
  })

  test('expanding the accordion reveals every section link', async ({
    page
  }) => {
    const accordion = page.locator('details', {
      has: page.getByText('On this page')
    })
    await accordion.locator('summary').click()
    await expect(accordion).toHaveAttribute('open', '')

    for (const id of SECTION_IDS) {
      await expect(accordion.locator(`a[href="#${id}"]`).first()).toBeVisible()
    }
  })

  test('headings remain readable at narrow viewports without horizontal overflow', async ({
    page
  }) => {
    const heading = page.getByRole('heading', { name: '1. Program Overview' })
    await expect(heading).toBeVisible()
    const box = await heading.boundingBox()
    expect(box, 'heading box').not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  })
})
