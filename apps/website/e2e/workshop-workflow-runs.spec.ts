import { readFileSync } from 'node:fs'

import type { BrowserContext, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type {
  BillingBalanceResponse,
  JobDetailResponse
} from '@comfyorg/ingest-types'
import { centsToCredits } from '@comfyorg/shared-frontend-utils/creditsUtil'

import { test } from './fixtures/modelsAccount'

const workflowId = 'workflows/remove-background'
const runId = 'd982ea52-a2d8-4212-ad8a-ff3030ce42bf'
const uploadId = '8b9a8b50-9fd5-4bbe-a03a-2a387f09713b'
const path = '/api/jobs/' + runId
const uploadPath = '/api/uploads/' + uploadId
const inputName = 'uploaded-photo.webp'
const image = readFileSync('e2e/assets/placeholder-1x1.webp')

async function setup(context: BrowserContext) {
  let enabled = true
  let generation = 0
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
    commands.push({
      method,
      path: url.pathname,
      body: request.postData() ? request.postDataJSON() : undefined
    })
    if (url.pathname === '/api/prompt') {
      expect(request.headers()).toHaveProperty('authorization')
      return route.fulfill({ json: { prompt_id: runId } })
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
    cancel() {
      current = { ...current, status: 'cancelled', update_time: Date.now() }
    }
  }
}

async function signInAndRun(
  page: Page,
  account: { email: string; password: string }
) {
  await page.goto('/login/')
  await page.getByRole('button', { name: 'Use email instead' }).click()
  await page.getByLabel('Email').fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/')
  await page.clock.install()
  await page.goto(`/models/${workflowId}/`)
  await expect(page.getByTestId('workflow-run')).toBeEnabled()
  await page.getByTestId('field-image-upload').setInputFiles({
    name: 'photo.webp',
    mimeType: 'image/webp',
    buffer: image
  })
  await expect(
    page.getByRole('button', { name: 'Replace photo.webp' })
  ).toBeVisible()
  await page.getByTestId('workflow-run').click()
  await expect(page.getByTestId('workflow-run')).toHaveText('Queued')
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
    prompt: { '17': { class_type: 'LoadImage', inputs: { image: inputName } } }
  })

  await page.reload()
  await expect(page.getByTestId('workflow-run')).toHaveText('Queued')
  expect(cloud.uploads).toHaveLength(1)
  expect(submissions()).toHaveLength(1)
  await page.getByRole('tab', { name: 'API', exact: true }).click()
  const snippet = await page.getByTestId('workflow-api-snippet').textContent()
  expect(snippet).toContain('/api/prompt')
  expect(snippet).toContain('X-API-Key:')
  await page.setViewportSize({ width: 320, height: 851 })
  await page.getByRole('tab', { name: 'Details', exact: true }).click()
  await expect(
    page.getByRole('img', { name: 'Workflow', exact: true })
  ).toBeVisible()
  const panelRight = await page
    .getByRole('tabpanel', { name: 'Details', exact: true })
    .evaluate(
      (panel) =>
        panel.getBoundingClientRect().right -
        parseFloat(getComputedStyle(panel).paddingRight)
    )
  const downloadRight = await page
    .getByRole('link', { name: 'Download workflow JSON' })
    .evaluate((link) => link.getBoundingClientRect().right)
  expect(downloadRight).toBeLessThanOrEqual(panelRight)
  await page.getByRole('tab', { name: 'API', exact: true }).click()
  await expect(page.getByTestId('workflow-api-snippet')).toHaveText(
    snippet ?? ''
  )
  await page.getByRole('tab', { name: 'Playground', exact: true }).click()
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
    'idle'
  )
  await expect(
    page.getByText(
      'Cancellation requested. Check Cloud for the final job status.',
      { exact: true }
    )
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
