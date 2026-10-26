import type { BrowserContext, Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { MODEL_ID, MODEL_PATH, test } from './fixtures/modelsAccount'
import type { PosthogEvent } from './fixtures/posthogEvents'
import { capturePosthogEvents } from './fixtures/posthogEvents'
import { stubWorkshopFlags } from './fixtures/workshopFlags'

test.use({
  launchOptions: { args: ['--disable-blink-features=AutomationControlled'] }
})

test.beforeEach(async ({ context, page }) => {
  await context.route('https://platform.comfy.org/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '' })
  )
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const browserSession = await context.newCDPSession(page)
  await browserSession.send('Emulation.setUserAgentOverride', {
    userAgent: await page.evaluate(() => navigator.userAgent)
  })
})

async function copySnippetAndGetKey(
  page: Page,
  context: BrowserContext,
  snippet: Locator,
  openApi: Locator
) {
  await openApi.click()
  await page.getByRole('tab', { name: 'cURL', exact: true }).click()
  await expect(snippet).toBeVisible()
  await page.getByRole('button', { name: 'Copy snippet' }).click()
  const opened = context.waitForEvent('page')
  await page.getByTestId('api-get-key').click()
  await (await opened).close()
}

async function expectApiActions(
  captured: PosthogEvent[],
  model: Record<string, unknown>
) {
  await expect
    .poll(() => captured, { timeout: 15_000 })
    .toEqual(
      expect.arrayContaining([
        {
          event: 'website:workshop_api_snippet_copied',
          properties: expect.objectContaining({
            ...model,
            snippet_language: 'curl'
          })
        },
        {
          event: 'website:workshop_api_key_clicked',
          properties: expect.objectContaining(model)
        }
      ])
    )
}

test('the model API tab reports snippet copies and Get API key clicks', async ({
  page,
  context
}) => {
  const captured = await capturePosthogEvents(context)
  await page.goto(MODEL_PATH)
  await copySnippetAndGetKey(
    page,
    context,
    page.getByTestId('snippet'),
    page.getByTestId('model-path-api')
  )

  await expectApiActions(captured, {
    model_slug: MODEL_ID,
    page_type: 'model'
  })
})

test('the workflow API section reports snippet copies and Get API key clicks', async ({
  page,
  context
}) => {
  await stubWorkshopFlags(context, {
    'workshop-enabled': true,
    'workshop-workflows-enabled': true
  })
  const captured = await capturePosthogEvents(context)
  await page.goto('/hub/workflows/remove-background/')
  await copySnippetAndGetKey(
    page,
    context,
    page.getByTestId('workflow-api-snippet'),
    page.getByTestId('workflow-path-api')
  )

  await expectApiActions(captured, {
    model_slug: 'workflows/remove-background',
    page_type: 'workflow'
  })
})
