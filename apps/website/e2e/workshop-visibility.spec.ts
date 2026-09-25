import type { BrowserContext, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'
import { MODEL_PATH } from './fixtures/modelsAccount'

const MODEL_NAME = 'FLUX 2 Max Text-to-Image'

test('public HTML excludes catalogue and playground markup', async ({
  request
}) => {
  for (const path of ['/', '/models/']) {
    const response = await request.get(path)
    expect(response.ok()).toBe(true)
    const html = await response.text()
    expect(html).not.toMatch(
      /data-testid="(?:workshop-search|model-discovery|model-hero|model-detail)"/
    )
    if (path === '/models/') {
      expect(html).not.toContain('noindex')
    }
  }
})

function recordFirebaseRequests(context: BrowserContext): string[] {
  const requests: string[] = []
  context.on('request', (request) => {
    if (/firebase|identitytoolkit|securetoken/.test(request.url()))
      requests.push(request.url())
  })
  return requests
}

async function disableWorkshopFlag(context: BrowserContext) {
  await context.route('**/t.comfy.org/**', (route) =>
    /\/(flags|decide)\//.test(route.request().url())
      ? route.fulfill({
          json: {
            featureFlags: { 'workshop-auth': true, 'workshop-enabled': false },
            featureFlagPayloads: {}
          }
        })
      : route.abort('blockedbyclient')
  )
}

async function expectModelContentWithoutRun(page: Page) {
  await page.goto('/models/')
  await expect(page.getByTestId('workshop-search')).toBeVisible()
  await expect(page.getByText(/Grok Imagine in ComfyUI/)).toHaveCount(0)

  await page.goto(MODEL_PATH)
  await expect(
    page.getByRole('heading', { level: 1, name: MODEL_NAME })
  ).toBeVisible()
  await expect(page.getByTestId('run-rollout-note')).toBeVisible()
  await expect(page.getByTestId('run-button')).toHaveCount(0)
  await expect(page.getByTestId('playground-output')).toBeVisible()
  await expect(page.getByText(/Grok Imagine in ComfyUI/)).toHaveCount(0)
}

test('shows model content without Run when PostHog is unavailable', async ({
  context,
  page
}) => {
  const firebaseRequests = recordFirebaseRequests(context)
  await page.goto('/')
  await expect(
    page.getByRole('link', { name: 'Models', exact: true })
  ).toHaveCount(0)
  await expect(page.getByTestId('model-discovery')).toHaveCount(0)
  await expect(
    page.getByRole('link', { name: 'Sign in', exact: true })
  ).toHaveCount(0)
  await page
    .getByRole('link', { name: 'Explore Seedance 2.5' })
    .scrollIntoViewIfNeeded()
  await expect(
    page.getByRole('link', { name: 'Explore Seedance 2.5' })
  ).toHaveAttribute('href', '/seedance-2.5')

  await expectModelContentWithoutRun(page)
  expect(firebaseRequests).toEqual([])
})

test('shows model content without Run when the flag is disabled', async ({
  context,
  page
}) => {
  const firebaseRequests = recordFirebaseRequests(context)
  await disableWorkshopFlag(context)
  await page.goto('/')
  await waitForIsland(
    page,
    page.getByRole('navigation', { name: 'Main navigation' })
  )
  await expect(
    page.getByRole('link', { name: 'Models', exact: true })
  ).toHaveCount(0)

  await expectModelContentWithoutRun(page)
  expect(firebaseRequests).toEqual([])
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  for (const path of ['/models/']) {
    test(`${path} shows no loader or error panel`, async ({ page }) => {
      await page.goto(path)
      await expect(page.getByTestId('workshop-loading')).toBeHidden()
      await expect(page.getByTestId('models-load-error')).toHaveCount(0)
      await expect(page.getByTestId('workshop-search')).toHaveCount(0)
      await expect(
        page.getByRole('link', { name: /Grok Imagine/i }).first()
      ).toBeVisible()
    })
  }

  test('a model page shows the model and its related models', async ({
    page
  }) => {
    await page.goto(MODEL_PATH)
    await expect(
      page.getByRole('heading', { level: 1, name: MODEL_NAME })
    ).toBeVisible()
    await expect(
      page.getByText('Generates an image from text with up to 9 reference')
    ).toBeVisible()
    await expect(page.getByTestId('model-price')).toContainText('credits')
    await expect(
      page
        .getByTestId('related-models')
        .getByRole('link', { name: /FLUX 2 Pro/ })
        .first()
    ).toHaveAttribute('href', '/models/bfl--flux-2-pro--generate-images/')
    await expect(page.getByTestId('workshop-loading')).toHaveCount(0)
    await expect(page.getByText(/Grok Imagine in ComfyUI/)).toHaveCount(0)
  })
})
