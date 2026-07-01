import { expect, mergeTests } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { ConfirmDialog } from '@e2e/fixtures/components/ConfirmDialog'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { webSocketFixture } from '@e2e/fixtures/ws'

import type {
  DownloadStatus,
  EnqueueResponse,
  HostCredentialUpsert,
  HostCredentialView
} from '@/platform/modelManager/types'

const test = mergeTests(comfyPageFixture, webSocketFixture)

const DOWNLOADS_ROUTE = /\/api\/download$/
const ENQUEUE_ROUTE = /\/api\/download\/enqueue$/
const CREDENTIALS_ROUTE = /\/api\/download\/credentials$/
const CREDENTIAL_ROUTE = /\/api\/download\/credentials\/([^/?]+)$/

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
  await expect(
    panel.getByText('Model Downloader', { exact: true })
  ).toBeVisible()
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

  test('manages download credentials: add, edit, and delete', async ({
    comfyPage
  }) => {
    let credentials: HostCredentialView[] = []
    let nextId = 1

    await comfyPage.page.route(CREDENTIALS_ROUTE, async (route) => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill(jsonRoute({ credentials }))
        return
      }
      if (method === 'POST') {
        const body = route.request().postDataJSON() as HostCredentialUpsert
        const existing = credentials.find((c) => c.host === body.host)
        const now = Math.floor(Date.now() / 1000)
        const view: HostCredentialView = {
          id: existing?.id ?? `cred-${nextId++}`,
          host: body.host,
          auth_scheme: body.auth_scheme ?? 'bearer',
          header_name: body.header_name ?? null,
          query_param: body.query_param ?? null,
          label: body.label ?? null,
          match_subdomains: body.match_subdomains ?? false,
          enabled: body.enabled ?? true,
          secret_last4: body.secret.slice(-4),
          created_at: existing?.created_at ?? now,
          updated_at: now
        }
        credentials = existing
          ? credentials.map((c) => (c.id === view.id ? view : c))
          : [...credentials, view]
        await route.fulfill(jsonRoute(view))
        return
      }
      await route.fallback()
    })
    await comfyPage.page.route(CREDENTIAL_ROUTE, async (route) => {
      if (route.request().method() !== 'DELETE') return route.fallback()
      const id = route.request().url().match(CREDENTIAL_ROUTE)?.[1]
      credentials = credentials.filter((c) => c.id !== id)
      await route.fulfill(jsonRoute({ deleted: true }))
    })

    const dialog = comfyPage.page
      .getByRole('dialog')
      .filter({ hasText: 'Credentials Manager' })

    // The success toast shown after saving can momentarily steal focus and
    // close the dialog, so re-opening is retried until it sticks.
    async function ensureCredentialsDialogOpen() {
      await expect(async () => {
        const panel = modelDownloaderPanel(comfyPage)
        await panel.hover()
        await panel.getByTitle('Credentials Manager').click()
        await expect(dialog).toBeVisible({ timeout: 1000 })
      }).toPass({ timeout: 10_000 })
    }

    await openModelDownloaderTab(comfyPage)
    await ensureCredentialsDialogOpen()

    await dialog.getByLabel('Host').fill('huggingface.co')
    await dialog.getByLabel('API key').fill('secret-key-1234')
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()

    await ensureCredentialsDialogOpen()
    await expect(
      dialog.getByText('huggingface.co · Bearer token · ••••1234')
    ).toBeVisible()

    await dialog.getByTitle('Edit').click()
    await expect(dialog.getByText('Update credential')).toBeVisible()
    await expect(dialog.getByLabel('API key')).toHaveValue('')
    await dialog.getByLabel('Label').fill('My HF Key')
    await dialog.getByLabel('API key').fill('updated-secret-5678')
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()

    await ensureCredentialsDialogOpen()
    await expect(dialog.getByText('My HF Key')).toBeVisible()
    await expect(
      dialog.getByText('huggingface.co · Bearer token · ••••5678')
    ).toBeVisible()

    await dialog.getByTitle('Delete').click()
    const confirm = new ConfirmDialog(comfyPage.page)
    await confirm.click('delete')

    await expect(dialog.getByText('My HF Key')).toBeHidden()
  })
})
