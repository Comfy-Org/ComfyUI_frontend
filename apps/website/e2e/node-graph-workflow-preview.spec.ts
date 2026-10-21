import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'

const PREVIEW = '/hub-preview/node-graph-workflow/'

async function openPreview(page: Page) {
  await page.goto(PREVIEW)
  await waitForIsland(page, page.getByTestId('node-graph-workflow'))
}

test.describe('Node graph workflow preview', () => {
  test('leads with Try in Cloud and offers the workflow download', async ({
    page
  }) => {
    await openPreview(page)

    const tryCloud = page.getByRole('link', { name: 'Try in Cloud' })
    await expect(tryCloud).toHaveCount(1)
    await expect(tryCloud).toHaveAttribute(
      'href',
      /\?template=templates-character_sheet$/
    )
    await expect(tryCloud).toHaveAttribute('target', '_blank')
    await expect(
      page.getByRole('link', { name: 'Download workflow JSON' })
    ).toHaveAttribute('download')
  })

  test('switches the output when another sample is chosen', async ({
    page
  }) => {
    await openPreview(page)

    const output = page.getByTestId('node-graph-output')
    await expect(
      output.getByRole('img', { name: 'Pink and silver character sheet' })
    ).toBeVisible()

    await page
      .getByRole('button', { name: /^Deep-sea diver character sheet:/ })
      .click()

    await expect(
      output.getByRole('img', { name: 'Deep-sea diver character sheet' })
    ).toBeVisible()
    await expect(output.getByText('Sample 2 of 3')).toBeVisible()
  })

  test('opens the Details and API tabs', async ({ page }) => {
    await openPreview(page)

    await page.getByRole('tab', { name: 'Details' }).click()
    const details = page.getByRole('tabpanel', { name: 'Details' })
    await expect(details).toBeVisible()
    await expect(details.getByText('ComfyUI-KJNodes')).toBeVisible()

    await page.getByRole('tab', { name: 'API' }).click()
    const api = page.getByRole('tabpanel', { name: 'API' })
    await expect(api).toBeVisible()
    await expect(api.getByTestId('node-graph-api-snippet')).toContainText(
      'workflow_api.json'
    )
    await expect(api.getByTestId('api-facts')).toContainText('/api/prompt')
  })
})
