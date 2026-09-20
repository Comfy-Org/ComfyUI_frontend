import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'
import { MODEL_PATH } from './fixtures/modelsAccount'

test('public HTML excludes catalogue and playground markup', async ({
  request
}) => {
  for (const path of ['/', '/models/', MODEL_PATH]) {
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

test('keeps the public site when PostHog is unavailable', async ({ page }) => {
  const dataRequests: string[] = []
  page.on('request', (request) => {
    if (/\/models\/.*(?:page|catalogue)\.json$/.test(request.url()))
      dataRequests.push(request.url())
  })
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
  await expect(
    page.getByRole('link', { name: /Grok Imagine/i }).first()
  ).toBeVisible()
  await expect(page.getByTestId('workshop-search')).toHaveCount(0)
  await page.goto(MODEL_PATH)
  await expect(page.getByTestId('model-hero')).toHaveCount(0)
  await expect(page.getByTestId('model-detail')).toHaveCount(0)
  expect(dataRequests).toEqual([])
})

test('keeps the public Models page when the flag is disabled', async ({
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
  await expect(page.getByTestId('workshop-search')).toHaveCount(0)
  await expect(
    page.getByRole('link', { name: /Grok Imagine/i }).first()
  ).toBeVisible()
})

test('does not initialize Firebase on public pages', async ({
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
  await expect(
    page.getByRole('link', { name: /Grok Imagine/i }).first()
  ).toBeVisible()
  expect(firebaseRequests).toEqual([])
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('renders the public Models page without exposing the catalogue', async ({
    page
  }) => {
    await page.goto('/models/')
    await expect(page.getByTestId('workshop-loading')).toBeHidden()
    await expect(page.getByTestId('workshop-search')).toHaveCount(0)
    await expect(
      page.getByRole('link', { name: /Grok Imagine/i }).first()
    ).toBeVisible()
  })
})
