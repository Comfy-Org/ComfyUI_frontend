import { expect, mergeTests } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { webSocketFixture } from '@e2e/fixtures/ws'

import type {
  DownloadStatus,
  EnqueueResponse,
  ProviderAuthStatus
} from '@/platform/modelManager/types'

const test = mergeTests(comfyPageFixture, webSocketFixture)

const DOWNLOADS_ROUTE = /\/api\/download$/
const ENQUEUE_ROUTE = /\/api\/download\/enqueue$/
const AUTH_ROUTE = /\/api\/download\/auth$/
const CLEAR_ROUTE = /\/api\/download\/clear$/

const DOWNLOAD_ID = 'e2e-download-1'
const MODEL_URL =
  'https://huggingface.co/e2e/test/resolve/main/model.safetensors'
const MODEL_ID = 'checkpoints/e2e-test-model.safetensors'

function makeDownloadStatus(
  overrides: Partial<DownloadStatus> = {}
): DownloadStatus {
  const now = Math.floor(Date.now() / 1000)
  return {
    download_id: DOWNLOAD_ID,
    model_id: MODEL_ID,
    url: MODEL_URL,
    status: 'queued',
    priority: 0,
    total_bytes: null,
    bytes_done: 0,
    progress: null,
    speed_bps: null,
    eta_seconds: null,
    segments: null,
    error: null,
    created_at: now,
    updated_at: now,
    ...overrides
  }
}

async function enableServerSideModelDownloads(comfyPage: ComfyPage) {
  await comfyPage.page.evaluate(() => {
    window.app!.api.serverFeatureFlags.value = {
      ...window.app!.api.serverFeatureFlags.value,
      server_side_model_downloads: true
    }
  })
}

/** Keeps GET /download consistent so the 5s stale-poll can't wipe test state. */
async function mockDownloadsList(
  page: Page,
  getDownloads: () => DownloadStatus[]
) {
  await page.route(DOWNLOADS_ROUTE, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    await route.fulfill(jsonRoute({ downloads: getDownloads() }))
  })
}

function modelDownloaderTabButton(comfyPage: ComfyPage) {
  return comfyPage.page.locator('.model-manager-tab-button')
}

function modelDownloaderBadge(comfyPage: ComfyPage) {
  return modelDownloaderTabButton(comfyPage).locator('.sidebar-icon-badge')
}

function modelDownloaderPanel(comfyPage: ComfyPage) {
  return comfyPage.page.locator('.sidebar-content-container')
}

async function openModelDownloaderTab(comfyPage: ComfyPage) {
  await modelDownloaderTabButton(comfyPage).click()
  const panel = modelDownloaderPanel(comfyPage)
  await expect(panel.getByText('Downloads', { exact: true })).toBeVisible()
  // Toolbar buttons are only interactive while the tab panel is hovered
  // (`group-hover/sidebar-tab`), so keep the cursor over it for later clicks.
  await panel.hover()
}

test.describe('Model Downloader sidebar', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.modelLibrary.mockFoldersWithFiles({ checkpoints: [] })
    // Isolate from any real downloads already tracked by the backend.
    await mockDownloadsList(comfyPage.page, () => [])
    await enableServerSideModelDownloads(comfyPage)
  })

  test('adds a model by URL and reflects live progress over the websocket', async ({
    comfyPage,
    getWebSocket
  }) => {
    let downloads: DownloadStatus[] = []
    await mockDownloadsList(comfyPage.page, () => downloads)
    await comfyPage.page.route(ENQUEUE_ROUTE, async (route) => {
      downloads = [makeDownloadStatus()]
      const response: EnqueueResponse = {
        download_id: DOWNLOAD_ID,
        accepted: true
      }
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify(response)
      })
    })

    await openModelDownloaderTab(comfyPage)
    const panel = modelDownloaderPanel(comfyPage)
    await panel.getByTitle('Add model').click()

    const addDialog = comfyPage.page.getByRole('dialog')
    await expect(addDialog.getByText('Add model')).toBeVisible()

    await addDialog.getByLabel('URL').fill(MODEL_URL)
    await expect(addDialog.getByLabel('Filename')).toHaveValue(
      'model.safetensors'
    )
    await addDialog.getByLabel('Filename').fill('e2e-test-model.safetensors')
    await addDialog.getByRole('combobox', { name: 'Select a folder' }).click()
    await comfyPage.page
      .getByRole('option', { name: 'Checkpoints', exact: true })
      .click()

    await addDialog
      .getByRole('button', { name: 'Download', exact: true })
      .click()
    await expect(addDialog).toBeHidden()

    await expect(panel.getByText('e2e-test-model.safetensors')).toBeVisible()
    await expect(panel.getByText('Queued', { exact: true })).toBeVisible()
    await expect(modelDownloaderBadge(comfyPage)).toHaveText('1')

    const ws = await getWebSocket()
    function sendProgress(overrides: Partial<DownloadStatus>) {
      const payload = makeDownloadStatus(overrides)
      downloads = [payload]
      ws.send(JSON.stringify({ type: 'download_progress', data: payload }))
    }

    sendProgress({
      status: 'active',
      progress: 0.4,
      bytes_done: 400,
      total_bytes: 1000,
      speed_bps: 500_000
    })

    await expect(panel.getByText('Downloading', { exact: true })).toBeVisible()
    await expect(panel.getByText(/40%/)).toBeVisible()
    await expect(modelDownloaderBadge(comfyPage)).toHaveText('1')

    sendProgress({
      status: 'completed',
      progress: 1,
      bytes_done: 1000,
      total_bytes: 1000,
      speed_bps: null,
      eta_seconds: null
    })

    await expect(panel.getByText('Completed', { exact: true })).toBeVisible()
    await expect(panel.getByText('History', { exact: true })).toBeVisible()
    await expect(modelDownloaderBadge(comfyPage)).toHaveCount(0)
  })

  test('clears history and the cleared rows stay gone after reopening the tab', async ({
    comfyPage
  }) => {
    let downloads: DownloadStatus[] = [
      makeDownloadStatus({ status: 'completed', progress: 1, bytes_done: 1000 })
    ]
    await mockDownloadsList(comfyPage.page, () => downloads)
    await comfyPage.page.route(CLEAR_ROUTE, async (route) => {
      const count = downloads.length
      downloads = []
      await route.fulfill(jsonRoute({ deleted: count }))
    })

    await openModelDownloaderTab(comfyPage)
    const panel = modelDownloaderPanel(comfyPage)
    await expect(panel.getByText('History', { exact: true })).toBeVisible()
    await expect(panel.getByText('e2e-test-model.safetensors')).toBeVisible()

    await panel.getByRole('button', { name: 'Clear history' }).click()
    await expect(panel.getByText('No downloads yet')).toBeVisible()

    // Reopening the tab re-runs hydrate() -> GET /api/download. The bug was
    // that the cleared row reappeared here; the persisted delete must prevent
    // the backend list from returning it again.
    await modelDownloaderTabButton(comfyPage).click()
    await openModelDownloaderTab(comfyPage)
    await expect(
      modelDownloaderPanel(comfyPage).getByText('No downloads yet')
    ).toBeVisible()
    await expect(
      modelDownloaderPanel(comfyPage).getByText('e2e-test-model.safetensors')
    ).toBeHidden()
  })

  test('shows per-provider download auth status in the access dialog', async ({
    comfyPage
  }) => {
    const providers: ProviderAuthStatus[] = [
      {
        provider: 'huggingface',
        env_key_present: true,
        logged_in: false,
        login_in_progress: false
      },
      {
        provider: 'civitai',
        env_key_present: false,
        logged_in: false,
        login_in_progress: false
      }
    ]
    await comfyPage.page.route(AUTH_ROUTE, async (route) => {
      if (route.request().method() !== 'GET') return route.fallback()
      await route.fulfill(jsonRoute({ providers }))
    })

    await openModelDownloaderTab(comfyPage)
    const panel = modelDownloaderPanel(comfyPage)
    await panel.getByTitle('Download access').click()

    const dialog = comfyPage.page
      .getByRole('dialog')
      .filter({ hasText: 'Download access' })
    await expect(dialog.getByText('HuggingFace')).toBeVisible()
    await expect(dialog.getByText('API key set on the server')).toBeVisible()

    // Civitai is unauthenticated; on this loopback deployment the OAuth login
    // action is offered.
    await expect(dialog.getByRole('button', { name: 'Log in' })).toBeVisible()
    await expect(
      dialog.getByRole('button', { name: 'How to add an API key' })
    ).toBeVisible()
  })
})
