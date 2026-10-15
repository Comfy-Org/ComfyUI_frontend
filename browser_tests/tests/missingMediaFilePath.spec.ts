import type { Page } from '@playwright/test'
import type { Asset } from '@comfyorg/ingest-types'

import { makeAssetsResponse } from '@e2e/fixtures/assetApiFixture'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import type { WorkspaceStore } from '@e2e/types/globals'

const WORKFLOW_WIDGET_VALUE = 'bare_photo.png'
const WORKFLOW = 'missing/missing_media_bare_filename'
const ASSET_LISTING_URL = /\/api\/assets(?=\?|$)/

async function mockAssetListing(page: Page, assets: Asset[]): Promise<void> {
  await page.route(ASSET_LISTING_URL, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeAssetsResponse(route.request().url(), assets))
    })
  })
}

async function mockAssetListingFailure(
  page: Page,
  status: number
): Promise<void> {
  await page.route(ASSET_LISTING_URL, async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ detail: `forced ${status}` })
    })
  })
}

async function loadWorkflowAndWaitForAssetListing(
  comfyPage: ComfyPage
): Promise<void> {
  const assetListing = comfyPage.page.waitForResponse(ASSET_LISTING_URL)
  await comfyPage.workflow.loadWorkflow(WORKFLOW)
  await assetListing
  await comfyPage.nextFrame()
}

async function getCachedMissingMediaNames(
  comfyPage: ComfyPage
): Promise<string[] | null> {
  return await comfyPage.page.evaluate(() => {
    const workflow = (window.app!.extensionManager as WorkspaceStore).workflow
      .activeWorkflow
    if (!workflow) return null
    return (
      workflow.pendingWarnings?.missingMediaCandidates?.map(
        (candidate) => candidate.name
      ) ?? []
    )
  })
}

test.describe(
  'Missing media detection by asset hash',
  { tag: '@cloud' },
  () => {
    test.use({
      initialSettings: {
        'Comfy.RightSidePanel.ShowErrorsTab': true
      }
    })

    test('does not surface missing media when an asset hash matches the widget value', async ({
      comfyPage
    }) => {
      await mockAssetListing(comfyPage.page, [
        {
          id: 'matching-asset',
          name: WORKFLOW_WIDGET_VALUE,
          hash: WORKFLOW_WIDGET_VALUE,
          size: 1024,
          mime_type: 'image/png',
          tags: ['input'],
          created_at: '2026-05-22T00:00:00Z',
          updated_at: '2026-05-22T00:00:00Z',
          last_access_time: '2026-05-22T00:00:00Z'
        }
      ])

      await loadWorkflowAndWaitForAssetListing(comfyPage)

      await expect(
        comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
      ).toBeHidden()
      await expect.poll(() => getCachedMissingMediaNames(comfyPage)).toEqual([])
    })

    test('surfaces missing media when no asset in the listing covers the widget value', async ({
      comfyPage
    }) => {
      await mockAssetListing(comfyPage.page, [
        {
          id: 'unrelated-asset',
          name: 'unrelated.png',
          hash: 'unrelated.png',
          size: 1024,
          mime_type: 'image/png',
          tags: ['input'],
          created_at: '2026-05-22T00:00:00Z',
          updated_at: '2026-05-22T00:00:00Z',
          last_access_time: '2026-05-22T00:00:00Z'
        }
      ])

      await comfyPage.workflow.loadWorkflow(WORKFLOW)

      await expect
        .poll(() => getCachedMissingMediaNames(comfyPage))
        .toContain(WORKFLOW_WIDGET_VALUE)
      await expect(
        comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
      ).toBeVisible()
    })

    test('does not report media missing when the asset listing fails', async ({
      comfyPage
    }) => {
      await mockAssetListingFailure(comfyPage.page, 500)

      await loadWorkflowAndWaitForAssetListing(comfyPage)

      await expect(
        comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
      ).toBeHidden()
      await expect.poll(() => getCachedMissingMediaNames(comfyPage)).toEqual([])
    })
  }
)
