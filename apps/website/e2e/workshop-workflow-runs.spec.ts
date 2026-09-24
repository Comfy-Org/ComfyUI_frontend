import { readFileSync } from 'node:fs'

import type { BrowserContext, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { components } from '@comfyorg/registry-types'

import { test } from './fixtures/modelsAccount'

type Schemas = components['schemas']
const workflowId = 'workflows/remove-background'
const runId = 'd982ea52-a2d8-4212-ad8a-ff3030ce42bf'
const outputIds = [
  '2d24ee32-f12d-51a6-bf3c-c8bb0d38d443',
  '9fa2f8bc-314a-51a6-9f32-f4624501fc92'
]
const uploadId = '8b9a8b50-9fd5-4bbe-a03a-2a387f09713b'
const path = `/v1/workshop/workflow-runs/${runId}`
const inputUrl = `https://storage.googleapis.com/inputs/${uploadId}`
const uploadUrl = `${inputUrl}?upload=signature`
const uploadPath = `/customers/storage/${uploadId}/access`
const image = readFileSync('e2e/assets/placeholder-1x1.webp')

async function setup(context: BrowserContext) {
  let enabled = true
  await context.route('https://apis.google.com/js/api.js*', (route) =>
    route.abort('blockedbyclient')
  )
  const now = Date.now()
  const expiresAt = new Date(now + 3_600_000).toISOString()
  const summary: Schemas['WorkshopWorkflowRunSummary'] = {
    id: runId,
    workflowId,
    definitionVersion: '1',
    state: 'queued',
    outputState: 'pending',
    statusUrl: path,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString()
  }
  let current: Schemas['WorkshopWorkflowRun'] = {
    run: summary,
    runtime: { state: 'unknown' },
    outputs: [],
    retryOutputDeliveryUrl: `${path}/outputs/retry`
  }
  const commands: Array<{
    method: string
    path: string
    body: unknown
    key?: string
  }> = []
  const uploads: Buffer[] = []
  const access = (
    index: number,
    renewed = false
  ): Schemas['WorkshopMediaAccess'] => ({
    url: `https://storage.googleapis.com/results/${outputIds[index]}.webp?signature=${renewed ? 'renewed' : 'initial'}`,
    expiresAt: renewed ? expiresAt : new Date(now + 60_000).toISOString(),
    refreshUrl: `${path}/outputs/${outputIds[index]}/access`,
    mimeType: 'image/webp',
    sizeBytes: image.byteLength
  })
  function succeed(partial: boolean) {
    current = {
      ...current,
      run: {
        ...current.run,
        state: 'succeeded',
        outputState: partial ? 'partial' : 'ready',
        updatedAt: new Date(Date.now()).toISOString(),
        completedAt: new Date(Date.now()).toISOString()
      },
      outputs: outputIds.map((id, index) => ({
        id,
        bindingId: 'image',
        fileIndex: index,
        kind: 'image',
        accessUrl: `${path}/outputs/${id}/access`,
        delivery:
          partial && index === 1
            ? {
                state: 'failed',
                error: {
                  code: 'delivery_failed',
                  message: 'Output unavailable'
                }
              }
            : { state: 'ready', access: access(index) }
      }))
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
  await context.route('**/customers/storage', (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      purpose: 'workshop_workflow',
      content_type: 'image/webp',
      size_bytes: image.byteLength
    })
    return route.fulfill({
      json: {
        upload_url: uploadUrl,
        workflow_upload: {
          id: uploadId,
          inputUrl,
          accessUrl: uploadPath,
          uploadExpiresAt: expiresAt,
          assetExpiresAt: expiresAt,
          uploadHeaders: {
            'Content-Type': 'image/webp',
            'x-goog-if-generation-match': '0',
            'x-goog-content-length-range': `${image.byteLength},${image.byteLength}`
          }
        }
      } satisfies Schemas['CustomerStorageResourceResponse']
    })
  })
  await context.route(uploadUrl, (route) => {
    expect(route.request().method()).toBe('PUT')
    expect(route.request().headers()).not.toHaveProperty('authorization')
    const bytes = route.request().postDataBuffer()
    if (!bytes) throw new Error('Missing uploaded bytes')
    uploads.push(bytes)
    return route.fulfill({ status: 200, body: '' })
  })
  await context.route(`**${uploadPath}`, (route) =>
    route.fulfill({
      json: {
        url: `${inputUrl}?signature=read`,
        expiresAt,
        refreshUrl: uploadPath,
        mimeType: 'image/webp',
        sizeBytes: image.byteLength
      } satisfies Schemas['WorkshopMediaAccess']
    })
  )
  await context.route('https://storage.googleapis.com/results/**', (route) =>
    route.fulfill({ contentType: 'image/webp', body: image })
  )
  await context.route('**/v1/workshop/workflow-runs**', (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const body: unknown = request.postData()
      ? request.postDataJSON()
      : undefined
    commands.push({
      method,
      path: url.pathname,
      body,
      key: request.headers()['idempotency-key']
    })
    if (url.pathname === '/v1/workshop/workflow-runs') {
      if (method === 'GET')
        return route.fulfill({
          json: {
            items: commands.some((entry) => entry.method === 'POST')
              ? [current.run]
              : []
          } satisfies Schemas['WorkshopWorkflowRunPage']
        })
      return route.fulfill({ status: 202, json: summary })
    }
    if (url.pathname.endsWith('/cancel'))
      current = {
        ...current,
        run: {
          ...current.run,
          cancelRequestedAt: new Date(Date.now()).toISOString()
        }
      }
    if (url.pathname.endsWith('/outputs/retry')) succeed(false)
    const index = outputIds.findIndex(
      (id) => url.pathname === `${path}/outputs/${id}/access`
    )
    return route.fulfill({
      status: method === 'POST' ? 202 : 200,
      json: index >= 0 ? access(index, true) : current
    })
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
      current = {
        ...current,
        run: {
          ...current.run,
          state: 'cancelled',
          completedAt: new Date(Date.now()).toISOString()
        }
      }
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

test('workflow refresh, partial output delivery and expired downloads retain one run @mobile', async ({
  page,
  context,
  modelsAccount
}) => {
  const cloud = await setup(context)
  await signInAndRun(page, modelsAccount)
  const submissions = () =>
    cloud.commands.filter(
      (command) =>
        command.method === 'POST' &&
        command.path === '/v1/workshop/workflow-runs'
    )
  expect(cloud.uploads).toEqual([image])
  expect(submissions()).toEqual([
    {
      method: 'POST',
      path: '/v1/workshop/workflow-runs',
      key: expect.any(String),
      body: {
        workflowId,
        definitionVersion: '1',
        appInputs: { image: inputUrl }
      }
    }
  ])

  await page.reload()
  await expect(page.getByTestId('workflow-run')).toHaveText('Queued')
  expect(cloud.uploads).toHaveLength(1)
  expect(submissions()).toHaveLength(1)
  await page.getByRole('tab', { name: 'API', exact: true }).click()
  const snippet = await page.getByTestId('workflow-api-snippet').textContent()
  expect(snippet).toContain('Idempotency-Key:')
  await page.setViewportSize({ width: 320, height: 851 })
  await page.getByRole('tab', { name: 'Workflow', exact: true }).click()
  await expect(
    page.getByRole('img', { name: 'Workflow', exact: true })
  ).toBeVisible()
  const panelRight = await page
    .getByRole('tabpanel', { name: 'Workflow', exact: true })
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
  await page.getByRole('button', { name: 'Retry output delivery' }).click()
  const secondFile = page.getByRole('button', { name: 'Image 2' })
  await secondFile.click()
  await expect(
    page.getByRole('img', { name: 'Output', exact: true })
  ).toHaveAttribute('src', cloud.access(1).url)
  await page.clock.fastForward(65_000)
  await page.getByRole('link', { name: 'Refresh download link' }).click()
  await expect(
    page.getByRole('link', { name: 'Download', exact: true })
  ).toHaveAttribute('href', cloud.access(1, true).url)
  expect(submissions()).toHaveLength(1)
  expect(
    cloud.commands.filter((command) => command.path.endsWith('/outputs/retry'))
  ).toHaveLength(1)
  expect(
    cloud.commands.filter((command) =>
      command.path.endsWith(`/${outputIds[1]}/access`)
    )
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
  await expect(page.getByTestId('workflow-run')).toBeDisabled()
  await page.locator('[data-testid="header-account"]:visible').click()
  await page.getByTestId('account-sign-out').click()
  await expect(page.getByTestId('workflow-hero')).not.toBeVisible()
  expect(
    cloud.commands.filter(
      (command) =>
        command.method === 'POST' &&
        command.path === '/v1/workshop/workflow-runs'
    )
  ).toHaveLength(1)
})
