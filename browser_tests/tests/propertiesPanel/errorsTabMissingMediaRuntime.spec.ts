import { expect, mergeTests } from '@playwright/test'
import type { Page, Route } from '@playwright/test'
import type {
  Asset,
  GetAllSettingsResponse,
  GetSettingByKeyResponse,
  ListAssetsResponse
} from '@comfyorg/ingest-types'

import {
  assetRequestIncludesTag,
  createCloudAssetsFixture
} from '@e2e/fixtures/assetApiFixture'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { WorkspaceStore } from '@e2e/types/globals'
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
const outputVideoHash = 'cloud-video-hash.mp4'
const plainVideoFileName = 'plain_video.mp4'
const graphDropPosition = { x: 500, y: 300 }
const missingMediaObservationMs = 1_000
const missingMediaPollMs = 100
const emptyMediaLoaderNodes = [
  {
    nodeType: 'LoadImage',
    widgetName: 'image',
    serverOnlyOption: 'server-only-image.png',
    position: { x: 150, y: 150 }
  },
  {
    nodeType: 'LoadVideo',
    widgetName: 'file',
    serverOnlyOption: 'server-only-video.mp4',
    position: { x: 450, y: 150 }
  },
  {
    nodeType: 'LoadAudio',
    widgetName: 'audio',
    serverOnlyOption: 'server-only-audio.wav',
    position: { x: 750, y: 150 }
  }
]

const cloudOutputAsset: Asset & { hash?: string } = {
  id: 'test-output-hash-001',
  name: 'ComfyUI_00001_.png',
  hash: outputHash,
  size: 4_194_304,
  mime_type: 'image/png',
  tags: ['output'],
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
  last_access_time: '2026-05-01T00:00:00Z'
}

const cloudOutputVideoAsset: Asset & { hash?: string } = {
  id: 'test-output-video-hash-001',
  name: 'ComfyUI_00001_.mp4',
  hash: outputVideoHash,
  size: 4_194_304,
  mime_type: 'video/mp4',
  tags: ['output'],
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
  last_access_time: '2026-05-01T00:00:00Z'
}

const cloudUploadedVideoAsset: Asset & { hash?: string } = {
  id: 'test-uploaded-video-001',
  name: plainVideoFileName,
  hash: plainVideoFileName,
  size: 1_024,
  mime_type: 'video/mp4',
  tags: ['input'],
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
  last_access_time: '2026-05-01T00:00:00Z'
}

// The Cloud test app starts with a default LoadImage node. Keep that baseline
// input resolvable so this spec only observes the media it creates.
const cloudDefaultGraphInputAsset: Asset & { hash?: string } = {
  id: 'test-default-input-001',
  name: '00000000000000000000000Aexample.png',
  hash: '00000000000000000000000Aexample.png',
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

type ObjectInfoResponse = Record<
  string,
  { input?: { required?: Record<string, unknown> } }
>

function setComboInputOptions(
  objectInfo: ObjectInfoResponse,
  nodeType: string,
  inputName: string,
  values: string[]
) {
  const nodeInfo = objectInfo[nodeType]
  if (!nodeInfo) {
    throw new Error(`Missing object_info entry for ${nodeType}`)
  }

  const requiredInputs = nodeInfo.input?.required
  if (!requiredInputs) {
    throw new Error(`Missing required inputs for ${nodeType}`)
  }

  const input = requiredInputs[inputName]
  if (!Array.isArray(input)) {
    throw new Error(`Expected ${nodeType}.${inputName} to be a combo input`)
  }

  const [valuesOrType, options] = input
  const optionsObject =
    options && typeof options === 'object' && !Array.isArray(options)
  if (Array.isArray(valuesOrType)) {
    input[0] = values
  } else if (valuesOrType !== 'COMBO') {
    throw new Error(`Expected ${nodeType}.${inputName} to have combo options`)
  }

  if (optionsObject) {
    Object.assign(options, { options: values })
  } else if (!Array.isArray(valuesOrType)) {
    throw new Error(
      `Expected ${nodeType}.${inputName} to have options metadata`
    )
  }
}

async function routeCloudBootstrapApis(page: Page) {
  await page.route('**/api/settings**', async (route) => {
    const completedSurveySetting: GetSettingByKeyResponse = {
      value: { usage: 'personal' }
    }
    const allSettings: GetAllSettingsResponse = {}
    const body = route
      .request()
      .url()
      .includes('/api/settings/onboarding_survey')
      ? completedSurveySetting
      : allSettings

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    })
  })
  await page.route('**/api/userdata**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([])
    })
  })
  await page.route('**/i18n', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({})
    })
  })
  await page.route('**/customers/cloud-subscription-status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ is_active: true })
    })
  })
}

async function routeSetupObjectInfo(
  page: Page,
  customize?: (objectInfo: ObjectInfoResponse) => void
) {
  const setupApiUrl =
    process.env.PLAYWRIGHT_SETUP_API_URL ?? 'http://127.0.0.1:8188'
  const objectInfoUrl = new URL('/object_info', setupApiUrl).toString()

  const objectInfoRouteHandler = async (route: Route) => {
    try {
      const response = await fetch(objectInfoUrl, {
        signal: AbortSignal.timeout(5_000)
      })
      if (!response.ok) {
        await route.fulfill({
          status: response.status,
          contentType: response.headers.get('content-type') ?? 'text/plain',
          body: await response.text()
        })
        return
      }

      const objectInfo = (await response.json()) as ObjectInfoResponse
      customize?.(objectInfo)

      await route.fulfill({
        status: response.status,
        contentType: 'application/json',
        body: JSON.stringify(objectInfo)
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({
          error: `Failed to fetch setup object_info from ${objectInfoUrl}: ${message}`
        })
      })
    }
  }

  await page.route('**/object_info', objectInfoRouteHandler)
  return async () =>
    await page.unroute('**/object_info', objectInfoRouteHandler)
}

const cloudOutputTest = createCloudAssetsFixture([
  cloudOutputAsset,
  cloudOutputVideoAsset
]).extend({
  page: async ({ page }, use) => {
    await routeCloudBootstrapApis(page)
    const unrouteObjectInfo = await routeSetupObjectInfo(page)

    try {
      await use(page)
    } finally {
      await unrouteObjectInfo()
    }
  }
})

const cloudEmptyMediaInputsTest = createCloudAssetsFixture([]).extend({
  page: async ({ page }, use) => {
    await routeCloudBootstrapApis(page)

    const unrouteObjectInfo = await routeSetupObjectInfo(page, (objectInfo) => {
      for (const node of emptyMediaLoaderNodes) {
        setComboInputOptions(objectInfo, node.nodeType, node.widgetName, [
          node.serverOnlyOption
        ])
      }
    })

    try {
      await use(page)
    } finally {
      await unrouteObjectInfo()
    }
  }
})
const cloudUploadAssetStateByPage = new WeakMap<Page, CloudUploadAssetState>()
const cloudUploadRaceTest = comfyPageFixture.extend<{
  markUploadedCloudAssetAvailable: () => void
}>({
  page: async ({ page }, use) => {
    await routeCloudBootstrapApis(page)
    const unrouteObjectInfo = await routeSetupObjectInfo(page)

    const state: CloudUploadAssetState = {
      isUploadedAssetAvailable: false
    }
    cloudUploadAssetStateByPage.set(page, state)

    const assetsRouteHandler = async (route: Route) => {
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
    try {
      await use(page)
    } finally {
      await page.unroute(/\/api\/assets(?:\?.*)?$/, assetsRouteHandler)
      await unrouteObjectInfo()
      cloudUploadAssetStateByPage.delete(page)
    }
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

function isOutputAssetsRequest(url: string) {
  return url.includes('/api/assets') && assetRequestIncludesTag(url, 'output')
}

async function waitForOutputAssetsResponse(comfyPage: ComfyPage) {
  await comfyPage.page.waitForResponse(
    (response) =>
      response.status() === 200 && isOutputAssetsRequest(response.url())
  )
}

async function getCachedMissingMediaWarningNames(
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

async function expectNoErrorsTab(comfyPage: ComfyPage) {
  await expect(getErrorOverlay(comfyPage)).toBeHidden()

  const panel = new PropertiesPanelHelper(comfyPage.page)
  await panel.open(comfyPage.actionbar.propertiesButton)
  await expect(
    panel.root.getByTestId(TestIds.propertiesPanel.errorsTab)
  ).toBeHidden()
}

async function closeTemplatesDialogIfOpen(comfyPage: ComfyPage) {
  const templatesDialog = comfyPage.page.getByRole('dialog').filter({
    has: comfyPage.templates.content
  })
  const closeButton = templatesDialog.getByRole('button', {
    name: 'Close dialog'
  })
  await closeButton
    .waitFor({ state: 'visible', timeout: 1_000 })
    .catch(() => undefined)

  if (await closeButton.isVisible()) {
    await closeButton.click()
    await expect(templatesDialog).toBeHidden()
  }
}

async function getMediaLoaderWidgetValues(comfyPage: ComfyPage) {
  return await comfyPage.page.evaluate((nodes) => {
    return nodes.map(({ nodeType, widgetName }) => {
      const node = window.app!.graph.nodes.find(
        (graphNode) => graphNode.type === nodeType
      )
      const widget = node?.widgets?.find(
        (candidate) => candidate.name === widgetName
      )
      return widget?.value ?? null
    })
  }, emptyMediaLoaderNodes)
}

async function delayNextUpload(
  comfyPage: ComfyPage,
  uploadResult?: { name: string; subfolder: string; type: 'input' }
) {
  let releaseUpload!: () => void
  let resolveUploadStarted!: () => void
  const uploadStarted = new Promise<void>((resolve) => {
    resolveUploadStarted = resolve
  })
  const release = new Promise<void>((resolve) => {
    releaseUpload = resolve
  })

  const uploadRouteHandler = async (route: Route) => {
    resolveUploadStarted()
    await release
    if (uploadResult) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(uploadResult)
      })
      return
    }
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

async function expectNoMissingMediaForObservationWindow(comfyPage: ComfyPage) {
  await comfyPage.nextFrame()
  await comfyPage.nextFrame()

  let sawErrorOverlay = false
  let sawCachedMissingMedia = false
  const startedAt = Date.now()
  await expect
    .poll(
      async () => {
        const cachedMissingMedia =
          await getCachedMissingMediaWarningNames(comfyPage)
        sawCachedMissingMedia =
          sawCachedMissingMedia || !!cachedMissingMedia?.length
        sawErrorOverlay =
          sawErrorOverlay || (await getErrorOverlay(comfyPage).isVisible())
        return (
          !sawErrorOverlay &&
          !sawCachedMissingMedia &&
          Date.now() - startedAt >= missingMediaObservationMs
        )
      },
      {
        timeout: missingMediaObservationMs + missingMediaPollMs * 5,
        intervals: [missingMediaPollMs]
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
        await expectNoMissingMediaForObservationWindow(comfyPage)

        await delayedUpload.finishUpload()
        await expect(getErrorOverlay(comfyPage)).toBeHidden()
      }
    )
  }
)

cloudEmptyMediaInputsTest.describe(
  'Errors tab - Cloud empty media loader inputs',
  { tag: '@cloud' },
  () => {
    cloudEmptyMediaInputsTest.beforeEach(async ({ comfyPage }) => {
      await enableErrorsTab(comfyPage)
      await closeTemplatesDialogIfOpen(comfyPage)
    })

    cloudEmptyMediaInputsTest(
      'does not surface missing inputs after adding LoadImage, LoadVideo, and LoadAudio nodes with no cloud input assets',
      async ({ cloudAssetRequests, comfyPage }) => {
        await comfyPage.nodeOps.clearGraph()

        for (const node of emptyMediaLoaderNodes) {
          await comfyPage.nodeOps.addNode(
            node.nodeType,
            undefined,
            node.position
          )
        }

        await expect
          .poll(() =>
            cloudAssetRequests.some((url) =>
              assetRequestIncludesTag(url, 'input')
            )
          )
          .toBe(true)
        await expect
          .poll(() => getMediaLoaderWidgetValues(comfyPage))
          .toEqual(['', '', ''])
        await expectNoErrorsTab(comfyPage)
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
      await closeTemplatesDialogIfOpen(comfyPage)
    })

    cloudOutputTest(
      'resolves compact annotated output media from output assets',
      async ({ comfyPage }) => {
        const outputAssetsResponse = waitForOutputAssetsResponse(comfyPage)

        await comfyPage.workflow.loadWorkflow(
          'missing/missing_media_cloud_output_annotation'
        )

        await outputAssetsResponse
        await expectNoMissingMediaForObservationWindow(comfyPage)
        await expectNoErrorsTab(comfyPage)
      }
    )

    cloudOutputTest(
      'resolves subfoldered output video media from flat output asset hashes',
      async ({ comfyPage }) => {
        const outputAssetsResponse = waitForOutputAssetsResponse(comfyPage)

        await comfyPage.workflow.loadWorkflow(
          'missing/missing_media_cloud_output_video_subfolder'
        )

        await outputAssetsResponse
        await expectNoMissingMediaForObservationWindow(comfyPage)
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
      await closeTemplatesDialogIfOpen(comfyPage)
    })

    cloudUploadRaceTest(
      'does not surface missing media while dropped video upload is in progress',
      async ({ comfyFiles, comfyPage, markUploadedCloudAssetAvailable }) => {
        await comfyPage.nodeOps.clearGraph()
        const delayedUpload = await delayNextUpload(comfyPage, {
          name: plainVideoFileName,
          subfolder: '',
          type: 'input'
        })

        await comfyPage.dragDrop.dragAndDropFile(plainVideoFileName, {
          dropPosition: graphDropPosition
        })
        await delayedUpload.waitForUploadStarted()
        comfyFiles.deleteAfterTest({
          filename: plainVideoFileName,
          type: 'input'
        })

        await expectLoadVideoUploading(comfyPage)
        await expectNoMissingMediaForObservationWindow(comfyPage)

        markUploadedCloudAssetAvailable()
        await delayedUpload.finishUpload()
        await expect(getErrorOverlay(comfyPage)).toBeHidden()
      }
    )
  }
)
