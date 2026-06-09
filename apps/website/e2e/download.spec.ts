import { devices, expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

const WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/** Desktop UA that matches neither Windows nor Mac — triggers the fallback. */
const LINUX_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/** Mobile UAs: users can't install a desktop build, so neither the single
 *  CTA nor the fallback should appear — only the GitHub link. */
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

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
    await expect(link).toHaveAttribute('href', 'https://cloud.comfy.org')
  })

  test('HeroSection heading and subtitle are visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Run on your hardware/i, level: 1 })
    ).toBeVisible()
    await expect(page.getByText(/The full ComfyUI engine/)).toBeVisible()
  })

  test('HeroSection has download and GitHub buttons', async ({ browser }) => {
    const context = await browser.newContext({ userAgent: WINDOWS_UA })
    const page = await context.newPage()
    await page.goto('/download')

    const hero = page.locator('section', {
      has: page.getByRole('heading', {
        name: /Run on your hardware/i,
        level: 1
      })
    })
    const downloadBtn = hero.getByRole('link', { name: /DOWNLOAD DESKTOP/i })
    await expect(downloadBtn).toBeVisible()
    await expect(downloadBtn).toHaveAttribute('target', '_blank')

    const githubBtn = hero.getByRole('link', { name: /INSTALL FROM GITHUB/i })
    await expect(githubBtn).toBeVisible()
    await expect(githubBtn).toHaveAttribute(
      'href',
      'https://github.com/Comfy-Org/ComfyUI#installing'
    )

    await context.close()
  })

  test('HeroSection falls back to both Windows + Mac when UA is unrecognized', async ({
    browser
  }) => {
    const context = await browser.newContext({ userAgent: LINUX_UA })
    const page = await context.newPage()
    await page.goto('/download')

    const hero = page.locator('section', {
      has: page.getByRole('heading', {
        name: /Run on your hardware/i,
        level: 1
      })
    })

    const windowsBtn = hero.getByRole('link', { name: /Windows$/ })
    await expect(windowsBtn).toBeVisible()
    await expect(windowsBtn).toHaveAttribute(
      'href',
      'https://download.comfy.org/windows/nsis/x64'
    )

    const macBtn = hero.getByRole('link', { name: /macOS$/ })
    await expect(macBtn).toBeVisible()
    await expect(macBtn).toHaveAttribute(
      'href',
      'https://download.comfy.org/mac/dmg/arm64'
    )

    // Single auto-detected CTA must NOT also be present, else three buttons.
    const autoBtn = hero.getByRole('link', { name: /^DOWNLOAD DESKTOP$/i })
    await expect(autoBtn).toHaveCount(0)

    await context.close()
  })

  test('HeroSection hides every desktop CTA on mobile', async ({ browser }) => {
    const context = await browser.newContext({ userAgent: IPHONE_UA })
    const page = await context.newPage()
    await page.goto('/download')

    const hero = page.locator('section', {
      has: page.getByRole('heading', {
        name: /Run on your hardware/i,
        level: 1
      })
    })

    await expect(
      hero.getByRole('link', { name: /^DOWNLOAD DESKTOP$/i })
    ).toHaveCount(0)
    await expect(hero.getByRole('link', { name: /Windows$/ })).toHaveCount(0)
    await expect(hero.getByRole('link', { name: /macOS$/ })).toHaveCount(0)

    // GitHub install link is the only path that still applies — keep it.
    await expect(
      hero.getByRole('link', { name: /INSTALL FROM GITHUB/i })
    ).toBeVisible()

    await context.close()
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

  test('all FAQs are collapsed by default', async ({ page }) => {
    await expect(
      page.getByText(/A dedicated GPU is strongly recommended/i)
    ).toBeHidden()
    await expect(page.getByText(/ComfyUI is lightweight/i)).toBeHidden()
  })

  test('clicking a collapsed FAQ expands it', async ({ page }) => {
    const firstQuestion = page.getByRole('button', {
      name: /Do I need a GPU/i
    })
    await firstQuestion.scrollIntoViewIfNeeded()
    // Gate: wait for Vue hydration to bind aria-expanded
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'false')
    await firstQuestion.click()

    await expect(
      page.getByText(/A dedicated GPU is strongly recommended/i)
    ).toBeVisible()
  })

  test('clicking an expanded FAQ collapses it again', async ({ page }) => {
    const firstQuestion = page.getByRole('button', {
      name: /Do I need a GPU/i
    })
    await firstQuestion.scrollIntoViewIfNeeded()
    // Gate: wait for Vue hydration to bind aria-expanded
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'false')

    await firstQuestion.click()
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'true')
    await expect(
      page.getByText(/A dedicated GPU is strongly recommended/i)
    ).toBeVisible()

    await firstQuestion.click()
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'false')
    await expect(
      page.getByText(/A dedicated GPU is strongly recommended/i)
    ).toBeHidden()
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

  test('download buttons are stacked vertically', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['Pixel 5'],
      userAgent: WINDOWS_UA
    })
    const page = await context.newPage()
    await page.goto('/download')

    const hero = page.locator('section', {
      has: page.getByRole('heading', {
        name: /Run on your hardware/i,
        level: 1
      })
    })
    const downloadBtn = hero.getByRole('link', { name: /DOWNLOAD DESKTOP/i })
    const githubBtn = hero.getByRole('link', { name: /INSTALL FROM GITHUB/i })

    await expect(downloadBtn).toBeVisible()
    await expect(githubBtn).toBeVisible()

    await expect
      .poll(async () => {
        const downloadBox = await downloadBtn.boundingBox()
        const githubBox = await githubBtn.boundingBox()
        if (!downloadBox || !githubBox) return false
        return githubBox.y > downloadBox.y
      })
      .toBe(true)

    await context.close()
  })
})
