import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { ApiSignin } from '@e2e/fixtures/components/ApiSignin'

test.describe('API Nodes sign-in dialog', { tag: '@ui' }, () => {
  let dialog: ApiSignin

  test.beforeEach(({ comfyPage }) => {
    dialog = new ApiSignin(comfyPage.page)
  })

  // Cancel resolves the showApiNodesSignInDialog promise that
  // ApiSignin.open() leaves unawaited, so the context can close cleanly.
  test.afterEach(async () => {
    if (await dialog.root.isVisible()) {
      await dialog.cancel.click()
      await expect(dialog.root).toBeHidden()
    }
  })

  test('shows sign-in heading and cost-breakdown title', async () => {
    await dialog.open(['FluxProGenerate'])

    await expect(dialog.heading).toBeVisible()
    await expect(dialog.costBreakdownTitle).toBeVisible()
    await expect(dialog.login).toBeVisible()
    await expect(dialog.cancel).toBeVisible()
  })

  test('renders fallback node names when graph has no api nodes', async () => {
    const names = ['FluxProGenerate', 'StableDiffusion3Generate']
    await dialog.open(names)

    for (const name of names) {
      await expect(dialog.root.getByText(name)).toBeVisible()
    }
    // Title includes the count of rendered rows so users can spot a
    // discrepancy between the list and the total cost.
    await expect(dialog.costBreakdownTitle).toContainText(`(${names.length})`)
    // Default test workflow has no priced api nodes, so cost column and
    // total-cost row should be hidden.
    await expect(dialog.costPerRunHeader).toBeHidden()
    await expect(dialog.totalCostLabel).toBeHidden()
  })

  test('cancel button closes dialog and resolves false', async () => {
    const { result } = await dialog.open(['FluxProGenerate'])

    await dialog.cancel.click()
    await expect(dialog.root).toBeHidden()
    expect(await result).toBe(false)
  })
})
