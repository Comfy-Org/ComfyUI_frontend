import type { Page } from '@playwright/test'
import type { Asset, ListAssetsResponse } from '@comfyorg/ingest-types'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import type { WorkspaceStore } from '@e2e/types/globals'

// BE-933 / BE-934 add `file_path` (and BE-933 also `display_name`) to the asset
// wire shape. `@comfyorg/ingest-types` is not yet regenerated from the updated
// OpenAPI (tracked under BE-932); extend the local type so mocks can carry the
// post-BE field without an `any` cast.
type PostBEAsset = Asset & {
  file_path?: string | null
  display_name?: string | null
}

const WORKFLOW_WIDGET_VALUE = 'fe746_photo.png'

async function mockAssetListing(
  page: Page,
  assets: PostBEAsset[]
): Promise<void> {
  await page.route(/\/api\/assets(?=\?|$)/, async (route) => {
    const response: ListAssetsResponse = {
      assets: assets as Asset[],
      total: assets.length,
      has_more: false
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response)
    })
  })
}

async function mockAssetListingFailure(
  page: Page,
  status: number
): Promise<void> {
  await page.route(/\/api\/assets(?=\?|$)/, async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ detail: `forced ${status} for FE-746 test` })
    })
  })
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
  'Missing media detection — file_path union (FE-746)',
  { tag: '@cloud' },
  () => {
    test.use({
      initialSettings: {
        'Comfy.RightSidePanel.ShowErrorsTab': true
      }
    })

    test('does not surface missing media when a post-BE asset emits file_path that diverges from the workflow widget value (Case B regression)', async ({
      comfyPage
    }) => {
      // BE-933 / BE-934 post-deploy shape: asset emits a namespace-rooted
      // file_path that differs from the bare `name` the user originally chose.
      // The workflow widget value (`fe746_photo.png`) predates the rollout, so
      // it must still match via the `name` arm of the detection-key union.
      // Case A (file_path-only early return) would mark this as missing.
      await mockAssetListing(comfyPage.page, [
        {
          id: 'fe746-asset-1',
          name: WORKFLOW_WIDGET_VALUE,
          asset_hash: 'blake3:fe7460000000000000000000000000000',
          file_path: 'input/sub/fe746_photo.png',
          size: 1024,
          mime_type: 'image/png',
          tags: ['input'],
          created_at: '2026-05-22T00:00:00Z',
          updated_at: '2026-05-22T00:00:00Z',
          last_access_time: '2026-05-22T00:00:00Z'
        }
      ])

      await comfyPage.workflow.loadWorkflow(
        'missing/fe746_load_image_bare_filename'
      )

      await expect(
        comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
      ).toBeHidden()
      await expect.poll(() => getCachedMissingMediaNames(comfyPage)).toEqual([])
    })

    test('matches via legacy `name` fallback when the asset has no file_path (BE-933 hash-only registration)', async ({
      comfyPage
    }) => {
      // BE-933 hash-only null case: asset registered via POST /assets/from-hash
      // has no on-disk path, so `file_path` (and `display_name`) come back null.
      // Detection must still succeed via the legacy `name` arm.
      await mockAssetListing(comfyPage.page, [
        {
          id: 'fe746-asset-hash-only',
          name: WORKFLOW_WIDGET_VALUE,
          asset_hash: 'blake3:fe7460000000000000000000000000001',
          file_path: null,
          display_name: null,
          size: 1024,
          mime_type: 'image/png',
          tags: ['input'],
          created_at: '2026-05-22T00:00:00Z',
          updated_at: '2026-05-22T00:00:00Z',
          last_access_time: '2026-05-22T00:00:00Z'
        }
      ])

      await comfyPage.workflow.loadWorkflow(
        'missing/fe746_load_image_bare_filename'
      )

      await expect(
        comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
      ).toBeHidden()
      await expect.poll(() => getCachedMissingMediaNames(comfyPage)).toEqual([])
    })

    test('surfaces missing media when no asset in the listing covers the widget value', async ({
      comfyPage
    }) => {
      // Sanity: with the union still in place, an asset listing that does not
      // include the widget value via any key (file_path / asset_hash / name)
      // must still report missing. Guards against accidental "match
      // everything" regressions when the early-return was removed.
      await mockAssetListing(comfyPage.page, [
        {
          id: 'fe746-unrelated-asset',
          name: 'unrelated.png',
          asset_hash: 'blake3:fe7460000000000000000000000000002',
          file_path: 'input/unrelated.png',
          size: 1024,
          mime_type: 'image/png',
          tags: ['input'],
          created_at: '2026-05-22T00:00:00Z',
          updated_at: '2026-05-22T00:00:00Z',
          last_access_time: '2026-05-22T00:00:00Z'
        }
      ])

      await comfyPage.workflow.loadWorkflow(
        'missing/fe746_load_image_bare_filename'
      )

      await expect
        .poll(() => getCachedMissingMediaNames(comfyPage))
        .toContain(WORKFLOW_WIDGET_VALUE)
      await expect(
        comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
      ).toBeVisible()
    })

    test('soft-degrades when /api/assets fails so verification does not deadlock pending candidates', async ({
      comfyPage
    }) => {
      // Promise.allSettled + per-branch soft-degrade (Finding 2): when the
      // input-asset oracle fails (pre-BE-786 OSS without /api/assets, partial
      // BE-934 deploys, transient network errors), the verifier must finish
      // — marking the candidate missing — rather than leaving isMissing
      // stuck at undefined behind a silent toast.
      await mockAssetListingFailure(comfyPage.page, 500)

      await comfyPage.workflow.loadWorkflow(
        'missing/fe746_load_image_bare_filename'
      )

      await expect
        .poll(() => getCachedMissingMediaNames(comfyPage))
        .toContain(WORKFLOW_WIDGET_VALUE)
    })
  }
)
