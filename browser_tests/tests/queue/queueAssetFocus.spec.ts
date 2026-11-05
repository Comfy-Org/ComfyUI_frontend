import { expect } from '@playwright/test'

import {
  queueAssetFocusTest as test,
  TARGET_JOB_ID
} from '@e2e/fixtures/queueAssetFocusFixture'
import { TestIds } from '@e2e/fixtures/selectors'

test.use({
  initialFeatureFlags: { assets: true },
  initialSettings: {
    'Comfy.Assets.UseAssetAPI': true,
    'Comfy.Queue.QPOV2': false
  }
})

test.describe('Queue asset focus', { tag: ['@cloud', '@ui'] }, () => {
  test('loads later asset pages before selecting a queued output', async ({
    comfyPage,
    outputAssetRequests
  }) => {
    // First-page fetches (initial load, head refresh, sidebar reset) are
    // incidental; the contract is the cursor walk that View triggers.
    const requestedCursors = () =>
      outputAssetRequests.flatMap((request) => {
        const after = new URL(request).searchParams.get('after')
        return after ? [after] : []
      })

    await comfyPage.page.getByTestId(TestIds.queue.overlayToggle).click()

    const targetJob = comfyPage.page.locator(`[data-job-id="${TARGET_JOB_ID}"]`)
    await expect(targetJob).toBeVisible()
    await targetJob.hover()
    expect(requestedCursors()).toEqual([])
    await targetJob.getByRole('button', { name: 'View' }).click()

    const assetsTab = comfyPage.menu.assetsTab
    const targetAsset = assetsTab.getAssetCardByName('queue-focus-target')
    await expect
      .poll(requestedCursors)
      .toEqual(['queue-focus-page-1', 'queue-focus-page-2'])
    await expect(assetsTab.generatedTab).toBeVisible()
    await expect(targetAsset).toBeVisible()
    await expect(targetAsset).toHaveAttribute('data-selected', 'true')
    await expect(assetsTab.selectedCards).toHaveCount(1)
  })
})
