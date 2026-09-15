import type { Route } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'
import { MODEL_PATH } from './fixtures/modelsAccount'

const MARKETING_LINK = /Grok Imagine/i
const MARKETING_ONLY = /Try Grok Imagine Now/i

function routeFlag(enabled: boolean) {
  return (route: Route) =>
    /\/(flags|decide)\//.test(route.request().url())
      ? route.fulfill({
          json: {
            featureFlags: { 'workshop-enabled': enabled },
            featureFlagPayloads: {}
          }
        })
      : route.abort('blockedbyclient')
}

function allowUsRegion(route: Route) {
  return route.fulfill({
    status: 200,
    contentType: 'text/plain',
    body: 'loc=US\n'
  })
}

test('static HTML paints the loading frame, marketing stays inert', async ({
  request
}) => {
  for (const path of ['/models/', MODEL_PATH]) {
    const html = await (await request.get(path)).text()
    expect(html).toContain('data-testid="workshop-loading"')
    const liveDom = html
      .replace(
        /<template data-astro-template="fallback">[\s\S]*?<\/template>/g,
        ''
      )
      .replace(/<noscript>[\s\S]*?<\/noscript>/g, '')
    expect(liveDom).toContain('data-testid="workshop-loading"')
    expect(liveDom).not.toMatch(MARKETING_LINK)
    expect(liveDom).not.toContain('data-testid="model-detail"')
    expect(liveDom).not.toContain('data-testid="model-hero"')
    expect(liveDom).not.toContain('data-testid="workshop-search"')
  }
})

test('an enabled visitor resolves to the playground without a marketing frame', async ({
  context,
  page
}) => {
  await context.route('**/cdn-cgi/trace', allowUsRegion)
  await context.route('**/t.comfy.org/**', routeFlag(true))
  await page.goto(MODEL_PATH)
  await expect(page.getByText(MARKETING_ONLY)).toHaveCount(0)
  await waitForIsland(page, page.getByTestId('model-detail'))
  await expect(page.getByTestId('model-detail')).toBeVisible()
  await expect(page.getByText(MARKETING_ONLY)).toHaveCount(0)
})

test('a client-side navigation into a model route does not flash marketing', async ({
  context,
  page
}) => {
  await context.route('**/cdn-cgi/trace', allowUsRegion)
  await context.route('**/t.comfy.org/**', routeFlag(true))
  await page.goto('/models/')
  await waitForIsland(page, page.getByTestId('workshop-search'))
  await page
    .getByRole('link', { name: /Grok Imagine Image/i })
    .first()
    .click()
  await expect(page.getByText(MARKETING_ONLY)).toHaveCount(0)
  await expect(page.getByTestId('model-detail')).toBeVisible()
})

test('a disabled visitor still gets the public marketing page', async ({
  context,
  page
}) => {
  await context.route('**/t.comfy.org/**', routeFlag(false))
  const flags = page.waitForResponse((response) =>
    /t\.comfy\.org\/(flags|decide)\//.test(response.url())
  )
  await page.goto(MODEL_PATH)
  await flags
  await expect(page.getByTestId('model-detail')).toHaveCount(0)
  await expect(page.getByText(MARKETING_LINK).first()).toBeVisible()
})
