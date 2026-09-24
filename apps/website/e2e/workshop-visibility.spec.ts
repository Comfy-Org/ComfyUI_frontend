import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'
import { MODEL_PATH } from './fixtures/modelsAccount'

test('public HTML carries the catalogue and the model, never the island markup', async ({
  request
}) => {
  for (const path of ['/', '/models/', MODEL_PATH]) {
    const response = await request.get(path)
    expect(response.ok()).toBe(true)
    const html = await response.text()
    expect(html).not.toMatch(
      /data-testid="(?:workshop-search|model-discovery|model-detail)"/
    )
    if (path === '/models/') {
      expect(html).toContain('data-testid="models-directory"')
      expect(html).not.toContain('noindex')
    }
    if (path === MODEL_PATH) {
      expect(html).toContain('data-testid="model-hero"')
    }
  }
})

test('keeps the site usable when PostHog is unavailable', async ({ page }) => {
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

  await page.goto('/models/')
  await expect(page.getByTestId('workshop-search')).toBeVisible()
  await expect(page.getByText(/Grok Imagine in ComfyUI/i)).toHaveCount(0)
  await page.goto(MODEL_PATH)
  await expect(page.getByTestId('model-hero')).toBeVisible()
  await expect(page.getByTestId('model-detail')).toBeVisible()
  await expect(page.getByTestId('run-button')).toHaveAttribute(
    'data-gate',
    'unavailable'
  )
})

test('loads the catalogue when the flag is disabled', async ({
  context,
  page
}) => {
  await context.route('**/t.comfy.org/**', (route) =>
    /\/(flags|decide)\//.test(route.request().url())
      ? route.fulfill({
          json: {
            featureFlags: { 'workshop-enabled': false },
            featureFlagPayloads: {}
          }
        })
      : route.abort('blockedbyclient')
  )
  const response = page.waitForResponse((response) =>
    /t\.comfy\.org\/(flags|decide)\//.test(response.url())
  )
  await page.goto('/models/')
  await response
  await expect(page.getByTestId('workshop-search')).toBeVisible()
  await expect(page.getByText(/Grok Imagine in ComfyUI/i)).toHaveCount(0)
})

test('does not initialize Firebase while Workshop is disabled', async ({
  context,
  page
}) => {
  const firebaseRequests: string[] = []
  context.on('request', (request) => {
    if (/firebase|identitytoolkit|securetoken/.test(request.url())) {
      firebaseRequests.push(request.url())
    }
  })
  await context.route('**/t.comfy.org/**', (route) =>
    /\/(flags|decide)\//.test(route.request().url())
      ? route.fulfill({
          json: {
            featureFlags: { 'workshop-auth': true, 'workshop-enabled': false }
          }
        })
      : route.abort('blockedbyclient')
  )
  const flags = page.waitForResponse((response) =>
    /t\.comfy\.org\/(flags|decide)\//.test(response.url())
  )
  await page.goto('/models/')
  await flags
  await waitForIsland(
    page,
    page.getByRole('navigation', { name: 'Main navigation' })
  )
  await expect(page.getByTestId('workshop-search')).toBeVisible()
  await page.goto(MODEL_PATH)
  await waitForIsland(page, page.getByTestId('model-detail'))
  await expect(page.getByTestId('run-button')).toHaveAttribute(
    'data-gate',
    'unavailable'
  )
  expect(firebaseRequests).toEqual([])
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('renders the whole catalogue as links', async ({ page }) => {
    await page.goto('/models/')
    await expect(page.getByTestId('models-directory')).toBeVisible()
    await expect(page.getByTestId('workshop-search')).toHaveCount(0)
    await expect(
      page.getByRole('heading', { name: /Grok Imagine in ComfyUI/i })
    ).toHaveCount(0)
  })

  test('renders the model hero and hides the playground frame', async ({
    page
  }) => {
    await page.goto(MODEL_PATH)
    await expect(page.getByTestId('model-hero')).toBeVisible()
    await expect(page.getByTestId('models-loading')).toBeHidden()
    await expect(page.getByTestId('model-detail')).toHaveCount(0)
  })
})
