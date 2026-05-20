import { expect, mergeTests } from '@playwright/test'
import type { Page, Route } from '@playwright/test'
import type { Asset, ListAssetsResponse } from '@comfyorg/ingest-types'

import {
  assetRequestIncludesTag,
  createCloudAssetsFixture
} from '@e2e/fixtures/assetApiFixture'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  createRouteMockJob,
  jobsRouteFixture
} from '@e2e/fixtures/jobsRouteFixture'
import { TestIds } from '@e2e/fixtures/selectors'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'
import type { RawJobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'

const ossTest = mergeTests(comfyPageFixture, jobsRouteFixture)
const outputHash =
  '147257c95a3e957e0deee73a077cfec89da2d906dd086ca70a2b0c897a9591d6e.png'
const plainVideoFileName = 'plain_video.mp4'
const graphDropPosition = { x: 500, y: 300 }
const missingMediaUploadObservationMs = 1_000
const missingMediaUploadPollMs = 100

const cloudOutputAsset: Asset = {
  id: 'test-output-hash-001',
  name: 'ComfyUI_00001_.png',
  asset_hash: outputHash,
  size: 4_194_304,
  mime_type: 'image/png',
  tags: ['output'],
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
  last_access_time: '2026-05-01T00:00:00Z'
}

const cloudUploadedVideoAsset: Asset = {
  id: 'test-uploaded-video-001',
  name: plainVideoFileName,
  asset_hash: plainVideoFileName,
  size: 1_024,
  mime_type: 'video/mp4',
  tags: ['input'],
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
  last_access_time: '2026-05-01T00:00:00Z'
}

// The Cloud test app starts with a default LoadImage node. Keep that baseline
// input resolvable so this spec only observes the media it creates.
const cloudDefaultGraphInputAsset: Asset = {
  id: 'test-default-input-001',
  name: '00000000000000000000000Aexample.png',
  asset_hash: '00000000000000000000000Aexample.png',
  size: 1_024,
  mime_type: 'image/png',
  tags: ['input'],
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
  last_access_time: '2026-05-01T00:00:00Z'
}

interface CloudUploadAssetState {
  isUploadedAssetAvailable: boolean
}

const cloudOutputTest = createCloudAssetsFixture([cloudOutputAsset])
const cloudUploadAssetStateByPage = new WeakMap<Page, CloudUploadAssetState>()
const cloudUploadRaceTest = comfyPageFixture.extend<{
  markUploadedCloudAssetAvailable: () => void
}>({
  page: async ({ page }, use) => {
    const state: CloudUploadAssetState = {
      isUploadedAssetAvailable: false
    }
    cloudUploadAssetStateByPage.set(page, state)

    async function assetsRouteHandler(route: Route) {
      const allAssets = [
        cloudDefaultGraphInputAsset,
        ...(state.isUploadedAssetAvailable ? [cloudUploadedVideoAsset] : [])
      ]
      const includeTags =
        new URL(route.request().url()).searchParams
          .get('include_tags')
          ?.split(',')
          .filter(Boolean) ?? []
      const assets = includeTags.length
        ? allAssets.filter((asset) =>
            asset.tags?.some((tag) => includeTags.includes(tag))
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
    }

    await page.route(/\/api\/assets(?:\?.*)?$/, assetsRouteHandler)
    await use(page)
    await page.unroute(/\/api\/assets(?:\?.*)?$/, assetsRouteHandler)
    cloudUploadAssetStateByPage.delete(page)
  },
  markUploadedCloudAssetAvailable: async ({ page }, use) => {
    await use(() => {
      const state = cloudUploadAssetStateByPage.get(page)
      if (state) state.isUploadedAssetAvailable = true
    })
  }
})

async function enableErrorsTab(comfyPage: ComfyPage) {
  await comfyPage.settings.setSetting(
    'Comfy.RightSidePanel.ShowErrorsTab',
    true
  )
}

function getErrorOverlay(comfyPage: ComfyPage) {
  return comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
}

async function expectNoErrorsTab(comfyPage: ComfyPage) {
  await expect(getErrorOverlay(comfyPage)).toBeHidden()

  const panel = new PropertiesPanelHelper(comfyPage.page)
  await panel.open(comfyPage.actionbar.propertiesButton)
  await expect(
    panel.root.getByTestId(TestIds.propertiesPanel.errorsTab)
  ).toBeHidden()
}

async function delayNextUpload(comfyPage: ComfyPage) {
  let releaseUpload!: () => void
  let resolveUploadStarted!: () => void
  const uploadStarted = new Promise<void>((resolve) => {
    resolveUploadStarted = resolve
  })
  const release = new Promise<void>((resolve) => {
    releaseUpload = resolve
  })

  async function uploadRouteHandler(route: Route) {
    resolveUploadStarted()
    await release
    await route.continue()
  }

  await comfyPage.page.route('**/upload/image', uploadRouteHandler)

  return {
    waitForUploadStarted: () => uploadStarted,
    finishUpload: async () => {
      const uploadResponse = comfyPage.page.waitForResponse(
        (response) =>
          response.url().includes('/upload/image') && response.status() === 200,
        { timeout: 10_000 }
      )
      releaseUpload()
      try {
        await uploadResponse
      } finally {
        await comfyPage.page.unroute('**/upload/image', uploadRouteHandler)
      }
    }
  }
}

async function expectLoadVideoUploading(comfyPage: ComfyPage) {
  await expect
    .poll(
      () =>
        comfyPage.page.evaluate(() =>
          window.app!.graph.nodes.some(
            (node) => node.type === 'LoadVideo' && node.isUploading
          )
        ),
      { timeout: 5_000 }
    )
    .toBe(true)
}

async function expectNoMissingMediaDuringUpload(comfyPage: ComfyPage) {
  await comfyPage.nextFrame()
  await comfyPage.nextFrame()

  let sawErrorOverlay = false
  const startedAt = Date.now()
  await expect
    .poll(
      async () => {
        sawErrorOverlay =
          sawErrorOverlay || (await getErrorOverlay(comfyPage).isVisible())
        return (
          !sawErrorOverlay &&
          Date.now() - startedAt >= missingMediaUploadObservationMs
        )
      },
      {
        timeout: missingMediaUploadObservationMs + missingMediaUploadPollMs * 5,
        intervals: [missingMediaUploadPollMs]
      }
    )
    .toBe(true)
}

function outputHistoryJobs(): RawJobListItem[] {
  return [
    createRouteMockJob({
      id: 'history-output-image',
      preview_output: {
        filename: 'ComfyUI_00001_.png',
        subfolder: '',
        type: 'output',
        nodeId: '1',
        mediaType: 'images'
      }
    }),
    createRouteMockJob({
      id: 'history-output-video',
      preview_output: {
        filename: 'clip.mp4',
        subfolder: '',
        type: 'output',
        nodeId: '2',
        mediaType: 'video'
      }
    }),
    createRouteMockJob({
      id: 'history-output-audio',
      preview_output: {
        filename: 'sound.wav',
        subfolder: '',
        type: 'output',
        nodeId: '3',
        mediaType: 'audio'
      }
    })
  ]
}

ossTest.describe(
  'Errors tab - OSS missing media runtime sources',
  { tag: '@ui' },
  () => {
    ossTest.beforeEach(async ({ comfyPage }) => {
      await enableErrorsTab(comfyPage)
    })

    ossTest(
      'resolves annotated output media from job history',
      async ({ comfyPage, jobsRoutes }) => {
        await jobsRoutes.mockJobsHistory(outputHistoryJobs())
        await jobsRoutes.mockJobsQueue([])

        await comfyPage.workflow.loadWorkflow(
          'missing/missing_media_output_annotations'
        )

        await expectNoErrorsTab(comfyPage)
      }
    )

    ossTest(
      'does not surface missing media while dropped video upload is in progress',
      async ({ comfyFiles, comfyPage }) => {
        await comfyPage.nodeOps.clearGraph()
        const delayedUpload = await delayNextUpload(comfyPage)

        await comfyPage.dragDrop.dragAndDropFile(plainVideoFileName, {
          dropPosition: graphDropPosition
        })
        await delayedUpload.waitForUploadStarted()
        comfyFiles.deleteAfterTest({
          filename: plainVideoFileName,
          type: 'input'
        })

        await expectLoadVideoUploading(comfyPage)
        await expectNoMissingMediaDuringUpload(comfyPage)

        await delayedUpload.finishUpload()
        await expect(getErrorOverlay(comfyPage)).toBeHidden()
      }
    )
  }
)

cloudOutputTest.describe(
  'Errors tab - Cloud missing media runtime sources',
  { tag: '@cloud' },
  () => {
    cloudOutputTest.beforeEach(async ({ comfyPage }) => {
      await enableErrorsTab(comfyPage)
    })

    cloudOutputTest(
      'resolves compact annotated output media from output assets',
      async ({ cloudAssetRequests, comfyPage }) => {
        await comfyPage.workflow.loadWorkflow(
          'missing/missing_media_cloud_output_annotation'
        )

        await expect
          .poll(() =>
            cloudAssetRequests.some((url) =>
              assetRequestIncludesTag(url, 'output')
            )
          )
          .toBe(true)
        await expectNoErrorsTab(comfyPage)
      }
    )
  }
)

cloudUploadRaceTest.describe(
  'Errors tab - Cloud missing media upload race',
  { tag: '@cloud' },
  () => {
    cloudUploadRaceTest.beforeEach(async ({ comfyPage }) => {
      await enableErrorsTab(comfyPage)
    })

    cloudUploadRaceTest(
      'does not surface missing media while dropped video upload is in progress',
      async ({ comfyFiles, comfyPage, markUploadedCloudAssetAvailable }) => {
        await comfyPage.nodeOps.clearGraph()
        const delayedUpload = await delayNextUpload(comfyPage)

        await comfyPage.dragDrop.dragAndDropFile(plainVideoFileName, {
          dropPosition: graphDropPosition
        })
        await delayedUpload.waitForUploadStarted()
        comfyFiles.deleteAfterTest({
          filename: plainVideoFileName,
          type: 'input'
        })

        await expectLoadVideoUploading(comfyPage)
        await expectNoMissingMediaDuringUpload(comfyPage)

        markUploadedCloudAssetAvailable()
        await delayedUpload.finishUpload()
        await expect(getErrorOverlay(comfyPage)).toBeHidden()
      }
    )
  }
)
