import type { Route } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'
import { MODEL_PATH } from './fixtures/modelsAccount'

const MARKETING_HERO = /AI creation engine for visual professionals/

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

test('static HTML ships the loader, not marketing, for a model page', async ({
  request
}) => {
  const html = await (await request.get(MODEL_PATH)).text()
  expect(html).toContain('data-testid="workshop-loading"')
  const beforeTemplate = html.slice(0, html.indexOf('data-astro-template'))
  expect(beforeTemplate).not.toMatch(MARKETING_HERO)
})

test('static HTML ships the loader, not marketing, for the catalogue', async ({
  request
}) => {
  const html = await (await request.get('/models/')).text()
  expect(html).toContain('data-testid="workshop-loading"')
  const beforeTemplate = html.slice(0, html.indexOf('data-astro-template'))
  expect(beforeTemplate).not.toMatch(MARKETING_HERO)
})

test('an enabled visitor never sees the marketing page on a model route', async ({
  context,
  page
}) => {
  await context.route('**/cdn-cgi/trace', (route) =>
    route.fulfill({ status: 200, contentType: 'text/plain', body: 'loc=US\n' })
  )
  await context.route('**/t.comfy.org/**', routeFlag(true))
  await page.goto(MODEL_PATH)
  await expect(page.getByText(MARKETING_HERO)).toHaveCount(0)
  await waitForIsland(page, page.getByTestId('model-detail'))
  await expect(page.getByTestId('model-detail')).toBeVisible()
  await expect(page.getByText(MARKETING_HERO)).toHaveCount(0)
})

test('returning to a model route does not flash marketing', async ({
  context,
  page
}) => {
  await context.route('**/cdn-cgi/trace', (route) =>
    route.fulfill({ status: 200, contentType: 'text/plain', body: 'loc=US\n' })
  )
  await context.route('**/t.comfy.org/**', routeFlag(true))
  await page.goto(MODEL_PATH)
  await waitForIsland(page, page.getByTestId('model-detail'))
  await page.goto('/models/')
  await waitForIsland(page, page.getByTestId('workshop-search'))
  await page.goBack()
  await expect(page.getByText(MARKETING_HERO)).toHaveCount(0)
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
  await expect(page.getByText(MARKETING_HERO).first()).toBeVisible()
})
