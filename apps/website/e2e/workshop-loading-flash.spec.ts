import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'
import { MODEL_PATH } from './fixtures/modelsAccount'

for (const path of ['/models/']) {
  test(`static HTML at ${path} paints only the loading frame`, async ({
    request
  }) => {
    const html = await (await request.get(path)).text()
    expect(html).toContain('data-testid="workshop-loading"')
    const liveDom = html
      .replace(
        /<template data-astro-template="fallback">[\s\S]*?<\/template>/g,
        ''
      )
      .replace(/<noscript>[\s\S]*?<\/noscript>/g, '')
    expect(liveDom).toContain('data-testid="workshop-loading"')
    expect(liveDom).not.toMatch(/Grok Imagine/i)
    expect(liveDom).not.toContain('data-testid="model-detail"')
    expect(liveDom).not.toContain('data-testid="model-hero"')
    expect(liveDom).not.toContain('data-testid="workshop-search"')
  })
}

test('static HTML of a model page paints the model, not a loader', async ({
  request
}) => {
  const html = await (await request.get(MODEL_PATH)).text()
  const liveDom = html.replace(
    /<(template|noscript|script|style)\b[\s\S]*?<\/\1>/g,
    ''
  )
  expect(liveDom).toContain('data-testid="model-hero"')
  expect(liveDom).toContain('data-testid="model-detail"')
  expect(liveDom).not.toContain('data-testid="workshop-loading"')
  expect(html).not.toMatch(/Grok Imagine in/i)
})

test.describe('enabled workshop', () => {
  test.beforeEach(async ({ context }) => {
    await context.route('**/cdn-cgi/trace', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/plain',
        body: 'loc=US\n'
      })
    )
    await context.route('**/t.comfy.org/**', (route) =>
      /\/(flags|decide)\//.test(route.request().url())
        ? route.fulfill({
            json: {
              featureFlags: { 'workshop-enabled': true },
              featureFlagPayloads: {}
            }
          })
        : route.abort('blockedbyclient')
    )
  })

  test('resolves to the playground without a marketing frame', async ({
    page
  }) => {
    await page.goto(MODEL_PATH)
    await expect(page.getByText(/Try Grok Imagine Now/i)).toHaveCount(0)
    await waitForIsland(page, page.getByTestId('model-detail'))
    await expect(page.getByTestId('model-detail')).toBeVisible()
    await expect(page.getByText(/Try Grok Imagine Now/i)).toHaveCount(0)
  })

  test('client-side navigation does not flash marketing', async ({ page }) => {
    await page.goto('/models/')
    await waitForIsland(page, page.getByTestId('workshop-search'))
    await page
      .getByRole('link', { name: /Grok Imagine Image/i })
      .first()
      .click()
    await expect(page.getByText(/Try Grok Imagine Now/i)).toHaveCount(0)
    await expect(page.getByTestId('model-detail')).toBeVisible()
  })
})

test('a disabled visitor gets the model page without a marketing frame', async ({
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
  const flags = page.waitForResponse((response) =>
    /t\.comfy\.org\/(flags|decide)\//.test(response.url())
  )
  await page.goto(MODEL_PATH)
  await expect(page.getByText(/Try Grok Imagine Now/i)).toHaveCount(0)
  await flags
  await expect(page.getByTestId('model-detail')).toBeVisible()
  await expect(page.getByTestId('run-rollout-note')).toBeVisible()
  await expect(page.getByText(/Try Grok Imagine Now/i)).toHaveCount(0)
})
