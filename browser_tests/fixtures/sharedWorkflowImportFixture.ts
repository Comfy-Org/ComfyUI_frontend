import { test as base } from '@playwright/test'
import type { Page } from '@playwright/test'
import type {
  Asset,
  ImportPublishedAssetsRequest,
  ListAssetsResponse
} from '@comfyorg/ingest-types'
import type { z } from 'zod'

import type { zSharedWorkflowResponse } from '@/platform/workflow/sharing/schemas/shareSchemas'
import type { AssetInfo } from '@/schemas/apiSchema'

type SharedWorkflowResponse = z.input<typeof zSharedWorkflowResponse>

export const sharedWorkflowImportScenario = {
  shareId: 'shared-missing-media-e2e',
  workflowId: 'shared-missing-media-workflow',
  publishedAssetId: 'published-input-asset-1',
  inputFileName: 'shared_imported_image.png'
} as const

type SharedWorkflowRequestEvent =
  | 'import'
  | 'input-assets-including-public-before-import'
  | 'input-assets-including-public-after-import'

export interface SharedWorkflowImportMocks {
  resetAndStartRecording: () => void
  getImportBody: () => ImportPublishedAssetsRequest | undefined
  getRequestEvents: () => SharedWorkflowRequestEvent[]
  waitForPublicInclusiveInputAssetResponseAfterImport: () => Promise<void>
}

const defaultInputFileName = '00000000000000000000000Aexample.png'

const sharedWorkflowAsset: AssetInfo = {
  id: sharedWorkflowImportScenario.publishedAssetId,
  name: sharedWorkflowImportScenario.inputFileName,
  preview_url: '',
  storage_url: '',
  model: false,
  public: false,
  in_library: false
}

const defaultInputAsset: Asset & { hash?: string } = {
  id: 'default-input-asset',
  name: defaultInputFileName,
  hash: defaultInputFileName,
  size: 1_024,
  mime_type: 'image/png',
  tags: ['input'],
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
  last_access_time: '2026-05-01T00:00:00Z'
}

const importedInputAsset: Asset & { hash?: string } = {
  id: 'imported-input-asset',
  name: sharedWorkflowImportScenario.inputFileName,
  hash: sharedWorkflowImportScenario.inputFileName,
  size: 1_024,
  mime_type: 'image/png',
  tags: ['input'],
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
  last_access_time: '2026-05-01T00:00:00Z'
}

const sharedWorkflowResponse: SharedWorkflowResponse = {
  share_id: sharedWorkflowImportScenario.shareId,
  workflow_id: sharedWorkflowImportScenario.workflowId,
  name: 'Shared Missing Media Workflow',
  listed: true,
  publish_time: '2026-05-01T00:00:00Z',
  workflow_json: {
    version: 0.4,
    last_node_id: 10,
    last_link_id: 0,
    nodes: [
      {
        id: 10,
        type: 'LoadImage',
        pos: [50, 200],
        size: [315, 314],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [],
        outputs: [
          {
            name: 'IMAGE',
            type: 'IMAGE',
            links: null
          },
          {
            name: 'MASK',
            type: 'MASK',
            links: null
          }
        ],
        properties: {
          'Node name for S&R': 'LoadImage'
        },
        widgets_values: [sharedWorkflowImportScenario.inputFileName, 'image']
      }
    ],
    links: [],
    groups: [],
    config: {},
    extra: {
      ds: {
        offset: [0, 0],
        scale: 1
      }
    }
  },
  assets: [sharedWorkflowAsset]
}

export const sharedWorkflowImportFixture = base.extend<{
  sharedWorkflowImportMocks: SharedWorkflowImportMocks
}>({
  sharedWorkflowImportMocks: async ({ page }, use) => {
    const mocks = await mockSharedWorkflowImportFlow(page)
    await use(mocks)
  }
})

async function mockSharedWorkflowImportFlow(
  page: Page
): Promise<SharedWorkflowImportMocks> {
  let isRecording = false
  let importEndpointCalled = false
  let importBody: ImportPublishedAssetsRequest | undefined
  let resolvePublicInclusiveInputAssetResponseAfterImport: () => void = () => {}
  let publicInclusiveInputAssetResponseAfterImport = new Promise<void>(
    (resolve) => {
      resolvePublicInclusiveInputAssetResponseAfterImport = resolve
    }
  )
  const requestEvents: SharedWorkflowRequestEvent[] = []

  function resetPublicInclusiveInputAssetResponseWaiter() {
    publicInclusiveInputAssetResponseAfterImport = new Promise<void>(
      (resolve) => {
        resolvePublicInclusiveInputAssetResponseAfterImport = resolve
      }
    )
  }

  function recordRequestEvent(event: SharedWorkflowRequestEvent) {
    if (isRecording) requestEvents.push(event)
  }

  await page.route(
    `**/workflows/published/${sharedWorkflowImportScenario.shareId}`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sharedWorkflowResponse)
      })
    }
  )

  await page.route('**/api/assets/import', async (route) => {
    recordRequestEvent('import')
    importBody = route.request().postDataJSON() as ImportPublishedAssetsRequest
    importEndpointCalled = true

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({})
    })
  })

  // Excludes `/api/assets/import` so the specific route above
  // remains isolated from the general asset listing mock.
  await page.route(/\/api\/assets(?=\?|$)/, async (route) => {
    const url = new URL(route.request().url())
    const includeTags = getTagParam(url, 'include_tags')
    const isInputAssetRequest = includeTags.includes('input')
    const includesPublicAssets =
      url.searchParams.get('include_public') === 'true'
    const isPublicInclusiveInputAssetRequest =
      isInputAssetRequest && includesPublicAssets
    const isAfterImportPublicInclusiveInputAssetRequest =
      isPublicInclusiveInputAssetRequest && importEndpointCalled

    if (isPublicInclusiveInputAssetRequest) {
      recordRequestEvent(
        importEndpointCalled
          ? 'input-assets-including-public-after-import'
          : 'input-assets-including-public-before-import'
      )
    }

    const allAssets = [
      defaultInputAsset,
      ...(importEndpointCalled ? [importedInputAsset] : [])
    ]
    const assets = includeTags.length
      ? allAssets.filter((asset) =>
          includeTags.every((tag) => asset.tags?.includes(tag))
        )
      : allAssets

    const response: ListAssetsResponse = {
      assets,
      total: assets.length,
      has_more: false
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response)
    })

    if (isAfterImportPublicInclusiveInputAssetRequest) {
      resolvePublicInclusiveInputAssetResponseAfterImport()
    }
  })

  return {
    resetAndStartRecording: () => {
      isRecording = true
      importEndpointCalled = false
      importBody = undefined
      requestEvents.length = 0
      resetPublicInclusiveInputAssetResponseWaiter()
    },
    getImportBody: () => importBody,
    getRequestEvents: () => [...requestEvents],
    waitForPublicInclusiveInputAssetResponseAfterImport: () =>
      publicInclusiveInputAssetResponseAfterImport
  }
}

function getTagParam(url: URL, key: string): string[] {
  return (
    url.searchParams
      .get(key)
      ?.split(',')
      .map((tag) => tag.trim())
      .filter(Boolean) ?? []
  )
}
