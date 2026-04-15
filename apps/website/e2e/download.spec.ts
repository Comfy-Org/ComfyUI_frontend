import { expect, test } from '@playwright/test'

test.describe('Download page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/download')
  })

  test('has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Download Comfy — Run AI Locally')
  })

  test('CloudBannerSection is visible with cloud link', async ({ page }) => {
    const link = page.getByRole('link', { name: /TRY COMFY CLOUD/i })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute('href', 'https://app.comfy.org')
  })

  test('HeroSection heading and subtitle are visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Run on your hardware/i, level: 1 })
    ).toBeVisible()
    await expect(page.getByText(/The full ComfyUI engine/)).toBeVisible()
  })

  test('HeroSection has download and GitHub buttons', async ({ page }) => {
    const hero = page.locator('section', {
      has: page.getByRole('heading', {
        name: /Run on your hardware/i,
        level: 1
      })
    })
    const downloadBtn = hero.getByRole('link', { name: /DOWNLOAD LOCAL/i })
    await expect(downloadBtn).toBeVisible()
    await expect(downloadBtn).toHaveAttribute('target', '_blank')

    const githubBtn = hero.getByRole('link', { name: /INSTALL FROM GITHUB/i })
    await expect(githubBtn).toBeVisible()
    await expect(githubBtn).toHaveAttribute(
      'href',
      'https://github.com/Comfy-Org/ComfyUI'
    )
  })

  test('ReasonSection heading and reasons are visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Why.*professionals.*choose/i })
    ).toBeVisible()

    for (const title of [
      'Unlimited',
      'Any model',
      'Your machine',
      'Free. Open Source'
    ]) {
      await expect(page.getByText(title).first()).toBeVisible()
    }
  })

  test('EcoSystemSection heading is visible', async ({ page }) => {
    await expect(page.getByText(/An ecosystem that moves faster/)).toBeVisible()
  })

  test('ProductCardsSection has 3 product cards', async ({ page }) => {
    const section = page.locator('section', {
      has: page.getByRole('heading', { name: /The AI creation/ })
    })
    const cards = section.locator('a[href]')
    await expect(cards).toHaveCount(3)
  })

  test('ProductCardsSection links to cloud, api, enterprise', async ({
    page
  }) => {
    const section = page.locator('section', {
      has: page.getByRole('heading', { name: /The AI creation/ })
    })

    for (const href of ['/cloud', '/api', '/cloud/enterprise']) {
      await expect(section.locator(`a[href="${href}"]`)).toBeVisible()
    }
  })

  test('FAQSection heading is visible with 8 items', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /FAQ/i })).toBeVisible()

    const faqButtons = page.locator('button[aria-controls^="faq-panel-"]')
    await expect(faqButtons).toHaveCount(8)
  })
})

test.describe('FAQ accordion @interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/download')
  })

  test('all FAQs are expanded by default', async ({ page }) => {
    await expect(
      page.getByText(/A dedicated GPU is strongly recommended/i)
    ).toBeVisible()
    await expect(page.getByText(/ComfyUI is lightweight/i)).toBeVisible()
  })

  test('clicking an expanded FAQ collapses it', async ({ page }) => {
    const firstQuestion = page.getByRole('button', {
      name: /Do I need a GPU/i
    })
    await firstQuestion.scrollIntoViewIfNeeded()
    await firstQuestion.click()

    await expect(
      page.getByText(/A dedicated GPU is strongly recommended/i)
    ).toBeHidden()
  })

  test('clicking a collapsed FAQ expands it again', async ({ page }) => {
    const firstQuestion = page.getByRole('button', {
      name: /Do I need a GPU/i
    })
    await firstQuestion.scrollIntoViewIfNeeded()

    await firstQuestion.click()
    await expect(
      page.getByText(/A dedicated GPU is strongly recommended/i)
    ).toBeHidden()

    await firstQuestion.click()
    await expect(
      page.getByText(/A dedicated GPU is strongly recommended/i)
    ).toBeVisible()
  })
})

test.describe('Download page mobile @mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/download')
  })

  test('CloudBannerSection is visible', async ({ page }) => {
    await expect(page.getByText(/Need more power/)).toBeVisible()
  })

  test('HeroSection heading is visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Run on your hardware/i, level: 1 })
    ).toBeVisible()
  })

  test('download buttons are stacked vertically', async ({ page }) => {
    const hero = page.locator('section', {
      has: page.getByRole('heading', {
        name: /Run on your hardware/i,
        level: 1
      })
    })
    const downloadBtn = hero.getByRole('link', { name: /DOWNLOAD LOCAL/i })
    const githubBtn = hero.getByRole('link', { name: /INSTALL FROM GITHUB/i })

    await downloadBtn.scrollIntoViewIfNeeded()

    const downloadBox = await downloadBtn.boundingBox()
    const githubBox = await githubBtn.boundingBox()

    expect(downloadBox, 'download button bounding box').not.toBeNull()
    expect(githubBox, 'github button bounding box').not.toBeNull()
    expect(githubBox!.y).toBeGreaterThan(downloadBox!.y)
  })
})
