import { join } from 'node:path'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { repoRoot } from '@website/paths'

import { test } from './fixtures/workshopVisibility'

const caseStudyVideoPath = join(
  repoRoot,
  'public/assets/images/cloud-subscription.webm'
)

test.describe('Homepage @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Comfy - Professional Control of Visual AI')
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

  test('ModelReleaseSection carousel shows the active slide', async ({
    page
  }) => {
    const activeSlide = page.locator('article[aria-hidden="false"]', {
      hasText: 'New Model Release'
    })
    await expect(activeSlide.getByText('New Model Release')).toBeVisible()
    const cta = activeSlide.getByRole('link', { name: 'Explore Seedance 2.5' })
    await cta.scrollIntoViewIfNeeded()
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute(
      'href',
      '/hub/models/seedance-2-5-text-to-video/'
    )
  })

  test('Hub banner leads into the Hub', async ({ page }) => {
    const banner = page.getByTestId('home-hub-banner')
    await expect(
      banner.getByRole('heading', { name: 'Everything you need to make it' })
    ).toBeVisible()
    await expect(
      banner.getByRole('link', { name: 'Explore the Hub' })
    ).toHaveAttribute('href', '/hub/')
    await expect(banner.getByRole('link', { name: /^Models/ })).toHaveAttribute(
      'href',
      '/hub/models/'
    )
  })

  test('FeaturedWorkflowsSection carousel is visible', async ({ page }) => {
    const carousel = page.locator('[aria-roledescription="carousel"]')
    await expect(carousel).toBeVisible()
    await expect(
      carousel.getByRole('link', { name: 'FLUX 3 Video: Text to Video' })
    ).toBeVisible()
  })

  test('ProductShowcase section is visible', async ({ page }) => {
    await expect(page.getByText('HOW', { exact: true }).first()).toBeVisible()
    await expect(
      page.getByText(/Connect models, processing steps, and outputs/)
    ).toBeVisible()
  })

  test('IndustriesSection is visible', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: 'VFX & Animation' })
    ).toBeVisible()
    await expect(page.getByText(/Powered by 60,000\+ nodes/)).toBeVisible()
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
    const cards = section
      .getByRole('group', { name: 'Products' })
      .getByRole('link')
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
})

test.describe('Product showcase accordion @interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  // The active tab renders as a link and inactive tabs as buttons.
  const featureTab = (page: Page, name: string) =>
    page
      .getByRole('button')
      .or(page.getByRole('link'))
      .filter({
        has: page.getByRole('heading', { level: 3, name, exact: true })
      })

  test('first feature is active by default', async ({ page }) => {
    await expect(
      page.getByText(/Build powerful AI pipelines by connecting nodes/).first()
    ).toBeVisible()
  })

  test('clicking inactive feature expands it and collapses previous', async ({
    page
  }) => {
    const secondFeature = featureTab(page, 'Comfy Agent')

    await secondFeature.scrollIntoViewIfNeeded()
    await secondFeature.click()

    await expect(
      secondFeature.getByText(/Comfy Agent builds and runs the workflow/)
    ).toBeVisible()

    const firstFeature = featureTab(page, 'Full Control with Nodes')

    await expect(firstFeature).not.toHaveClass(/bg-primary-comfy-yellow/)
    await expect(secondFeature).toHaveClass(/bg-primary-comfy-yellow/)
  })

  test('third feature shows the API demo video on mobile @mobile', async ({
    page
  }) => {
    const thirdFeature = featureTab(page, 'Comfy API')

    await thirdFeature.scrollIntoViewIfNeeded()
    await thirdFeature.click()

    await expect(thirdFeature.getByText(/with one API/)).toBeVisible()
    // The CSS-hidden desktop copy is also in the DOM; target the mobile one.
    await expect(
      page.locator('video[src$="homepage-api-cut-04.mp4"]:visible')
    ).toBeVisible()
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
    const products = section.getByRole('group', { name: 'Products' })

    for (const href of [
      '/download/',
      '/cloud/',
      '/platform/',
      '/enterprise/'
    ]) {
      await expect(products.locator(`a[href="${href}"]`)).toBeVisible()
    }
  })
})

test.describe('Get started section links @smoke', () => {
  test('has download and cloud links', async ({ page }) => {
    await page.goto('/')

    const section = page.locator('section', {
      has: page.getByRole('heading', { name: 'Get started in minutes' })
    })

    const downloadLink = section.getByRole('link', { name: 'Download Desktop' })
    await expect(downloadLink).toBeVisible()
    await expect(downloadLink).toHaveAttribute('href', '/download/')

    const cloudLink = section.getByRole('link', { name: 'Try Cloud for free' })
    await expect(cloudLink).toBeVisible()
    await expect(cloudLink).toHaveAttribute(
      'href',
      /^https:\/\/cloud\.comfy\.org\//
    )
  })
})

test.describe('Home Hub banner @interaction', () => {
  test.beforeEach(async ({ context }) => {
    await context.route('**/t.comfy.org/**', (route) =>
      /\/(flags|decide)\//.test(route.request().url())
        ? route.fulfill({
            json: {
              featureFlags: {
                'workshop-enabled': true,
                'workshop-workflows-enabled': true,
                'workshop-apps-enabled': true
              },
              featureFlagPayloads: {}
            }
          })
        : route.abort('blockedbyclient')
    )
  })

  test('leads into the Hub with its three entries', async ({ page }) => {
    await page.goto('/')
    const banner = page.getByTestId('home-hub-banner')
    await expect(banner).toHaveAttribute('data-design', 'entries')
    await expect(
      banner.getByRole('link', { name: /^Workflows/ })
    ).toHaveAttribute('href', '/hub/workflows/')
    await expect(
      banner.getByRole('link', { name: 'Explore the Hub' })
    ).toHaveAttribute('href', '/hub/')
  })
})
