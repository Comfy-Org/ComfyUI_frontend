import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'
import { publishedModelSlugs } from './fixtures/modelsCatalogue'
import { MODEL_PATH } from './fixtures/modelsAccount'
import { stubWorkshopFlags } from './fixtures/workshopFlags'

const liveDom = (html: string) =>
  html
    .replace(
      /<template data-astro-template="fallback">[\s\S]*?<\/template>/g,
      ''
    )
    .replace(/<noscript>[\s\S]*?<\/noscript>/g, '')

test('static HTML at /hub/models/ names the catalogue and links every model', async ({
  request
}) => {
  const live = liveDom(await (await request.get('/hub/models/')).text())
  expect(live.match(/<h1\b[\s\S]*?<\/h1>/g)).toEqual([
    expect.stringContaining('ComfyUI models')
  ])
  expect(live).not.toMatch(/Grok Imagine in ComfyUI|Try Grok Imagine Now/)
  expect(live).toMatch(
    /href="\/hub\/"[^>]*data-testid="hub-back"[^>]*>[\s\S]*?Hub\s*<\/a>/
  )
  expect(live).toContain('data-testid="workshop-loading"')
  expect(live).not.toContain('data-testid="workshop-search"')
  const directory = live.match(
    /data-testid="models-directory"[\s\S]*?<\/section>/
  )?.[0]
  const linked = Array.from(
    directory?.matchAll(/href="\/hub\/models\/([^"/]+)\/"/g) ?? [],
    ([, slug]) => slug
  )
  expect(new Set(linked)).toEqual(publishedModelSlugs)
  expect(linked).toHaveLength(new Set(linked).size)
})

test('static HTML of a model page paints the model, not a loader', async ({
  request
}) => {
  const html = await (await request.get(MODEL_PATH)).text()
  const liveDom = html.replace(
    /<(template|noscript|script|style)\b[\s\S]*?<\/\1>/g,
    ''
  )
  expect(liveDom).toContain('data-testid="model-hero"')
  expect(liveDom).toContain('data-testid="model-detail"')
  expect(liveDom).not.toContain('data-testid="workshop-loading"')
  expect(html).not.toMatch(/Grok Imagine in/i)
})

test('the server-rendered prompt takes no input until the island hydrates', async ({
  page
}) => {
  const hydrate = Promise.withResolvers<void>()
  await page.route('**/_website/ModelPage.*.js', async (route) => {
    await hydrate.promise
    await route.fallback()
  })
  await page.goto(MODEL_PATH, { waitUntil: 'domcontentloaded' })
  const prompt = page.getByRole('textbox', { name: 'Prompt', exact: true })
  const serverValue = await prompt.inputValue()

  await expect(prompt).toBeDisabled()
  await prompt.click({ force: true })
  await page.keyboard.type('typed before hydration')
  await expect(prompt).toHaveValue(serverValue)

  hydrate.resolve()
  await waitForIsland(page, prompt)
  await expect(prompt).toBeEnabled()
  await prompt.fill('typed after hydration')
  await expect(prompt).toHaveValue('typed after hydration')
})

test.describe('enabled workshop', () => {
  test.beforeEach(async ({ context }) => {
    await stubWorkshopFlags(context, { 'workshop-enabled': true })
  })

  test('resolves to the playground without a marketing frame', async ({
    page
  }) => {
    await page.goto(MODEL_PATH)
    await expect(page.getByText(/Try Grok Imagine Now/i)).toHaveCount(0)
    await waitForIsland(page, page.getByTestId('model-detail'))
    await expect(page.getByTestId('model-detail')).toBeVisible()
    await expect(page.getByText(/Try Grok Imagine Now/i)).toHaveCount(0)
  })

  test('client-side navigation does not flash marketing', async ({ page }) => {
    await page.goto('/hub/models/?useCase=generate-images')
    await waitForIsland(page, page.getByTestId('workshop-search'))
    await page
      .getByTestId('workshop-models-grid')
      .getByRole('link', { name: /Grok Imagine Image/i })
      .first()
      .click()
    await expect(page.getByText(/Try Grok Imagine Now/i)).toHaveCount(0)
    await expect(page.getByTestId('model-detail')).toBeVisible()
  })
})

test('a disabled visitor gets the model page without a marketing frame', async ({
  context,
  page
}) => {
  await stubWorkshopFlags(context, { 'workshop-enabled': false })
  const flags = page.waitForResponse((response) =>
    /t\.comfy\.org\/(flags|decide)\//.test(response.url())
  )
  await page.goto(MODEL_PATH)
  await flags
  await expect(page.getByTestId('model-detail')).toBeVisible()
  await expect(page.getByTestId('run-rollout-note')).toBeVisible()
  await expect(page.getByText(/Try Grok Imagine Now/i)).toHaveCount(0)
})
