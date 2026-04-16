import { expect, test } from '@playwright/test'

test.describe('Homepage @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Comfy — Professional Control of Visual AI')
  })

  test('HeroSection heading is visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Professional Control/i, level: 1 })
    ).toBeVisible()
  })

  test('SocialProofBar logos are visible', async ({ page }) => {
    await expect(
      page.locator('img[src*="/icons/clients/"]').first()
    ).toBeVisible()
  })

  test('ProductShowcase section is visible', async ({ page }) => {
    await expect(page.getByText('HOW', { exact: true }).first()).toBeVisible()
    await expect(
      page.getByText(/Connect models, processing steps, and outputs/)
    ).toBeVisible()
  })

  test('UseCaseSection is visible', async ({ page }) => {
    await expect(
      page.getByText('Industries that create with ComfyUI')
    ).toBeVisible()
  })

  test('GetStartedSection with heading is visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Get started in minutes' })
    ).toBeVisible()
  })

  test('ProductCardsSection has 4 product cards', async ({ page }) => {
    const section = page.locator('section', {
      has: page.getByRole('heading', { name: /The AI creation/ })
    })
    const cards = section.locator('a[href]')
    await expect(cards).toHaveCount(4)
  })

  test('CaseStudySpotlight section is visible', async ({ page }) => {
    const section = page.locator('section', {
      has: page.getByText('Customer Stories')
    })
    await expect(section).toBeVisible()
    await expect(
      section.getByRole('heading', { name: /See Comfy/i })
    ).toBeVisible()
  })

  test('BuildWhatSection is visible', async ({ page }) => {
    // "DOESN'T EXIST" is the actual badge text rendered in the Build What section
    await expect(page.getByText("DOESN'T EXIST")).toBeVisible()
  })
})

test.describe('Product showcase accordion @interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('first feature is active by default', async ({ page }) => {
    await expect(
      page.getByText(/Build powerful AI pipelines by connecting nodes/).first()
    ).toBeVisible()
  })

  test('clicking inactive feature expands it and collapses previous', async ({
    page
  }) => {
    const secondFeature = page
      .getByRole('button', { name: /App mode/i })
      .first()

    await secondFeature.scrollIntoViewIfNeeded()

    await expect(async () => {
      await secondFeature.click()
      await expect(
        page.getByText(/If you are new to ComfyUI/).first()
      ).toBeVisible({ timeout: 1000 })
    }).toPass({ timeout: 10000 })

    await expect(
      page.getByText(/Build powerful AI pipelines by connecting nodes/).first()
    ).toBeHidden()
  })
})

test.describe('Product cards links @smoke', () => {
  test('cards have correct hrefs', async ({ page }) => {
    await page.goto('/')

    const section = page.locator('section', {
      has: page.getByRole('heading', { name: /The AI creation/ })
    })

    for (const href of ['/download', '/cloud', '/api', '/cloud/enterprise']) {
      await expect(section.locator(`a[href="${href}"]`)).toBeVisible()
    }
  })
})

test.describe('Get started section links @smoke', () => {
  test('has download and cloud links', async ({ page }) => {
    await page.goto('/')

    const section = page.locator('section', {
      has: page.getByRole('heading', { name: 'Get started in minutes' })
    })

    const downloadLink = section.getByRole('link', { name: 'Download Local' })
    await expect(downloadLink).toBeVisible()
    await expect(downloadLink).toHaveAttribute('href', '/download')

    const cloudLink = section.getByRole('link', { name: 'Launch Cloud' })
    await expect(cloudLink).toBeVisible()
    await expect(cloudLink).toHaveAttribute('href', 'https://app.comfy.org')
  })
})
