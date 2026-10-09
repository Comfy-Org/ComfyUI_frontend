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

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

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
  await page.getByTestId('model-path-api').click()

  const facts = page.getByTestId('api-facts')
  await expect(facts).toContainText('POST /v2/models/bfl/flux-2-max')
  await expect(facts).toContainText('COMFY_API_KEY')

  const action = await frame(page.getByTestId('api-get-key'))
  const code = await frame(page.getByTestId('snippet'))
  expect(action.y).toBeLessThanOrEqual(code.y)
  expect(action.x).toBeGreaterThanOrEqual(code.x + code.width)
})

test('the model API tab copies the endpoint it shows', async ({
  page,
  context
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto(MODEL_PATH)
  await page.getByTestId('model-path-api').click()

  const facts = page.getByTestId('api-facts')
  await facts.getByRole('button', { name: 'Copy endpoint' }).click()

  await expect(
    facts.getByRole('button', { name: 'Copy endpoint' })
  ).toContainText('Copied')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'POST /v2/models/bfl/flux-2-max'
  )
})

test('@mobile the model API tab puts the key action above the code', async ({
  page
}) => {
  await page.goto(MODEL_PATH)
  await page.getByTestId('model-path-api').click()

  const action = await frame(page.getByTestId('api-get-key'))
  const code = await frame(page.getByTestId('snippet'))
  expect(action.y + action.height).toBeLessThanOrEqual(code.y)
})

test('the workflow API section leads with the key and the SDK, then the code', async ({
  page,
  context
}) => {
  await allowWorkflows(context)
  await page.goto(WORKFLOW_PATH)
  await page.getByTestId('workflow-path-api').click()

  const api = page.getByTestId('workflow-api')
  await expect(api).toContainText('pip install comfy-sdk==0.4.0')
  await expect(api.getByTestId('api-facts')).toHaveCount(0)
  await page.getByRole('tab', { name: 'cURL', exact: true }).click()
  const code = page.getByTestId('workflow-api-snippet')
  await expect(code).toContainText('/api/prompt')
  await expect(code).toContainText('X-API-Key')

  const action = await frame(page.getByTestId('api-get-key'))
  const codeBox = await frame(code)
  expect(action.y + action.height).toBeLessThanOrEqual(codeBox.y)
})

test('@mobile the workflow example output keeps its compact height and shows the whole picture', async ({
  page,
  context
}) => {
  await allowWorkflows(context)
  await page.goto(WORKFLOW_PATH)

  const output = page.getByTestId('playground-output')
  await expect(output).toHaveAttribute('data-state', 'example')
  const picture = output.getByRole('img')
  await expect(picture).toHaveCSS('object-fit', 'contain')
  const [media, shown] = await Promise.all([
    frame(output.getByTestId('output-media')),
    frame(picture)
  ])
  expect(media.height).toBeCloseTo(288, 0)
  expect(media.width).toBeGreaterThan(media.height)
  expect(shown).toEqual(media)
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

test('the workflow API section offers a key and the docs, and no second download', async ({
  page,
  context
}) => {
  await allowWorkflows(context)
  await page.goto(WORKFLOW_PATH)
  await page.getByTestId('workflow-path-api').click()

  const api = page.getByTestId('workflow-api')
  await expect(api.getByRole('link', { name: /^Get an API key/ })).toBeVisible()
  await expect(api.getByRole('link', { name: /^API docs/ })).toHaveAttribute(
    'target',
    '_blank'
  )
  await expect(api.getByRole('button', { name: /Download/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Download/ })).toHaveCount(1)
})
