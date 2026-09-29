import type { BrowserContext, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'
import { publishedModelSlugs } from './fixtures/modelsCatalogue'
import { MODEL_PATH } from './fixtures/modelsAccount'
import { stubWorkshopFlags } from './fixtures/workshopFlags'

const MODEL_NAME = 'FLUX 2 Max Text-to-Image'

test('public HTML excludes catalogue and playground markup', async ({
  request
}) => {
  for (const path of ['/', '/hub/models/']) {
    const response = await request.get(path)
    expect(response.ok()).toBe(true)
    const html = await response.text()
    expect(html).not.toMatch(
      /data-testid="(?:workshop-search|model-discovery|model-hero|model-detail)"/
    )
    if (path === '/hub/models/') {
      expect(html).not.toContain('noindex')
    }
  }
})

test.describe('server HTML', () => {
  test.use({ javaScriptEnabled: false })

  test('links the model catalogue from every locale', async ({ page }) => {
    for (const [path, href] of [
      ['/', '/models/'],
      ['/pricing/', '/models/'],
      ['/zh-CN/', '/zh-CN/models/'],
      ['/zh-CN/pricing/', '/zh-CN/models/']
    ]) {
      await page.goto(path)
      await expect(page.locator(`footer a[href="${href}"]`)).toHaveCount(1)
      expect((await page.request.get(href)).ok()).toBe(true)
    }
  })
})

function recordAccountRequests(context: BrowserContext): string[] {
  const requests: string[] = []
  context.on('request', (request) => {
    if (
      /firebase|identitytoolkit|securetoken|cloud\.comfy\.org\/api\//.test(
        request.url()
      )
    )
      requests.push(request.url())
  })
  return requests
}

async function expectModelContentWithoutRun(page: Page) {
  await page.goto('/hub/models/')
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
  const accountRequests = recordAccountRequests(context)
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
  ).toHaveAttribute('href', '/seedance-2.5/')

  await expectModelContentWithoutRun(page)
  expect(accountRequests).toEqual([])
})

test('shows model content without Run when the flag is disabled', async ({
  context,
  page
}) => {
  const accountRequests = recordAccountRequests(context)
  await stubWorkshopFlags(context, {
    'workshop-auth': true,
    'workshop-enabled': false
  })
  const flags = page.waitForResponse((response) =>
    /t\.comfy\.org\/(flags|decide)\//.test(response.url())
  )
  await page.goto('/')
  await flags
  await waitForIsland(
    page,
    page.getByRole('navigation', { name: 'Main navigation' })
  )
  await expect(
    page.getByRole('link', { name: 'Models', exact: true })
  ).toHaveCount(0)

  await expectModelContentWithoutRun(page)
  expect(accountRequests).toEqual([])
})

async function expectHubHeadingAndDirectory(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'ComfyUI models'
  )
  await expect(
    page.getByTestId('models-directory').getByRole('link')
  ).toHaveCount(publishedModelSlugs.size)
}

test('/hub/models/ keeps its heading and model links when the catalogue fails', async ({
  page
}) => {
  await page.route('**/models/catalogue.json', (route) =>
    route.fulfill({ status: 500 })
  )
  await page.goto('/hub/models/')
  await expect(page.getByTestId('models-load-error')).toBeVisible()
  await expectHubHeadingAndDirectory(page)
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('/hub/models/ shows its heading and every model link', async ({ page }) => {
    await page.goto('/hub/models/')
    await expectHubHeadingAndDirectory(page)
  })

  test('a /hub/models/ directory link opens its model page', async ({ page }) => {
    await page.goto('/hub/models/')
    const link = page
      .getByTestId('models-directory')
      .getByRole('link', { name: MODEL_NAME, exact: true })
    await link.click()
    await expect(page).toHaveURL(MODEL_PATH)
    await expect(page).toHaveTitle(new RegExp(`^${MODEL_NAME} API & Playground - Comfy$`))
  })

  for (const path of ['/hub/models/']) {
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
    ).toHaveAttribute('href', '/hub/models/flux-2-pro-text-to-image/')
    await expect(page.getByTestId('workshop-loading')).toHaveCount(0)
    await expect(page.getByText(/Grok Imagine in ComfyUI/)).toHaveCount(0)
  })
})
