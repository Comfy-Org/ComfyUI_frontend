import { readFileSync } from 'node:fs'

import type { BrowserContext, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type {
  BillingBalanceResponse,
  JobDetailResponse
} from '@comfyorg/ingest-types'
import { centsToCredits } from '@comfyorg/shared-frontend-utils/creditsUtil'

import { test } from './fixtures/modelsAccount'
import { hubWorkflowHref } from '@/config/hub-models'

const workflowId = 'workflows/remove-background'
// `character-turnaround` is the simplest workflow carrying a `randomize` seed:
// its only required input is the image, and its seed schema spans 0 to
// 4_294_967_295, so a stubbed Math.random maps to a known integer.
const seedWorkflowId = 'workflows/character-turnaround'
const seedMaximum = 4_294_967_295
const runId = 'd982ea52-a2d8-4212-ad8a-ff3030ce42bf'
const uploadId = '8b9a8b50-9fd5-4bbe-a03a-2a387f09713b'
const path = '/api/jobs/' + runId
const uploadPath = '/api/uploads/' + uploadId
const inputName = 'uploaded-photo.webp'
const image = readFileSync('e2e/assets/placeholder-1x1.webp')
const creditRefusal = {
  status: 429,
  json: {
    error: {
      type: 'FREE_TIER_EXHAUSTED',
      message:
        "You've used all your free generations. Upgrade to keep creating."
    }
  }
}

async function setup(context: BrowserContext) {
  let enabled = true
  let generation = 0
  let reachable = true
  let refusesForCredits = false
  await context.route('https://apis.google.com/js/api.js*', (route) =>
    route.abort('blockedbyclient')
  )
  let current: Omit<JobDetailResponse, 'create_time' | 'update_time'> & {
    create_time: number
    update_time: number
  } = {
    id: runId,
    status: 'pending',
    create_time: Date.now(),
    update_time: Date.now(),
    outputs: {}
  }
  const commands: Array<{ method: string; path: string; body: unknown }> = []
  const uploads: Buffer[] = []
  const access = (index: number) =>
    'https://testcloud.comfy.org/api/s/output-' + index + '-' + generation
  function succeed(partial: boolean) {
    generation++
    current = {
      ...current,
      status: 'completed',
      update_time: Date.now(),
      outputs: {
        '18': {
          images: [0, 1].map((index) => ({
            filename: 'output-' + index + '.webp',
            ...(partial && index === 1 ? {} : { short_url: access(index) })
          }))
        }
      }
    }
  }
  await context.route('**/t.comfy.org/**', (route) =>
    /\/(flags|decide)\//.test(route.request().url())
      ? route.fulfill({
          json: {
            featureFlags: {
              'workshop-auth': true,
              'workshop-enabled': true,
              'workshop-workflows-enabled': enabled
            },
            featureFlagPayloads: {}
          }
        })
      : route.abort('blockedbyclient')
  )
  await context.route('**/api/inputs/upload-url', (route) => {
    expect(route.request().postDataJSON()).toEqual({
      content_type: 'image/webp'
    })
    return route.fulfill({ json: { upload_path: uploadPath, expires_in: 900 } })
  })
  await context.route('**' + uploadPath, (route) => {
    expect(route.request().method()).toBe('PUT')
    expect(route.request().headers()).not.toHaveProperty('authorization')
    expect(route.request().headers()).not.toHaveProperty('x-api-key')
    const bytes = route.request().postDataBuffer()
    if (!bytes) throw new Error('Missing uploaded bytes')
    uploads.push(bytes)
    return route.fulfill({
      json: { name: inputName, subfolder: '', type: 'input' }
    })
  })
  await context.route('**/api/s/**', (route) =>
    route.fulfill({ contentType: 'image/webp', body: image })
  )
  await context.route(/\/api\/(prompt|jobs\/)/, (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    if (!reachable) return route.abort('failed')
    commands.push({
      method,
      path: url.pathname,
      body: request.postData() ? request.postDataJSON() : undefined
    })
    if (url.pathname === '/api/prompt') {
      expect(request.headers()).toHaveProperty('authorization')
      return route.fulfill(
        refusesForCredits ? creditRefusal : { json: { prompt_id: runId } }
      )
    }
    if (url.pathname.endsWith('/cancel'))
      return route.fulfill({ json: { cancelled: true } })
    expect(url.searchParams.get('short_link')).toBe('ephemeral_tool_chain')
    return route.fulfill({ json: current })
  })
  return {
    commands,
    uploads,
    access,
    succeed,
    disable() {
      enabled = false
    },
    drop() {
      reachable = false
    },
    refuseForCredits() {
      refusesForCredits = true
    },
    cancel() {
      current = { ...current, status: 'cancelled', update_time: Date.now() }
    }
  }
}

async function signInAndRun(
  page: Page,
  account: { email: string; password: string }
) {
  await signInAndSubmit(page, account)
  await expect(page.getByTestId('workflow-run')).toHaveText('Waiting its turn')
}

async function signInAndFill(
  page: Page,
  account: { email: string; password: string },
  model = workflowId
) {
  await page.goto('/login/')
  await page.getByRole('button', { name: 'Use email instead' }).click()
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/')
  await page.clock.install()
  await page.goto(hubWorkflowHref(model))
  await expect(page.getByTestId('workflow-run')).toBeEnabled()
  await page.getByTestId('field-image-upload').setInputFiles({
    name: 'photo.webp',
    mimeType: 'image/webp',
    buffer: image
  })
  await expect(
    page.getByRole('button', { name: 'Replace photo.webp' })
  ).toBeVisible()
}

async function signInAndSubmit(
  page: Page,
  account: { email: string; password: string },
  model = workflowId
) {
  await signInAndFill(page, account, model)
  await page.getByTestId('workflow-run').click()
}

test('Cloud upload, refresh, partial delivery and downloads retain one run @mobile', async ({
  page,
  context,
  modelsAccount
}) => {
  const cloud = await setup(context)
  await signInAndRun(page, modelsAccount)
  const submissions = () =>
    cloud.commands.filter(
      (command) => command.method === 'POST' && command.path === '/api/prompt'
    )
  expect(cloud.uploads).toEqual([image])
  expect(submissions()).toHaveLength(1)
  expect(submissions()[0].body).toMatchObject({
    prompt: { '17': { class_type: 'LoadImage', inputs: { image: inputName } } },
    extra_data: { auth_token_comfy_org: 'mock-workspace-jwt' }
  })

  await page.reload()
  await expect(page.getByTestId('workflow-run')).toHaveText('Waiting its turn')
  expect(cloud.uploads).toHaveLength(1)
  expect(submissions()).toHaveLength(1)
  await page.getByTestId('workflow-path-api').click()
  const sdkSnippet = page.getByTestId('workflow-api-snippet')
  await expect(sdkSnippet).toContainText('from comfy_sdk import Comfy')
  await expect(sdkSnippet).toContainText(
    'job = client.run(workflow, api_key=api_key)'
  )
  await page.getByRole('tab', { name: 'TypeScript', exact: true }).click()
  await expect(sdkSnippet).toContainText(
    "import { Comfy } from '@comfyorg/sdk'"
  )
  await page.getByRole('tab', { name: 'cURL', exact: true }).click()
  // The address a run is posted to, before the snippet that posts to it.
  await expect(page.getByTestId('workflow-api-endpoint')).toContainText(
    '/api/prompt'
  )
  await expect(
    page.getByRole('link', { name: 'API documentation' })
  ).toBeVisible()
  const snippet = await page.getByTestId('workflow-api-snippet').textContent()
  expect(snippet).toContain('/api/prompt')
  expect(snippet).toContain('X-API-Key:')
  await page.setViewportSize({ width: 320, height: 851 })
  const inside = page.getByTestId('workflow-inside')
  await inside.scrollIntoViewIfNeeded()
  await expect(
    page.getByRole('img', { name: /nodes of this workflow/i })
  ).toBeVisible()
  const panelRight = await inside.evaluate(
    (panel) => panel.getBoundingClientRect().right
  )
  const downloadRight = await page
    .getByRole('link', { name: 'Download workflow JSON' })
    .evaluate((link) => link.getBoundingClientRect().right)
  expect(downloadRight).toBeLessThanOrEqual(panelRight)
  await page.getByTestId('workflow-path-api').click()
  await expect(page.getByTestId('workflow-api-snippet')).toHaveText(
    snippet ?? ''
  )
  await page.getByTestId('playground-output').scrollIntoViewIfNeeded()
  cloud.succeed(true)
  await page.clock.fastForward(2100)
  await expect(page.getByTestId('playground-output')).toHaveAttribute(
    'data-state',
    'succeeded'
  )
  cloud.succeed(false)
  await page.getByRole('button', { name: 'Retry output delivery' }).click()
  const secondFile = page.getByRole('button', { name: 'Image 2' })
  await secondFile.click()
  await expect(
    page.getByRole('img', { name: 'Output', exact: true })
  ).toHaveAttribute('src', cloud.access(1))
  cloud.succeed(false)
  await page
    .getByRole('img', { name: 'Output', exact: true })
    .dispatchEvent('error')
  await expect(
    page.getByRole('img', { name: 'Output', exact: true })
  ).toHaveAttribute('src', cloud.access(1))
  const downloaded = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Download', exact: true }).click()
  const download = await downloaded
  expect(download.suggestedFilename()).toBe('output-1.webp')
  const downloadedPath = await download.path()
  if (!downloadedPath) throw new Error('Missing download')
  expect(readFileSync(downloadedPath)).toEqual(image)
  expect(submissions()).toHaveLength(1)
  expect(
    cloud.commands.every(
      (command) => command.path === '/api/prompt' || command.path === path
    )
  ).toBe(true)
  await page.getByRole('button', { name: /The lily veil/ }).click()
  await page.getByTestId('example-replace-confirm').click()
  await expect(page.getByTestId('playground-output')).toHaveAttribute(
    'data-state',
    'example'
  )
  await expect(
    page.getByRole('button', { name: 'Replace the_lily_veil.png' })
  ).toBeVisible()
  expect(submissions()).toHaveLength(1)
})

test('the credit chip shows a charge Cloud books after the run finishes', async ({
  page,
  context,
  modelsAccount
}) => {
  const cloud = await setup(context)
  let reads = 0
  let chargedAfterRead = Number.POSITIVE_INFINITY
  await context.route('**/api/billing/balance', (route) => {
    reads++
    const cents = reads > chargedAfterRead ? 483_200 : 583_200
    return route.fulfill({
      json: {
        amount_micros: cents,
        effective_balance_micros: cents,
        currency: 'usd'
      } satisfies BillingBalanceResponse
    })
  })
  const chip = page.getByTestId('desktop-nav-cta').getByTestId('header-account')
  const showing = (balance: number) =>
    new RegExp(`, ${centsToCredits(balance).toLocaleString('en-US')} credits$`)
  await signInAndRun(page, modelsAccount)
  await expect(chip).toHaveAccessibleName(showing(583_200))
  const readsBeforeCompletion = reads
  chargedAfterRead = readsBeforeCompletion + 1

  cloud.succeed(false)
  await page.clock.fastForward(2100)
  await expect(page.getByTestId('playground-output')).toHaveAttribute(
    'data-state',
    'succeeded'
  )
  await page.clock.fastForward(1)
  await expect.poll(() => reads).toBeGreaterThan(readsBeforeCompletion)
  await expect(chip).toHaveAccessibleName(showing(583_200))
  await page.clock.fastForward(2_000)

  await expect(chip).toHaveAccessibleName(showing(483_200))
})

test('a Cloud credit refusal opens Add credits without retrying', async ({
  page,
  context,
  modelsAccount
}) => {
  const cloud = await setup(context)
  cloud.refuseForCredits()
  await context.route('**/api/billing/balance', (route) =>
    route.fulfill({
      json: {
        amount_micros: 1_200,
        effective_balance_micros: 1_200,
        currency: 'usd'
      } satisfies BillingBalanceResponse
    })
  )

  await signInAndSubmit(page, modelsAccount)

  const primary = page.getByTestId('workflow-run')
  const dialog = page.getByTestId('buy-credits-dialog')
  await expect(dialog).toBeVisible()
  await expect(primary).toHaveText('Add credits')
  await expect(primary).toHaveAttribute('data-gate', 'noCredits')
  await expect(page.getByRole('button', { name: 'Run' })).toHaveCount(0)
  await page.getByTestId('buy-credits-cancel').click()
  await expect(dialog).toHaveCount(0)
  await page.getByTestId('workflow-inside').scrollIntoViewIfNeeded()
  await primary.scrollIntoViewIfNeeded()
  await expect(dialog).toHaveCount(0)
  await primary.click()
  await expect(dialog).toBeVisible()
  expect(
    cloud.commands.filter((command) => command.path === '/api/prompt')
  ).toHaveLength(1)
})

test('workflow cancellation survives disabled admission and hides on sign-out', async ({
  page,
  context,
  modelsAccount
}) => {
  const cloud = await setup(context)
  await signInAndRun(page, modelsAccount)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByTestId('workflow-run')).toHaveText(
    'Waiting for cancellation…'
  )
  await expect(page.getByTestId('playground-output')).toHaveAttribute(
    'data-state',
    'running'
  )
  cloud.disable()
  await page.reload()
  await expect(page.getByTestId('workflow-run')).toHaveText(
    'Waiting for cancellation…'
  )
  cloud.cancel()
  await page.clock.fastForward(2100)
  await expect(page.getByTestId('playground-output')).toHaveAttribute(
    'data-state',
    'cancelled'
  )
  await expect(
    page.getByText('This run was cancelled before it finished.').first()
  ).toBeVisible()
  await expect(page.getByTestId('workflow-run')).toBeDisabled()
  await page.locator('[data-testid="header-account"]:visible').click()
  await page.getByTestId('account-sign-out').click()
  await expect(page.getByTestId('workflow-hero')).not.toBeVisible()
  expect(
    cloud.commands.filter(
      (command) => command.method === 'POST' && command.path === '/api/prompt'
    )
  ).toHaveLength(1)
})

test('a run the page stops hearing about holds the panel still', async ({
  page,
  context,
  modelsAccount
}) => {
  const cloud = await setup(context)
  await signInAndRun(page, modelsAccount)
  const panel = page.getByTestId('playground-output')
  const run = page.getByTestId('workflow-run')
  await expect(panel).toHaveAttribute('data-state', 'running')
  await expect(panel.getByTestId('run-spinner')).toBeVisible()
  await expect(panel.getByTestId('run-elapsed')).toBeVisible()
  await expect(run.getByTestId('run-button-spinner')).toBeVisible()

  cloud.drop()
  await page.clock.fastForward(2100)

  await expect(panel.getByRole('status')).toHaveText('Connection interrupted')
  await expect(panel).toHaveAttribute('data-state', 'running')
  await expect(panel.getByTestId('run-spinner')).toHaveCount(0)
  await expect(panel.getByTestId('run-elapsed')).toHaveCount(0)
  await expect(run).toHaveText('Connection interrupted')
  await expect(run.getByTestId('run-button-spinner')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Reconnect to this run' })
  ).toBeVisible()
  await expect(page.getByTestId('workflow-run-footer')).toContainText(
    'It may still be running on Cloud and using credits.'
  )
})

// `withRandomizedInputs` rewrites the submitted body, so cover the drawn value
// arriving at Cloud rather than only the draw itself. `workflowCloudRequest`
// writes each app input onto the nodes its binding names, so the seed is read
// back off the posted graph. `character-turnaround` binds seed to nodes 5 and 7,
// whose template values are 54321 and 12345 -- a draw that never happened shows
// up as those, so the assertions below discriminate.
const seedNodeIds = ['5', '7']

function submittedSeeds(
  commands: Array<{ method: string; path: string; body: unknown }>
) {
  return commands
    .filter(
      (command) => command.method === 'POST' && command.path === '/api/prompt'
    )
    .map((command) => {
      const { prompt } = command.body as {
        prompt: Record<string, { inputs: Record<string, unknown> }>
      }
      return seedNodeIds.map((nodeId) => prompt[nodeId]?.inputs.seed)
    })
}

test('an empty seed travels to Cloud as a freshly drawn integer', async ({
  page,
  context,
  modelsAccount
}) => {
  const cloud = await setup(context)
  await page.addInitScript(() => {
    Math.random = () => 0.25
  })
  await signInAndSubmit(page, modelsAccount, seedWorkflowId)
  await expect(page.getByTestId('workflow-run')).toHaveText('Waiting its turn')
  const drawn = Math.floor(0.25 * (seedMaximum + 1))
  expect(submittedSeeds(cloud.commands)).toEqual([[drawn, drawn]])
})

test('a seed typed under Advanced is sent unchanged', async ({
  page,
  context,
  modelsAccount
}) => {
  const cloud = await setup(context)
  await page.addInitScript(() => {
    Math.random = () => 0.25
  })
  await signInAndFill(page, modelsAccount, seedWorkflowId)
  await page.getByTestId('playground-advanced').locator('summary').click()
  await page.getByTestId('field-seed').fill('7')
  await page.getByTestId('workflow-run').click()
  await expect(page.getByTestId('workflow-run')).toHaveText('Waiting its turn')
  expect(submittedSeeds(cloud.commands)).toEqual([[7, 7]])
})
