import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'
import { MODEL_PATH } from './fixtures/modelsAccount'

// The Models pages are public content (FE-2770): the built HTML carries the
// catalogue and each model for every visitor, and the Workshop flag decides
// only whether the Run button works and whether the Models tab shows.

function textOf(html: string, selector: RegExp): string {
  const [, inner = ''] = html.match(selector) ?? []
  return inner
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

test('static HTML at /models/ links every model and paints no marketing frame', async ({
  request
}) => {
  const html = await (await request.get('/models/')).text()
  expect(html).toContain('data-testid="workshop-hero"')
  expect(html).toContain('data-testid="models-directory"')
  expect(html).toContain(`href="${MODEL_PATH}"`)
  expect(html).not.toMatch(/Grok Imagine in ComfyUI/i)
  expect(html).not.toContain('data-testid="workshop-search"')
  expect(html).not.toContain('data-testid="workshop-loading"')
})

test('static HTML at a model page carries that model, not a showcase', async ({
  request
}) => {
  const html = await (await request.get(MODEL_PATH)).text()
  const name = textOf(html, /<title>(.+?) · Models - Comfy<\/title>/)
  expect(name).not.toBe('')
  expect(textOf(html, /<h1[^>]*>([\s\S]*?)<\/h1>/)).toBe(name)
  expect(html).toContain('data-testid="model-hero"')
  expect(html).toContain('data-testid="model-price"')
  expect(html).toContain('data-testid="related-models"')
  expect(html).not.toMatch(/Grok Imagine/i)
  expect(html).not.toContain('data-testid="model-detail"')
})

function jsonLdGraph(html: string): { '@type': string; name?: string }[] {
  const [, json = '{}'] =
    html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) ??
    []
  return (JSON.parse(json) as { '@graph': { '@type': string }[] })['@graph']
}

test('a model page declares itself to search and answer engines', async ({
  request
}) => {
  const html = await (await request.get(MODEL_PATH)).text()
  const name = textOf(html, /<title>(.+?) · Models - Comfy<\/title>/)
  expect(html).not.toContain('noindex')
  const graph = jsonLdGraph(html)
  expect(graph.map((node) => node['@type'])).toEqual([
    'Organization',
    'WebSite',
    'WebPage',
    'BreadcrumbList',
    'SoftwareApplication'
  ])
  expect(graph.find((node) => node['@type'] === 'SoftwareApplication')).toEqual(
    expect.objectContaining({
      name,
      offers: expect.objectContaining({ priceCurrency: 'USD' })
    })
  )
  const sitemap = await (await request.get('/sitemap-0.xml')).text()
  expect(sitemap).toContain(`<loc>https://comfy.org${MODEL_PATH}</loc>`)
})

test('the catalogue lists every model for search engines', async ({
  request
}) => {
  const html = await (await request.get('/models/')).text()
  const list = jsonLdGraph(html).find((node) => node['@type'] === 'ItemList')
  expect(list).toEqual(
    expect.objectContaining({
      numberOfItems: expect.any(Number),
      itemListElement: expect.arrayContaining([
        expect.objectContaining({ url: `https://comfy.org${MODEL_PATH}` })
      ])
    })
  )
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

  test('adds the playground under the static hero without a marketing frame', async ({
    page
  }) => {
    await page.goto(MODEL_PATH)
    await expect(page.getByTestId('model-hero')).toBeVisible()
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

test('a disabled visitor keeps the model page and loses only Run and the Models tab', async ({
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
  await flags
  await expect(page.getByTestId('model-hero')).toBeVisible()
  await expect(page.getByTestId('model-detail')).toBeVisible()
  await expect(page.getByTestId('run-button')).toHaveAttribute(
    'data-gate',
    'unavailable'
  )
  await expect(
    page.getByRole('link', { name: 'Models', exact: true })
  ).toHaveCount(0)
  await expect(page.getByText(/Grok Imagine/i)).toHaveCount(0)
})
