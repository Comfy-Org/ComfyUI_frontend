import { fileURLToPath } from 'node:url'

import { expect, test } from '@playwright/test'

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

  test('playback advances progress and clicking the scrubber seeks', async ({
    page
  }) => {
    const section = page.locator('section', {
      has: page.getByText('Customer Stories')
    })
    const video = section.locator('video')
    const scrubber = section.getByRole('slider', { name: 'Seek' })

    await expect
      .poll(async () =>
        video.evaluate((element: HTMLVideoElement) => element.duration)
      )
      .toBeGreaterThan(0)

    const loadedDuration = await video.evaluate(
      (element: HTMLVideoElement) => element.duration
    )

    await expect
      .poll(async () => Number(await scrubber.getAttribute('aria-valuemax')))
      .toBeGreaterThan(0)

    await expect(scrubber).toHaveAttribute('aria-valuenow', '0')

    await section.getByRole('button', { name: 'Play' }).click()

    await expect
      .poll(async () =>
        video.evaluate((element: HTMLVideoElement) => element.currentTime)
      )
      .toBeGreaterThan(0)

    await expect
      .poll(async () => Number(await scrubber.getAttribute('aria-valuenow')))
      .toBeGreaterThan(0)

    const scrubberBox = await scrubber.boundingBox()

    expect(scrubberBox).not.toBeNull()

    if (!scrubberBox) {
      throw new Error('Expected video scrubber bounding box')
    }

    await scrubber.click({
      position: {
        x: scrubberBox.width * 0.75,
        y: scrubberBox.height / 2
      }
    })

    await expect
      .poll(async () => Number(await scrubber.getAttribute('aria-valuenow')))
      .toBeGreaterThanOrEqual(loadedDuration * 0.5)

    await expect
      .poll(async () =>
        video.evaluate((element: HTMLVideoElement) => element.currentTime)
      )
      .toBeGreaterThanOrEqual(loadedDuration * 0.5)
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
