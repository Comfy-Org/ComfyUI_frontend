import type { BrowserContext, Page, Route } from '@playwright/test'
import { expect } from '@playwright/test'

import { test as signedOutTest } from './fixtures/blockExternalMedia'
import { MODELS_WORKSPACE_TOKEN, test } from './fixtures/modelsAccount'
import { stubWorkshopFlags } from './fixtures/workshopFlags'

const PIXEL =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const REQUESTS = '**/v2/models/vertexai/*/requests'

interface RouterTraffic {
  readonly submitted: { model: string; body: Record<string, unknown> }[]
  readonly cancelled: string[]
  /** How a queued request answers its next poll. */
  result: 'image' | 'queued' | 'text'
  /** What a submit is answered with instead of a request id. */
  refusal?: { status: number; errorType: string }
}

function json(route: Route, body: unknown, status = 200, headers = {}) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers,
    body: JSON.stringify(body)
  })
}

/** Answers Comfy Router locally: no generation is ever submitted. */
async function mockRouter(
  context: BrowserContext,
  concurrencyLimit = 5
): Promise<RouterTraffic> {
  const traffic: RouterTraffic = {
    submitted: [],
    cancelled: [],
    result: 'image'
  }
  let next = 0
  await context.route('**/customers/me/partner-node-concurrency', (route) =>
    json(route, { limit: concurrencyLimit, reason: 'default' })
  )
  await context.route(REQUESTS, (route) => {
    const request = route.request()
    expect(request.headers()['authorization']).toBe(
      `Bearer ${MODELS_WORKSPACE_TOKEN}`
    )
    if (traffic.refusal)
      return json(
        route,
        { detail: 'refused', error_type: traffic.refusal.errorType },
        traffic.refusal.status,
        { 'X-Comfy-Error-Type': traffic.refusal.errorType }
      )
    traffic.submitted.push({
      model: new URL(request.url()).pathname.split('/')[4],
      body: request.postDataJSON() as Record<string, unknown>
    })
    next += 1
    return json(
      route,
      {
        request_id: `00000000-0000-4000-8000-${String(next).padStart(12, '0')}`,
        status: 'IN_QUEUE',
        queue_position: next - 1
      },
      201
    )
  })
  await context.route(`${REQUESTS}/*/cancel`, (route) => {
    traffic.cancelled.push(route.request().url())
    return json(route, {})
  })
  await context.route(`${REQUESTS}/*`, (route) => {
    if (traffic.result === 'queued')
      return json(route, { status: 'IN_QUEUE', queue_position: 2 }, 202)
    return json(route, {
      candidates: [
        {
          content: {
            parts: [
              traffic.result === 'text'
                ? { text: 'I can describe it instead.' }
                : { inlineData: { mimeType: 'image/png', data: PIXEL } }
            ]
          },
          finishReason: 'STOP'
        }
      ],
      usageMetadata: { totalTokenCount: 1200 }
    })
  })
  return traffic
}

async function openSignedIn(
  page: Page,
  context: BrowserContext,
  account: { email: string; password: string }
) {
  // Firebase waits for gapi's onload, which the empty stub never calls.
  await context.route('https://apis.google.com/js/api.js*', (route) =>
    route.abort('blockedbyclient')
  )
  await page.goto('/darkroom/')
  await page
    .getByTestId('darkroom')
    .getByRole('link', { name: 'Sign in' })
    .click()
  await page.getByRole('button', { name: 'Use email instead' }).click()
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/darkroom/')
  await expect(
    page.getByRole('button', { name: 'Generate', exact: true })
  ).toBeEnabled()
}

async function generate(page: Page, prompt: string) {
  await page.getByTestId('darkroom-prompt').fill(prompt)
  await page.getByTestId('darkroom-prompt').press('Enter')
}

signedOutTest(
  'stays closed until Workshop is on',
  async ({ page, context }) => {
    await stubWorkshopFlags(context, { 'workshop-enabled': false })
    await page.goto('/darkroom/')
    await expect(page.getByTestId('darkroom-unavailable')).toBeVisible()
    await expect(page.getByTestId('darkroom-prompt')).toHaveCount(0)
  }
)

test('asks a visitor to sign in before anything can be made', async ({
  page,
  context
}) => {
  const router = await mockRouter(context)
  await page.goto('/darkroom/')

  await expect(page.getByTestId('darkroom-welcome')).toContainText(
    'Sign in with your Comfy account to start.'
  )
  await expect(
    page.getByTestId('darkroom').getByRole('link', { name: 'Sign in' })
  ).toHaveAttribute('href', '/login/?returnTo=%2Fdarkroom%2F')
  expect(router.submitted).toEqual([])
})

test('makes a row of images and keeps it across a reload', async ({
  page,
  context,
  modelsAccount
}) => {
  const router = await mockRouter(context)
  await openSignedIn(page, context, modelsAccount)

  await generate(page, 'A fox reading a map')

  const row = page.getByTestId('darkroom-job')
  await expect(row.getByTestId('darkroom-tile-done')).toHaveCount(4)
  await expect(row).toContainText('A fox reading a map')
  await expect(row).toContainText('Nano Banana 2.1')
  // One request per image, each with the next seed.
  await expect.poll(() => router.submitted.length).toBe(4)
  expect(router.submitted.map((sent) => sent.model)).toEqual(
    Array(4).fill('gemini-nano-banana-2.1')
  )
  const seeds = router.submitted.map(
    (sent) => (sent.body.generationConfig as { seed: number }).seed
  )
  expect(seeds).toEqual([0, 1, 2, 3].map((run) => seeds[0] + run))

  await page.reload()
  await expect(
    page.getByTestId('darkroom-job').getByTestId('darkroom-tile-done')
  ).toHaveCount(4)
  expect(router.submitted).toHaveLength(4)
})

test('sends the settings the controls describe', async ({
  page,
  context,
  modelsAccount
}) => {
  const router = await mockRouter(context)
  await openSignedIn(page, context, modelsAccount)

  await page.getByTestId('darkroom-settings-toggle').click()
  await page
    .getByTestId('darkroom')
    .getByLabel('Model')
    .selectOption('vertexai/gemini-3.1-flash-lite-image')
  await page
    .getByRole('group', { name: 'Images' })
    .getByRole('button', { name: '2', exact: true })
    .click()
  await page
    .getByRole('group', { name: 'Resolution' })
    .getByRole('button', { name: '4K' })
    .click()
  await page.getByRole('button', { name: /^Tall/ }).click()
  await generate(page, 'A lighthouse')

  await expect(page.getByTestId('darkroom-tile-done')).toHaveCount(2)
  await expect.poll(() => router.submitted.length).toBe(2)
  expect(router.submitted[0].model).toBe('gemini-3.1-flash-lite-image')
  expect(router.submitted[0].body.generationConfig).toMatchObject({
    imageConfig: { imageSize: '4K', aspectRatio: '9:16' }
  })
})

test('shows an account that runs one image at a time no way to ask for more', async ({
  page,
  context,
  modelsAccount
}) => {
  const router = await mockRouter(context, 1)
  await openSignedIn(page, context, modelsAccount)

  await page.getByTestId('darkroom-settings-toggle').click()
  await expect(page.getByRole('group', { name: 'Resolution' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Images' })).toHaveCount(0)

  await generate(page, 'A single cypress')
  await expect(page.getByTestId('darkroom-tile-done')).toHaveCount(1)
  expect(router.submitted).toHaveLength(1)
})

test('opens the top-up dialog when the account is out of credits', async ({
  page,
  context,
  modelsAccount
}) => {
  const router = await mockRouter(context)
  router.refusal = { status: 402, errorType: 'insufficient_credits' }
  await openSignedIn(page, context, modelsAccount)

  await generate(page, 'A fox reading a map')

  await expect(page.getByTestId('darkroom-tile-error').first()).toContainText(
    'Out of credits'
  )
  await expect(page.getByRole('dialog', { name: 'Add credits' })).toBeVisible()
})

test('cancels an image still in line and says nothing was charged', async ({
  page,
  context,
  modelsAccount
}) => {
  const router = await mockRouter(context)
  router.result = 'queued'
  await openSignedIn(page, context, modelsAccount)

  await generate(page, 'A fox reading a map')
  const row = page.getByTestId('darkroom-job')
  await expect(row.getByTestId('darkroom-tile-pending').first()).toContainText(
    'In line · 2 ahead'
  )

  await row.getByRole('button', { name: 'Cancel', exact: true }).last().click()

  await expect(row.getByTestId('darkroom-tile-error')).toHaveCount(4)
  await expect(row.getByTestId('darkroom-tile-error').first()).toContainText(
    'Nothing was charged.'
  )
  await expect.poll(() => router.cancelled.length).toBe(4)
})

test('explains an answer that came back without an image', async ({
  page,
  context,
  modelsAccount
}) => {
  const router = await mockRouter(context)
  router.result = 'text'
  await openSignedIn(page, context, modelsAccount)

  await generate(page, 'A fox reading a map')

  const tile = page.getByTestId('darkroom-tile-error').first()
  await expect(tile).toContainText('The model replied with text instead.')
  await expect(tile.getByRole('button', { name: 'Try again' })).toBeVisible()
})

test('deletes a row with Undo, and keeps a starred image', async ({
  page,
  context,
  modelsAccount
}) => {
  await mockRouter(context)
  await openSignedIn(page, context, modelsAccount)
  await generate(page, 'A fox reading a map')
  const row = page.getByTestId('darkroom-job')
  const tiles = row.getByTestId('darkroom-tile-done')
  await expect(tiles).toHaveCount(4)

  await tiles.first().hover()
  await tiles.first().getByRole('button', { name: 'Star' }).click()
  await row.getByRole('button', { name: 'Delete' }).click()

  await expect(tiles).toHaveCount(1)
  const toast = page.getByTestId('darkroom-toast')
  await expect(toast).toContainText('Deleted 3 images. Kept 1 starred.')

  await toast.getByRole('button', { name: 'Undo' }).click()
  await expect(tiles).toHaveCount(4)
  await expect(toast).toContainText('Restored 3 images.')
})

test('collects images in a moodboard and generates in its style', async ({
  page,
  context,
  modelsAccount
}) => {
  const router = await mockRouter(context)
  await openSignedIn(page, context, modelsAccount)
  await generate(page, 'A fox reading a map')
  await expect(page.getByTestId('darkroom-tile-done')).toHaveCount(4)

  await page.getByTestId('darkroom-tab-organize').click()
  const grid = page.getByTestId('darkroom-organize-grid')
  await grid.getByRole('checkbox').nth(0).click()
  await grid.getByRole('checkbox').nth(1).click()
  const selection = page.getByTestId('darkroom-selection-bar')
  await expect(selection).toContainText('2 selected')
  await selection.getByRole('button', { name: 'Add to moodboard' }).click()
  const menu = page.getByTestId('darkroom-board-menu')
  await menu.getByLabel('New moodboard name').fill('Dusk')
  await menu.getByLabel('New moodboard name').press('Enter')
  await expect(page.getByTestId('darkroom-toast')).toContainText(
    'Added 2 images to Dusk.'
  )

  await page.getByTestId('darkroom-tab-moodboards').click()
  await page.getByTestId('darkroom-board-card').click()
  await page.getByRole('button', { name: 'Generate with this' }).click()
  await expect(page.getByTestId('darkroom-moodboard-button')).toContainText(
    'Dusk'
  )

  await generate(page, 'A lighthouse')
  await expect(page.getByTestId('darkroom-job').first()).toContainText(
    'Moodboard · Dusk'
  )
  await expect.poll(() => router.submitted.length).toBe(8)
  const parts = (
    router.submitted[4].body.contents as { parts: Record<string, unknown>[] }[]
  )[0].parts
  // Two images fit one sheet, sent before the prompt and its note.
  expect(parts).toHaveLength(2)
  expect(parts[0]).toHaveProperty('inlineData.mimeType', 'image/jpeg')
  expect(String(parts[1].text)).toMatch(
    /^The last 1 reference image is moodboard sheet:.*\n\nCreate: A lighthouse$/s
  )
  // The row shows the prompt as it was typed.
  await expect(page.getByTestId('darkroom-job').first()).not.toContainText(
    'moodboard sheet'
  )
})
