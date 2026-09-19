import type { Page } from '@playwright/test'

import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

/**
 * KNOWN BUG PM-1302 / PM-1309 (frontend half):
 *
 * `assetDownloadStore.handleAssetDownload` (src/stores/assetDownloadStore.ts)
 * locks a download into a terminal `completed`/`failed` status on the first
 * terminal WS message it sees for a `task_id`, and silently drops any later
 * message for that same task. On the cloud side, `HandleDownloadFile`
 * (download_file.go) broadcasts a terminal `failed` message for ANY
 * retryable error before asynq decides whether a retry will happen, then
 * quietly retries. When the retry succeeds, cloud broadcasts a later
 * `completed` message that the frontend never applies - so the
 * ModelImportProgressDialog toast keeps telling the user the download
 * failed even though it actually finished successfully.
 *
 * This test drives that exact WS sequence through the real `asset_download`
 * client event (the same event `assetDownloadStore` listens on in
 * production) and proves the toast is stuck showing "failed" forever.
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
    test('keeps showing a failed download as failed even after the backend silently retries and completes it (PM-1302)', async ({
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

      // BUG: the later `completed` message is silently dropped by
      // handleAssetDownload's terminal-state short circuit, so the toast
      // keeps reporting the download as failed forever instead of updating
      // to reflect the real, successful outcome.
      await expect(failedFooterText).toBeVisible()
      await expect(
        page.getByText('All downloads completed', { exact: true })
      ).toBeHidden()

      // Visual proof of the stuck "failed" toast state.
      await expect(page.locator('body')).toHaveScreenshot(
        'model-import-progress-toast-stuck-failed.png',
        { mask: [page.locator('.timestamp')] }
      )
    })
  }
)
