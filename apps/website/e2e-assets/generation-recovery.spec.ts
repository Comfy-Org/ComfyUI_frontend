import { expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'

import type { SavedGeneration } from '../src/config/workshop-generation-assets'
import { MODEL_PATH, test } from '../e2e/fixtures/modelsAccount'

test('a paid generation remains discoverable after leaving and returning @smoke', async ({
  page,
  context,
  modelsAccount
}) => {
  const requestId = '18655193-3f73-4abf-b49c-1c6a058355bc'
  const assetId = '932cad6b-c94f-4e83-bffa-84be407b0440'
  let submitted = 0
  let cancelled = 0
  let finished = false
  const generation = (): SavedGeneration => ({
    request_id: requestId,
    provider: 'bfl',
    model: 'flux-2-max',
    created_at: new Date().toISOString(),
    status: finished ? 'COMPLETED' : 'IN_PROGRESS',
    asset_save_status: finished ? 'saved' : 'pending',
    asset_outputs: finished
      ? [{ index: 0, asset_id: assetId, kind: 'image', status: 'saved' }]
      : []
  })
  await context.route('**/v2/models/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    expect(request.headers().authorization).toBe('Bearer mock-workspace-jwt')
    let body: unknown
    let status = 200
    if (request.method() === 'POST') {
      expect(url.searchParams.get('comfy_save_asset')).toBe('true')
      expect(request.headers()['comfy-usage-source']).toBe('comfy-models')
      submitted++
      status = 201
      body = {
        request_id: requestId,
        status: 'IN_QUEUE',
        comfy_save_asset: true,
        asset_save_status: 'pending'
      }
    } else if (request.method() === 'PUT') {
      cancelled++
      status = 202
      body = {}
    } else if (url.pathname === '/v2/models/requests') {
      body = { requests: submitted ? [generation()] : [] }
    } else {
      status = 202
      body = { request_id: requestId, status: 'IN_PROGRESS' }
    }
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body)
    })
  })
  await context.route(`**/api/assets/${assetId}/access`, (route) => {
    expect(route.request().headers().authorization).toBe(
      'Bearer mock-workspace-jwt'
    )
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        content_url: 'https://assets.example/saved.webp',
        expires_at: new Date(Date.now() + 900_000).toISOString()
      })
    })
  })
  await context.route('https://assets.example/saved.webp', (route) => {
    expect(route.request().headers().authorization).toBeUndefined()
    return route.fulfill({
      contentType: 'image/webp',
      path: fileURLToPath(
        new URL('../e2e/assets/placeholder-1x1.webp', import.meta.url)
      )
    })
  })
  await page.goto(`/login/?returnTo=${encodeURIComponent(MODEL_PATH)}`)
  await page.getByRole('button', { name: 'Use email instead' }).click()
  await page.getByLabel('Email').fill(modelsAccount.email)
  await page
    .getByLabel('Password', { exact: true })
    .fill(modelsAccount.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`${MODEL_PATH}$`))
  await page.getByTestId('field-prompt').fill('A teapot')
  await page.getByTestId('run-button').click()
  await expect(page).toHaveURL(new RegExp(`request_id=${requestId}`))
  await expect(
    page.getByRole('region', { name: 'Your generations' })
  ).toContainText('Generating')
  await page
    .getByRole('navigation', { name: 'Main navigation', exact: true })
    .getByRole('link', { name: 'Models', exact: true })
    .click()
  await expect(page).toHaveURL(/\/models\/?$/)
  expect(cancelled).toBe(0)
  finished = true
  await page.goto(MODEL_PATH)
  const history = page.getByRole('region', { name: 'Your generations' })
  await expect(history).toContainText(`Asset ID: ${assetId}`)
  const image = history.getByRole('img', { name: 'Generated image' })
  await expect(image).toBeVisible()
  await expect
    .poll(() =>
      image.evaluate((element: HTMLImageElement) => element.naturalWidth)
    )
    .toBeGreaterThan(0)
  expect(submitted).toBe(1)
  expect(cancelled).toBe(0)
})
