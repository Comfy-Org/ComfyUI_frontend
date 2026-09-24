import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

import { expect, test as base } from '@playwright/test'
import type { BrowserContext, Page, TestInfo } from '@playwright/test'
import { z } from 'zod'

import { validateArtifact } from '../scripts/router-model-artifacts'
import type { ModelCase } from './cases'
import { liveSettings, requiredSetting } from './settings'
import { prepareSession } from './session'

type Submission = { key: string | undefined; hash: string }
type SessionState = Awaited<ReturnType<BrowserContext['storageState']>>

export const test = base.extend<
  { submissions: Submission[] },
  { signedInState: SessionState }
>({
  signedInState: [
    async ({ browser }, use) => {
      const context = await browser.newContext({ baseURL: liveSettings().site })
      try {
        await prepareSession(context)
        await use(await context.storageState({ indexedDB: true }))
      } finally {
        await context.close()
      }
    },
    { scope: 'worker', timeout: 120_000 }
  ],
  storageState: async ({ signedInState }, use) => {
    await use(signedInState)
  },
  submissions: async ({ context }, use) => {
    const settings = liveSettings()
    const submissions: Submission[] = []
    context.on('request', (request) => {
      const url = new URL(request.url())
      if (
        url.origin === settings.router &&
        request.method() === 'POST' &&
        /^\/v2\/models\/.+\/requests$/.test(url.pathname)
      )
        submissions.push({
          key: request.headers()['idempotency-key'],
          hash: createHash('sha256')
            .update(request.postData() ?? '')
            .digest('hex')
        })
    })
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      const backend = /^(?:(?:staging|test)?(?:api|cloud))\.comfy\.org$/.test(
        url.hostname
      )
      if (
        backend &&
        url.origin !== settings.cloud &&
        url.origin !== settings.router
      ) {
        await route.abort('blockedbyclient')
        throw new Error('Deployed website called a different Cloud environment')
      }
      await route.continue()
    })
    await use(submissions)
  }
})

export async function useOwnInputs(
  page: Page,
  model: ModelCase,
  directory = requiredSetting('WORKSHOP_FIXTURE_DIR')
) {
  await page.getByTestId(`field-${model.promptField}`).fill(model.prompt)
  for (const file of model.files) {
    const group = page.getByTestId(`field-group-${file.field}`)
    for (const remove of await group
      .getByRole('button', { name: /^Remove / })
      .all())
      await remove.click()
    await group
      .locator('input[type="file"]')
      .setInputFiles(join(directory, file.fixture))
    await expect(
      group.getByRole('button', { name: `Replace ${file.fixture}` })
    ).toBeVisible()
  }
}

export async function useAdvancedInputs(page: Page, model: ModelCase) {
  const panel = page.getByTestId('playground-advanced')
  await panel.locator('summary').click()
  const field = page
    .getByTestId(`field-group-${model.advancedField}`)
    .getByRole('spinbutton')
  await field.fill(model.advancedValue)
  await field.blur()
  await panel.locator('summary').click()
  await panel.locator('summary').click()
  await expect(field).toHaveValue(model.advancedValue)
}

async function verifyOutputPlayback(page: Page, kind: ModelCase['kind']) {
  const output = page.getByTestId('playground-output')
  if (kind === 'image') {
    await expect(
      output.getByRole('img', { name: 'Output', exact: true })
    ).toHaveJSProperty('complete', true)
    await expect
      .poll(() =>
        output
          .getByRole('img', { name: 'Output', exact: true })
          .evaluate((element) =>
            element instanceof HTMLImageElement ? element.naturalWidth : 0
          )
      )
      .toBeGreaterThan(0)
  } else {
    const media = output.locator(kind === 'video' ? 'video' : 'audio')
    await media.evaluate(async (element) => {
      if (!(element instanceof HTMLMediaElement))
        throw new Error('Missing media player')
      element.muted = true
      await element.play()
    })
    await expect
      .poll(() =>
        media.evaluate((element) =>
          element instanceof HTMLMediaElement ? element.currentTime : 0
        )
      )
      .toBeGreaterThan(0)
  }
}

export async function runAndVerify(
  page: Page,
  submissions: Submission[],
  model: ModelCase,
  variant: 'defaults' | 'own' | 'advanced',
  testInfo: TestInfo
) {
  const priorSubmissions = submissions.length
  const path = new URL(page.url()).pathname
  const endpoint = `${liveSettings().router}/v2/models/${model.routerId}/requests`
  const request = page.waitForRequest(
    (request) => request.url() === endpoint && request.method() === 'POST'
  )
  const accepted = page.waitForResponse(
    (response) =>
      response.url() === endpoint && response.request().method() === 'POST'
  )
  await page.getByTestId('run-button').click()
  const submitted = await request
  const body = submitted.postData() ?? ''
  const key = submitted.headers()['idempotency-key']
  expect(key, 'Paid submissions require an idempotency key').toBeTruthy()
  const requestHash = createHash('sha256').update(body).digest('hex')
  await testInfo.attach(`${variant}-submission`, {
    contentType: 'application/json',
    body: JSON.stringify({
      model: model.slug,
      variant,
      idempotencyKey: key,
      requestHash
    })
  })
  const response = await accepted
  expect(response.status(), 'Router submission HTTP status').toBe(201)
  const { request_id: acceptedId } = z
    .object({ request_id: z.string().uuid() })
    .parse(await response.json())
  await testInfo.attach(`${variant}-accepted-job`, {
    contentType: 'application/json',
    body: JSON.stringify({
      model: model.slug,
      variant,
      requestId: acceptedId,
      idempotencyKey: key,
      requestHash
    })
  })
  if (variant !== 'defaults')
    expect(body).toContain(JSON.stringify(model.prompt))
  if (variant === 'advanced')
    expect(JSON.parse(body)).toHaveProperty(
      model.advancedField,
      Number(model.advancedValue)
    )
  await expect(page.getByTestId('playground-output')).toHaveAttribute(
    'data-state',
    'succeeded',
    {
      timeout: (model.kind === 'video' ? 40 : 10) * 60_000
    }
  )
  await verifyOutputPlayback(page, model.kind)
  const idText = await page.getByTestId('router-request-id').innerText()
  const requestId = idText.match(/[0-9a-f]{8}-[0-9a-f-]{27,}/i)?.[0]
  expect(
    requestId,
    'A successful result must identify its real job'
  ).toBeTruthy()
  expect(requestId).toBe(acceptedId)
  const downloadEvent = page.waitForEvent('download')
  await page.getByTestId('output-download').click()
  const download = await downloadEvent
  expect(await download.failure()).toBeNull()
  const localPath = testInfo.outputPath(`${variant}-download`)
  await download.saveAs(localPath)
  const size = (await stat(localPath)).size
  expect(size).toBeGreaterThan(0)
  expect(size).toBeLessThanOrEqual(256 * 1024 * 1024)
  const bytes = await readFile(localPath)
  const blob = new Blob([bytes])
  const url = URL.createObjectURL(blob)
  const artifact = await validateArtifact(
    { kind: model.kind, url, fileName: download.suggestedFilename() },
    model.kind,
    testInfo.outputPath(`${variant}-decoded`),
    AbortSignal.timeout(120_000),
    256 * 1024 * 1024
  ).finally(() => URL.revokeObjectURL(url))
  await expect(page).toHaveURL(new URL(path, liveSettings().site).href)
  const attempts = submissions.slice(priorSubmissions)
  expect([...new Set(attempts.map((attempt) => attempt.key))]).toEqual([key])
  expect([...new Set(attempts.map((attempt) => attempt.hash))]).toEqual([
    requestHash
  ])
  await testInfo.attach(`${variant}-evidence`, {
    contentType: 'application/json',
    body: JSON.stringify({
      model: model.slug,
      variant,
      requestId,
      idempotencyKey: key,
      requestHash: createHash('sha256').update(body).digest('hex'),
      artifact,
      visualReview: 'Not run: human review of prompt fidelity is required'
    })
  })
  return requestId
}
