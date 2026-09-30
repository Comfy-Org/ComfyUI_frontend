import { readFile } from 'node:fs/promises'

import type { BrowserContext, Locator } from '@playwright/test'
import { expect } from '@playwright/test'

import { MODEL_PATH, test } from './fixtures/modelsAccount'

const WORKFLOW_PATH = '/hub/workflows/remove-background/'

async function frame(locator: Locator) {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox()
  if (!box) throw new Error('The element has no layout box')
  return box
}

async function allowWorkflows(context: BrowserContext) {
  await context.route('**/t.comfy.org/**', (route) =>
    /\/(flags|decide)\//.test(route.request().url())
      ? route.fulfill({
          contentType: 'application/json',
          json: {
            featureFlags: {
              'workshop-enabled': true,
              'workshop-workflows-enabled': true
            },
            featureFlagPayloads: {}
          }
        })
      : route.abort('blockedbyclient')
  )
}

test('the model API tab opens with the key action and what it needs beside the code', async ({
  page
}) => {
  await page.goto(MODEL_PATH)
  await page.getByTestId('tab-api').click()

  const facts = page.getByTestId('api-facts')
  await expect(facts).toContainText('POST /v2/models/bfl/flux-2-max')
  await expect(facts).toContainText('COMFY_API_KEY')

  const action = await frame(page.getByTestId('api-get-key'))
  const code = await frame(page.getByTestId('snippet'))
  expect(action.y).toBeLessThanOrEqual(code.y)
  expect(action.x).toBeGreaterThanOrEqual(code.x + code.width)
})

test('@mobile the model API tab puts the key action above the code', async ({
  page
}) => {
  await page.goto(MODEL_PATH)
  await page.getByTestId('tab-api').click()

  const action = await frame(page.getByTestId('api-get-key'))
  const code = await frame(page.getByTestId('snippet'))
  expect(action.y + action.height).toBeLessThanOrEqual(code.y)
})

test('the workflow API tab opens with the key action and what it needs beside the code', async ({
  page,
  context
}) => {
  await allowWorkflows(context)
  await page.goto(WORKFLOW_PATH)
  await page.getByRole('tab', { name: 'API', exact: true }).click()

  const facts = page.getByTestId('api-facts')
  await expect(facts).toContainText('COMFY_API_KEY')
  await expect(facts).not.toContainText('/api/prompt')
  await page.getByRole('tab', { name: 'cURL', exact: true }).click()
  await expect(facts).toContainText('POST')
  await expect(facts).toContainText('/api/prompt')
  await expect(facts).toContainText('X-API-Key')
  await expect(facts).toContainText('extra_data.api_key_comfy_org')

  const action = await frame(page.getByTestId('api-get-key'))
  const code = await frame(page.getByTestId('workflow-api-snippet'))
  expect(action.y).toBeLessThanOrEqual(code.y)
  expect(action.x).toBeGreaterThanOrEqual(code.x + code.width)
})

test('@mobile the workflow example output is as tall as its 16:9 media', async ({
  page,
  context
}) => {
  await allowWorkflows(context)
  await page.goto(WORKFLOW_PATH)

  const output = page.getByTestId('playground-output')
  await expect(output).toHaveAttribute('data-state', 'example')
  const media = await frame(output.getByTestId('output-media'))
  expect(media.height).toBeCloseTo((media.width * 9) / 16, 0)
})

test('@mobile opens a source picture full screen with its close button clear of it', async ({
  page,
  context
}) => {
  await allowWorkflows(context)
  await page.goto(WORKFLOW_PATH)
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles('public/images/cinematic-studio/diner.jpg')
  await page
    .getByRole('button', { name: /^Expand / })
    .first()
    .click()

  const dialog = page.getByTestId('image-source-dialog')
  const viewportWidth = page.viewportSize()?.width ?? 0
  await expect
    .poll(async () => (await frame(dialog)).width)
    .toBeGreaterThan(viewportWidth - 2)
  const [close, picture] = await Promise.all([
    frame(dialog.getByRole('button', { name: 'Close' })),
    frame(dialog.getByRole('img'))
  ])
  expect(close.y + close.height).toBeLessThanOrEqual(picture.y)
})

test('the workflow API tab downloads the API graph as JSON', async ({
  page,
  context
}) => {
  await allowWorkflows(context)
  await page.goto(WORKFLOW_PATH)
  await page.getByRole('tab', { name: 'API', exact: true }).click()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Download the API graph/ }).click()
  ])
  expect(download.suggestedFilename()).toBe('remove-background-api.json')
  const path = await download.path()
  const graph = await readFile(path, 'utf8')
  expect(Object.keys(JSON.parse(graph))).not.toHaveLength(0)
  expect(graph).toContain('"class_type"')
})
