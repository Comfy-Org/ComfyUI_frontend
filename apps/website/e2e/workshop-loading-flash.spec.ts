import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'
import { MODEL_PATH } from './fixtures/modelsAccount'
import { stubWorkshopFlags } from './fixtures/workshopFlags'

for (const path of ['/models/']) {
  test(`static HTML at ${path} paints only the loading frame`, async ({
    request
  }) => {
    const html = await (await request.get(path)).text()
    expect(html).toContain('data-testid="workshop-loading"')
    const liveDom = html
      .replace(
        /<template data-astro-template="fallback">[\s\S]*?<\/template>/g,
        ''
      )
      .replace(/<noscript>[\s\S]*?<\/noscript>/g, '')
    expect(liveDom).toContain('data-testid="workshop-loading"')
    expect(liveDom).not.toMatch(/Grok Imagine/i)
    expect(liveDom).not.toContain('data-testid="model-detail"')
    expect(liveDom).not.toContain('data-testid="model-hero"')
    expect(liveDom).not.toContain('data-testid="workshop-search"')
  })
}

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
    await page.goto('/models/')
    await waitForIsland(page, page.getByTestId('workshop-search'))
    await page
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
