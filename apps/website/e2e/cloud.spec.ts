import { expect, test } from '@playwright/test'

test.describe('Cloud page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cloud')
  })

  test('has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Comfy Cloud — AI in the Cloud')
  })

  test('HeroSection heading and subtitle are visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /The full power of/i, level: 1 })
    ).toBeVisible()
    await expect(
      page.getByText(/The easiest way to start with ComfyUI/)
    ).toBeVisible()
  })

  test('HeroSection has CTA button linking to cloud', async ({ page }) => {
    const cta = page.getByRole('link', { name: /TRY COMFY CLOUD FOR FREE/i })
    await expect(cta).toBeVisible()
  })

  test('ReasonSection heading and reasons are visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Why.*professionals.*choose/i })
    ).toBeVisible()

    for (const title of [
      'Powerful GPUs',
      'All models',
      'More control',
      'Community workflows'
    ]) {
      await expect(page.getByText(title).first()).toBeVisible()
    }
  })

  test('AIModelsSection heading and 5 model cards are visible', async ({
    page
  }) => {
    await expect(
      page.getByRole('heading', { name: /leading AI models/i })
    ).toBeVisible()

    const grid = page.locator('.grid', {
      has: page.getByText('Grok Imagine')
    })
    const modelCards = grid.locator('a[href="https://comfy.org/workflows"]')
    await expect(modelCards).toHaveCount(5)
  })

  test('AIModelsSection CTA links to workflows', async ({ page }) => {
    const cta = page.getByRole('link', {
      name: /EXPLORE WORKFLOWS/i
    })
    await expect(cta.first()).toBeVisible()
    await expect(cta.first()).toHaveAttribute(
      'href',
      'https://comfy.org/workflows'
    )
  })

  test('AudienceSection heading and cards are visible', async ({ page }) => {
    await expect(page.getByText(/creators/i).first()).toBeVisible()

    for (const label of ['CREATORS', 'TEAMS & STUDIOS']) {
      await expect(page.getByText(label).first()).toBeVisible()
    }
  })

  test('PricingSection heading and CTA are visible', async ({ page }) => {
    await expect(page.getByText(/Simple, credit-based pricing/)).toBeVisible()

    const cta = page.getByRole('link', { name: /SEE PRICING PLANS/i })
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', '/cloud/pricing')
  })

  test('ProductCardsSection has 3 product cards', async ({ page }) => {
    const section = page.locator('section', {
      has: page.getByRole('heading', { name: /The AI creation/ })
    })
    const cards = section.locator('a[href]')
    await expect(cards).toHaveCount(3)
  })

  test('FAQSection heading is visible with 15 items', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /FAQ/i })).toBeVisible()

    const faqButtons = page.locator('button[aria-controls^="faq-panel-"]')
    await expect(faqButtons).toHaveCount(15)
  })
})

test.describe('Cloud FAQ accordion @interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cloud')
  })

  test('all FAQs are expanded by default', async ({ page }) => {
    await expect(
      page.getByText(/Comfy Cloud is a version of ComfyUI/i)
    ).toBeVisible()
  })

  test('clicking an expanded FAQ collapses it', async ({ page }) => {
    const firstQuestion = page.getByRole('button', {
      name: /What is Comfy Cloud/i
    })
    await firstQuestion.scrollIntoViewIfNeeded()
    await firstQuestion.click()

    await expect(
      page.getByText(/Comfy Cloud is a version of ComfyUI/i)
    ).toBeHidden()
  })

  test('clicking a collapsed FAQ expands it again', async ({ page }) => {
    const firstQuestion = page.getByRole('button', {
      name: /What is Comfy Cloud/i
    })
    await firstQuestion.scrollIntoViewIfNeeded()

    await firstQuestion.click()
    await expect(
      page.getByText(/Comfy Cloud is a version of ComfyUI/i)
    ).toBeHidden()

    await firstQuestion.click()
    await expect(
      page.getByText(/Comfy Cloud is a version of ComfyUI/i)
    ).toBeVisible()
  })
})
