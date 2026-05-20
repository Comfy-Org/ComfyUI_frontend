import { fileURLToPath } from 'node:url'

import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

const caseStudyVideoPath = fileURLToPath(
  new URL(
    '../../../public/assets/images/cloud-subscription.webm',
    import.meta.url
  )
)

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

  test('CaseStudySpotlight CTA sizes to its content, not the column', async ({
    page
  }) => {
    const contentColumn = page.getByTestId('case-study-content')
    const cta = contentColumn.getByRole('link', {
      name: /see all case studies/i
    })

    await cta.scrollIntoViewIfNeeded()
    await expect(cta).toBeVisible()

    const [columnBox, ctaBox] = await Promise.all([
      contentColumn.boundingBox(),
      cta.boundingBox()
    ])

    expect(columnBox).not.toBeNull()
    expect(ctaBox).not.toBeNull()
    expect(ctaBox!.width).toBeLessThan(columnBox!.width * 0.7)
  })

  test('CaseStudySpotlight CTA has breathing room above it on mobile @mobile', async ({
    page
  }) => {
    const contentColumn = page.getByTestId('case-study-content')
    const subheading = contentColumn.getByText(
      /Videos & case studies from teams/i
    )
    const cta = contentColumn.getByRole('link', {
      name: /see all case studies/i
    })

    await cta.scrollIntoViewIfNeeded()

    const [subBox, ctaBox] = await Promise.all([
      subheading.boundingBox(),
      cta.boundingBox()
    ])

    expect(subBox).not.toBeNull()
    expect(ctaBox).not.toBeNull()
    expect(ctaBox!.y - (subBox!.y + subBox!.height)).toBeGreaterThanOrEqual(24)
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
    await secondFeature.click()

    await expect(
      secondFeature.getByText(/If you are new to ComfyUI/)
    ).toBeVisible()

    const firstFeature = page
      .getByRole('button', { name: /Full Control with Nodes/i })
      .first()

    await expect(firstFeature).not.toHaveClass(/bg-primary-comfy-yellow/)
    await expect(secondFeature).toHaveClass(/bg-primary-comfy-yellow/)
  })
})

test.describe('Video player @interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(
      'https://media.comfy.org/website/customers/blackmath/video.webm',
      (route) =>
        route.fulfill({
          contentType: 'video/webm',
          path: caseStudyVideoPath
        })
    )

    await page.goto('/')
  })

  test('clicking play advances playback', async ({ page }) => {
    const section = page.locator('section', {
      has: page.getByText('Customer Stories')
    })
    const video = section.locator('video')

    await expect
      .poll(
        async () =>
          video.evaluate((element: HTMLVideoElement) => element.duration),
        { timeout: 15_000 }
      )
      .toBeGreaterThan(0)

    await section.getByRole('button', { name: 'Play' }).click()

    await expect
      .poll(async () =>
        video.evaluate((element: HTMLVideoElement) => element.currentTime)
      )
      .toBeGreaterThan(0)
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
    await expect(cloudLink).toHaveAttribute('href', 'https://cloud.comfy.org')
  })
})

test.describe('Attribution preservation @smoke', () => {
  test('decorates owned Comfy links with ad attribution', async ({ page }) => {
    await page.goto(
      '/?utm_source=google&utm_medium=cpc&utm_campaign=spring&gclid=abc123'
    )

    await expect(
      page
        .getByTestId('desktop-nav-cta')
        .locator(
          'a[href="https://cloud.comfy.org/?utm_source=google&utm_medium=cpc&utm_campaign=spring&gclid=abc123"]'
        )
    ).toBeVisible()

    const productCardsSection = page.locator('section', {
      has: page.getByRole('heading', { name: /The AI creation/ })
    })
    await expect(
      productCardsSection.locator(
        'a[href="/cloud?utm_source=google&utm_medium=cpc&utm_campaign=spring&gclid=abc123"]'
      )
    ).toBeVisible()
  })

  test('uses stored attribution after same-origin navigation', async ({
    page
  }) => {
    await page.goto('/?utm_source=google&utm_medium=cpc')
    await page.goto('/cloud')

    const cloudCta = page.getByRole('link', {
      name: /TRY COMFY CLOUD FOR FREE/i
    })
    await expect(cloudCta).toHaveAttribute(
      'href',
      'https://cloud.comfy.org/?utm_source=google&utm_medium=cpc'
    )
  })
})
