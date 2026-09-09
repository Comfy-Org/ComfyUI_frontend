import type { Page, Route } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

const MODEL_PATH = '/models/bfl--flux-2-max/'
const WORKSHOP_EMAIL = 'workshop-e2e@test.comfy.org'

function jsonRoute(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) }
}

async function mockAuthenticatedReturn(page: Page) {
  await page.route('**/cdn-cgi/trace', (route) =>
    route.fulfill({ status: 200, contentType: 'text/plain', body: 'loc=US\n' })
  )
  await page.route('**/t.comfy.org/**', (route) =>
    /\/(flags|decide)\//.test(route.request().url())
      ? route.fulfill(
          jsonRoute({
            featureFlags: { 'workshop-auth': true },
            featureFlagPayloads: {}
          })
        )
      : route.abort('blockedbyclient')
  )
  await page.route('**/api/auth/token', (route) =>
    route.fulfill(
      jsonRoute({
        token: 'mock-workspace-jwt',
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        workspace: { id: 'ws-personal', name: 'Personal', type: 'personal' },
        role: 'owner',
        permissions: []
      })
    )
  )
  await page.route('**/api/billing/balance', (route) =>
    route.fulfill(jsonRoute({ effective_balance_micros: 583_200 }))
  )
  await page.route('**/customers', (route) =>
    route.fulfill(jsonRoute({ id: 'e2e-customer-id' }, 201))
  )
  await page.route(
    '**/identitytoolkit.googleapis.com/**',
    async (route: Route) => {
      if (route.request().url().includes('accounts:signInWithPassword')) {
        return route.fulfill(
          jsonRoute({
            localId: 'e2e-workshop-user',
            email: WORKSHOP_EMAIL,
            idToken: 'mock-firebase-id-token',
            registered: true,
            refreshToken: 'mock-refresh-token',
            expiresIn: '3600'
          })
        )
      }
      if (route.request().url().includes('accounts:lookup')) {
        return route.fulfill(
          jsonRoute({
            users: [
              {
                localId: 'e2e-workshop-user',
                email: WORKSHOP_EMAIL,
                emailVerified: true
              }
            ]
          })
        )
      }
      return route.fallback()
    }
  )
  await page.route('**/securetoken.googleapis.com/**', (route) =>
    route.fulfill(
      jsonRoute({
        access_token: 'mock-firebase-id-token',
        expires_in: '3600',
        token_type: 'Bearer',
        refresh_token: 'mock-refresh-token',
        id_token: 'mock-firebase-id-token',
        user_id: 'e2e-workshop-user',
        project_id: 'dreamboothy-dev'
      })
    )
  )
}

test.describe('Workshop V2', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem('comfy-workshop-version', 'v2')
    )
  })

  test('mirrors comfy.org/workflows and links partner models to their page', async ({
    page
  }) => {
    await page.goto('/models/')
    const hub = page.getByTestId('workshop-hub')
    await expect(hub.getByTestId('hub-heading')).toContainText('Browse models')
    await expect(hub.getByTestId('hub-use-case-generate-images')).toBeVisible()
    await expect(hub.getByTestId('hub-card').first()).toBeVisible()
    await hub.getByTestId('hub-tab-comfyApps').click()
    await expect(hub.getByTestId('hub-card').first()).toHaveAttribute(
      'data-app',
      'true'
    )
    await hub.getByTestId('hub-tab-all').click()
    await hub.getByTestId('workshop-search').fill('minimax h3')
    await expect(hub.getByTestId('hub-card-link').first()).toContainText(
      'MiniMax H3'
    )
    await hub.getByTestId('hub-filter').click()
    await page.getByTestId('hub-facet-models').click()
    await page.getByRole('option', { name: 'Flux', exact: true }).click()
    await expect(hub.getByTestId('hub-filter-count')).toHaveText('1')
  })

  test('workflow cards open a detail page with the model playground', async ({
    page
  }) => {
    await page.goto('/models/?q=minimax%20h3')
    const hub = page.getByTestId('workshop-hub')
    await hub.getByTestId('hub-card-link').first().click()
    await page.waitForURL(/\/models\/workflows\/video_minimax_h3_i2v\/?$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'MiniMax H3'
    )
    await expect(page.getByTestId('playground-tab')).toBeVisible()
    await expect(page.getByTestId('clone-button')).toHaveAttribute(
      'href',
      /video_minimax_h3_i2v\.json$/
    )
    await page.getByTestId('tab-details').click()
    await expect(page.getByTestId('workflow-io')).toContainText('image')
    await expect(
      page.getByTestId('related-workflows').getByTestId('hub-card')
    ).toHaveCount(8)
  })
})

test.describe('Workshop catalog', () => {
  test('lists partner models by what they do and filters by search', async ({
    page
  }) => {
    await page.goto('/models/?version=v1.2')
    const grid = page.getByTestId('workshop-models-grid')
    const cards = grid.getByTestId('workshop-model-card')
    await expect(cards.first()).toBeVisible()
    await expect(page.getByTestId('workshop-tabs')).toHaveCount(0)

    const all = await cards.count()
    await page.getByTestId('use-case-edit-images').click()
    await expect(cards.first()).toBeVisible()
    expect(await cards.count()).toBeLessThan(all)
    await page.getByTestId('use-case-all').click()
    await expect(cards).toHaveCount(all)

    await page.getByTestId('workshop-search').fill('kling')
    await expect(cards.first()).toContainText('Kling')

    await page.getByTestId('workshop-search').fill('no such model')
    await expect(page.getByTestId('workshop-empty')).toBeVisible()
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(cards.first()).toBeVisible()
  })

  test('the rows listing browses category rows and drills into one', async ({
    page
  }) => {
    await page.goto('/models/')
    const sections = page.getByTestId('workshop-sections')
    await expect(sections).toBeVisible()
    await expect(page.getByTestId('workshop-use-cases')).toHaveCount(0)

    const videos = page.getByTestId('section-generate-videos')
    const rowHeading = await videos
      .getByRole('heading', { level: 2 })
      .innerText()
    const promisedCount = Number(rowHeading.match(/(\d+)\s*$/)?.[1])
    expect(promisedCount).toBeGreaterThan(0)

    await videos.getByTestId('section-generate-videos-open').click()

    const cards = page
      .getByTestId('workshop-models-grid')
      .getByTestId('workshop-model-card')
    await expect(sections).toHaveCount(0)
    await expect(cards).toHaveCount(promisedCount)
    await expect(page.getByTestId('workshop-use-cases')).toHaveCount(0)
    await expect(page.getByTestId('workshop-hero')).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Generate videos'
    )

    await page.getByTestId('section-back').click()
    await expect(page.getByTestId('workshop-sections')).toBeVisible()
    await expect(page.getByTestId('workshop-hero')).toBeVisible()
  })

  test('model cards open the model detail page', async ({ page }) => {
    await page.goto('/models/')
    await page.getByTestId('workshop-search').fill('kling avatar')
    await page.getByRole('heading', { level: 1 }).click()
    await page.getByTestId('workshop-model-card').first().click()
    await expect(page).toHaveURL(/\/models\/kling--avatar\/?$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Kling Avatar'
    )
    await expect(
      page
        .getByTestId('related-models')
        .getByTestId('workshop-model-card')
        .first()
    ).toBeVisible()
  })

  test('the filter menu drills into a facet and narrows the grid', async ({
    page
  }) => {
    await page.goto('/models/')
    const cards = page
      .getByTestId('workshop-models-grid')
      .getByTestId('workshop-model-card')
    await page.getByTestId('workshop-filter').click()
    await page.getByTestId('workshop-facet-capability').click()
    await page.getByTestId('filter-capability-upscale').click()
    expect(await cards.count()).toBeGreaterThan(0)
    await expect(
      page.getByTestId('workshop-facet-capability-count')
    ).toHaveText('1')
    await expect(page.getByTestId('workshop-filter-count')).toHaveText('1')
    await page.getByTestId('workshop-filter-clear').click()
    await expect(page.getByTestId('workshop-sections')).toBeVisible()
  })

  test('model tags deep-link into a filtered catalog', async ({ page }) => {
    await page.goto('/models/topaz--image-enhance/')
    const tag = page
      .getByTestId('model-tags')
      .getByRole('link', { name: 'Upscale' })
    await expect(tag).toHaveAttribute('href', '/models?capability=upscale')
    await tag.click()
    await expect(page).toHaveURL(/\/models\/?\?capability=upscale$/)
    await expect(page.getByTestId('workshop-filter-count')).toHaveText('1')
    await expect(
      page
        .getByTestId('workshop-models-grid')
        .getByTestId('workshop-model-card')
    ).not.toHaveCount(0)
  })

  test('the hero medium deep-links into the catalog', async ({ page }) => {
    await page.goto('/models/kling--avatar/')
    await page
      .getByTestId('model-hero')
      .getByRole('link', { name: 'Video', exact: true })
      .click()
    await expect(page).toHaveURL(/\/models\/?\?modality=video$/)
    await expect(page.getByTestId('workshop-filter-count')).toHaveText('1')
  })

  test('homepage model releases open their Workshop model', async ({
    page
  }) => {
    await page.goto('/')
    const explore = page.getByRole('link', { name: /Explore Seedance/i })
    await expect(explore).toHaveAttribute(
      'href',
      '/models/byteplus--seedance-2-5-text-to-video/'
    )
  })
})

test.describe('Model playground', () => {
  test('puts data-declared parameters in the Advanced disclosure', async ({
    page
  }) => {
    await page.goto('/models/meshy--text-to-model/')
    const advanced = page.getByTestId('playground-advanced')
    await expect(advanced).toBeVisible()
    await advanced.locator('summary').click()
    await expect(page.getByTestId('field-symmetry_mode')).toBeVisible()
    await expect(page.getByTestId('field-ultra_mode')).toBeVisible()
  })

  test('signs in through real auth and returns with the form intact', async ({
    page
  }) => {
    await mockAuthenticatedReturn(page)
    await page.goto(MODEL_PATH)
    const run = page.getByTestId('run-button')
    await expect(run).toHaveAttribute('data-gate', 'signedOut')
    await expect(run).toHaveAttribute('href', /\/login\/\?returnTo=/)

    const prompt = 'a capybara in a trench coat'
    await page.getByTestId('field-prompt').fill(prompt)
    await run.click()
    await expect(page).toHaveURL(/\/login\/\?returnTo=/)
    await page.getByRole('button', { name: 'Use email instead' }).click()
    await page.getByLabel('Email').fill(WORKSHOP_EMAIL)
    await page
      .getByLabel('Password', { exact: true })
      .fill('correct-horse-battery-staple')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    await expect(page).toHaveURL(new RegExp(`${MODEL_PATH}$`))
    await expect(page.getByTestId('run-button')).toHaveAttribute(
      'data-gate',
      'unavailable',
      { timeout: 15_000 }
    )
    await expect(page.getByTestId('run-button')).toBeDisabled()
    await expect(page.getByTestId('field-prompt')).toHaveValue(prompt)
  })

  test('API tab mirrors the form values', async ({ page }) => {
    await page.goto(MODEL_PATH)
    await page.getByTestId('field-prompt').fill('neon street at night')
    await page.getByTestId('tab-api').click()
    await expect(page.getByTestId('snippet')).toContainText(
      'neon street at night'
    )
    await expect(page.getByTestId('snippet')).toContainText('bfl/flux-2-max')
    await page.getByTestId('snippet-curl').click()
    await expect(page.getByTestId('snippet')).toContainText('POST https://')
  })

  test('examples open in the playground with their settings', async ({
    page
  }) => {
    await page.goto(MODEL_PATH)
    await expect(page.getByTestId('playground-output')).toHaveAttribute(
      'data-state',
      'example'
    )
    await expect(page.getByTestId('field-prompt')).not.toHaveValue('')
    await page.getByTestId('field-prompt').fill('')
    await page.getByTestId('example-card').first().click()
    await expect(page.getByTestId('playground-tab')).toBeVisible()
    await expect(page.getByTestId('field-prompt')).not.toHaveValue('')
  })
})
