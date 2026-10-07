import type { BrowserContext } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

async function showWorkflows(context: BrowserContext) {
  await context.route('**/t.comfy.org/**', (route) =>
    /\/(flags|decide)\//.test(route.request().url())
      ? route.fulfill({
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

test.describe('Model file pages in the Hub', () => {
  test('a model file page sits under the Hub models with its trail', async ({
    page
  }) => {
    await page.goto('/hub/models/local/qwen-image-vae/')

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const trail = page.getByTestId('model-file-trail')
    await expect(trail.getByTestId('model-back')).toHaveAttribute(
      'href',
      '/hub/models/'
    )
    await expect(
      trail.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link')
    ).toHaveText(['Hub', 'Models'])
  })

  test('offers the file download and nothing to run', async ({ page }) => {
    await page.goto('/hub/models/local/qwen-image-vae/')

    await expect(page.getByTestId('model-file-download')).toHaveText(
      'Download for ComfyUI'
    )
    await expect(page.getByRole('link', { name: 'TRY IN COMFY' })).toHaveCount(
      0
    )
    await expect(page.getByRole('link', { name: 'RUN ON CLOUD' })).toHaveCount(
      0
    )
  })

  test('lists the Hub workflows that load the file', async ({
    page,
    context
  }) => {
    await showWorkflows(context)
    await page.goto('/hub/models/local/qwen-image-vae/')

    const usedBy = page.getByTestId('model-file-used-by')
    await usedBy.scrollIntoViewIfNeeded()
    await expect(
      usedBy.getByRole('heading', { name: 'Workflows that use it' })
    ).toBeVisible()
    await expect(
      usedBy.locator('a[href="/hub/workflows/change-material/"]').first()
    ).toBeVisible()
  })

  test('leaves the section out when no workflow loads the file', async ({
    page,
    context
  }) => {
    await showWorkflows(context)
    await page.goto('/hub/models/local/grok-imagine/')

    await expect(page.getByTestId('model-file-trail')).toBeVisible()
    await expect(page.getByTestId('model-file-used-by')).toHaveCount(0)
  })

  test('keeps the supported-models address working', async ({ page }) => {
    const response = await page.goto('/p/supported-models/qwen-image-vae/')

    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByTestId('model-file-trail')).toHaveCount(0)
  })
})
