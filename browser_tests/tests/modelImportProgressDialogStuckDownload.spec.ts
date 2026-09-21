import type { Page } from '@playwright/test'

import type { TaskResponse } from '@/platform/tasks/services/taskService'

import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

/**
 * REGRESSION COVERAGE PM-1302 / PM-1309 (frontend half):
 *
 * On the cloud side, `HandleDownloadFile` (download_file.go) can broadcast a
 * terminal `failed` message for a retryable error before asynq decides
 * whether a retry will happen, then quietly retries. `assetDownloadStore`
 * (src/stores/assetDownloadStore.ts) now treats a `failed` status as
 * recoverable rather than final, so a later `completed` message for the same
 * `task_id` still updates it - keeping the ModelImportProgressDialog toast
 * from getting stuck reporting a download as failed forever when it actually
 * finished successfully.
 *
 * This test drives that exact WS sequence through the real `asset_download`
 * client event (the same event `assetDownloadStore` listens on in
 * production) and proves the toast recovers once the later success message
 * arrives.
 */
const TASK_ID = 'pm-1302-repro-task'
const ASSET_NAME = 'stuck-model.safetensors'

interface AssetDownloadMessage {
  task_id: string
  asset_name: string
  bytes_total: number
  bytes_downloaded: number
  progress: number
  status: 'created' | 'running' | 'completed' | 'failed'
  asset_id?: string
  error?: string
}

async function dispatchAssetDownload(
  page: Page,
  message: AssetDownloadMessage
) {
  await page.evaluate((msg) => {
    window.app!.api.dispatchCustomEvent('asset_download', msg)
  }, message)
}

test.describe(
  'Model import progress toast - stuck download status',
  { tag: ['@screenshot'] },
  () => {
    test('recovers from a premature failed status once the backend silently retries and completes it (PM-1302)', async ({
      comfyPage
    }) => {
      const { page } = comfyPage

      // 1. Download starts.
      await dispatchAssetDownload(page, {
        task_id: TASK_ID,
        asset_name: ASSET_NAME,
        bytes_total: 1000,
        bytes_downloaded: 200,
        progress: 20,
        status: 'running'
      })

      const toastHeader = page.getByText('Importing Models', { exact: true })
      await expect(toastHeader).toBeVisible()

      // 2. Backend hits a retryable error and (per the bug in
      // download_file.go's HandleDownloadFile) broadcasts a premature
      // terminal `failed` message before it decides to retry.
      await dispatchAssetDownload(page, {
        task_id: TASK_ID,
        asset_name: ASSET_NAME,
        bytes_total: 1000,
        bytes_downloaded: 200,
        progress: 20,
        status: 'failed',
        error: 'Source server error'
      })

      const failedFooterText = page.getByText('1 download failed', {
        exact: true
      })
      await expect(failedFooterText).toBeVisible()

      // 3. Backend silently retried (asynq's StatusMiddleware reset the task
      // to pending) and the retry succeeded - cloud broadcasts the real,
      // later `completed` message for the same task_id.
      await dispatchAssetDownload(page, {
        task_id: TASK_ID,
        asset_name: ASSET_NAME,
        asset_id: 'asset-pm-1302',
        bytes_total: 1000,
        bytes_downloaded: 1000,
        progress: 100,
        status: 'completed'
      })
      await comfyPage.nextFrame()

      // The later `completed` message updates the download rather than
      // being dropped, so the toast reflects the real, successful outcome.
      await expect(failedFooterText).toBeHidden()
      await expect(
        page.getByText('All downloads completed', { exact: true })
      ).toBeVisible()

      // Scoped to the toast: a full-`body` screenshot also captures the
      // canvas graph background, which isn't pixel-stable across CI runs.
      const toast = page
        .getByRole('status')
        .filter({ hasText: 'All downloads completed' })

      // Visual proof of the recovered, completed toast state.
      await expect(toast).toHaveScreenshot(
        'model-import-progress-toast-recovered-completed.png',
        { mask: [toast.locator('.timestamp')] }
      )
    })

    test('a failed download toast can still be manually dismissed when no later recovery message arrives (PM-1302)', async ({
      comfyPage
    }) => {
      const { page } = comfyPage

      // Same premature-failed sequence as above, minus the later `completed`
      // message - the point here is only whether the user can get rid of a
      // failed toast on their own when the backend never does send a
      // recovery message.
      await dispatchAssetDownload(page, {
        task_id: TASK_ID,
        asset_name: ASSET_NAME,
        bytes_total: 1000,
        bytes_downloaded: 200,
        progress: 20,
        status: 'running'
      })
      await dispatchAssetDownload(page, {
        task_id: TASK_ID,
        asset_name: ASSET_NAME,
        bytes_total: 1000,
        bytes_downloaded: 200,
        progress: 20,
        status: 'failed',
        error: 'Source server error'
      })

      // Scoped by footer text: `getByRole('status')` alone also matches the
      // top-menu action bar's own status region and is a strict-mode
      // violation with two toasts on screen.
      const toast = page
        .getByRole('status')
        .filter({ hasText: '1 download failed' })
      await expect(toast).toBeVisible()
      await expect(
        page.getByText('1 download failed', { exact: true })
      ).toBeVisible()

      // `isInProgress` is false once a `failed` status lands, so
      // ModelImportProgressDialog's close (X) button renders and is
      // clickable regardless of whether a later recovery message ever
      // arrives.
      //
      // Scoped to `toast`: `page.getByRole('button', { name: 'Close' })`
      // alone also matches the canvas minimap's close button
      // (`data-testid="close-minimap-button"`) and is a strict-mode
      // violation with the minimap visible.
      await toast.getByRole('button', { name: 'Close' }).click()

      await expect(toast).toBeHidden()
    })

    test('closing a failed download while polling does not reopen its toast', async ({
      comfyPage
    }) => {
      const { page } = comfyPage
      const taskId = '1396cc07-bab2-4f12-9b54-741f83f9224b'
      let releaseResponse!: () => void
      const responseReady = new Promise<void>((resolve) => {
        releaseResponse = resolve
      })
      const response: TaskResponse = {
        id: taskId,
        idempotency_key: taskId,
        task_name: 'task:download_file',
        payload: {},
        status: 'failed',
        error_message: 'Download failed',
        create_time: new Date().toISOString(),
        update_time: new Date().toISOString()
      }
      await page.route(`**/tasks/${taskId}`, async (route) => {
        await responseReady
        await route.fulfill({ json: response })
      })
      await page.clock.install()
      await dispatchAssetDownload(page, {
        task_id: taskId,
        asset_name: ASSET_NAME,
        bytes_total: 1000,
        bytes_downloaded: 200,
        progress: 20,
        status: 'failed',
        error: 'Source server error'
      })
      const request = page.waitForRequest(`**/tasks/${taskId}`)
      await page.clock.runFor(10_000)
      await request

      const toast = page
        .getByRole('status')
        .filter({ hasText: '1 download failed' })
      await toast.getByRole('button', { name: 'Close' }).click()
      await expect(toast).toBeHidden()
      const completedResponse = page.waitForResponse(`**/tasks/${taskId}`)
      releaseResponse()
      await (await completedResponse).finished()
      await page.clock.runFor(100)

      await expect(toast).toBeHidden()
    })
  }
)
