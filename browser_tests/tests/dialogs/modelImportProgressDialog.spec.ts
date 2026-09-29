import type { TaskResponse } from '@/platform/tasks/services/taskService'

import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { dispatchAssetDownload } from '@e2e/fixtures/utils/assetDownload'

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
 */
test.describe('Model import progress toast', { tag: ['@screenshot'] }, () => {
  test('recovers from a premature failed status once the backend silently retries and completes it (PM-1302)', async ({
    comfyPage
  }) => {
    const { page } = comfyPage
    const taskId = 'pm-1302-repro-task'
    const assetName = 'stuck-model.safetensors'

    await test.step('show a running model import', async () => {
      await dispatchAssetDownload(page, {
        task_id: taskId,
        asset_name: assetName,
        bytes_total: 1000,
        bytes_downloaded: 200,
        progress: 20,
        status: 'running'
      })

      await expect(
        page.getByText('Importing Models', { exact: true })
      ).toBeVisible()
    })

    const failedFooterText = page.getByText('1 download failed', {
      exact: true
    })

    await test.step('show the retryable failure reported by the backend', async () => {
      await dispatchAssetDownload(page, {
        task_id: taskId,
        asset_name: assetName,
        bytes_total: 1000,
        bytes_downloaded: 200,
        progress: 20,
        status: 'failed',
        error: 'Source server error'
      })

      await expect(failedFooterText).toBeVisible()
    })

    await test.step('recover after the backend retry succeeds', async () => {
      await dispatchAssetDownload(page, {
        task_id: taskId,
        asset_name: assetName,
        asset_id: 'asset-pm-1302',
        bytes_total: 1000,
        bytes_downloaded: 1000,
        progress: 100,
        status: 'completed'
      })
      await comfyPage.nextFrame()

      await expect(failedFooterText).toBeHidden()
      await expect(
        page.getByText('All downloads completed', { exact: true })
      ).toBeVisible()
    })

    // Scoped to the toast: a full-`body` screenshot also captures the
    // canvas graph background, which isn't pixel-stable across CI runs.
    const toast = page
      .getByRole('status')
      .filter({ hasText: 'All downloads completed' })

    await expect(toast).toHaveScreenshot(
      'model-import-progress-toast-recovered-completed.png',
      { mask: [toast.locator('.timestamp')] }
    )
  })

  test('a failed download toast can still be manually dismissed when no later recovery message arrives (PM-1302)', async ({
    comfyPage
  }) => {
    const { page } = comfyPage
    const taskId = 'pm-1302-dismiss-task'
    const assetName = 'stuck-model.safetensors'

    await test.step('show a failed model import', async () => {
      await dispatchAssetDownload(page, {
        task_id: taskId,
        asset_name: assetName,
        bytes_total: 1000,
        bytes_downloaded: 200,
        progress: 20,
        status: 'running'
      })
      await dispatchAssetDownload(page, {
        task_id: taskId,
        asset_name: assetName,
        bytes_total: 1000,
        bytes_downloaded: 200,
        progress: 20,
        status: 'failed',
        error: 'Source server error'
      })
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

    // Scoped to `toast`: `page.getByRole('button', { name: 'Close' })`
    // alone also matches the canvas minimap's close button
    // (`data-testid="close-minimap-button"`) and is a strict-mode
    // violation with the minimap visible.
    await test.step('dismiss the failed model import', async () => {
      await toast.getByRole('button', { name: 'Close' }).click()
      await expect(toast).toBeHidden()
    })
  })

  test('cancels a running download and renders the backend terminal state (PM-1309)', async ({
    comfyPage
  }) => {
    const { page } = comfyPage
    const taskId = '1396cc07-bab2-4f12-9b54-741f83f9224c'
    const assetName = 'cancelled-model.safetensors'
    const cancellationResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/tasks/${taskId}`) &&
        response.request().method() === 'DELETE'
    )
    await page.route(`**/tasks/${taskId}`, async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({ status: 204 })
        return
      }

      await route.fulfill({
        json: {
          id: taskId,
          idempotency_key: taskId,
          task_name: 'task:download_file',
          payload: {},
          status: 'running',
          create_time: new Date().toISOString(),
          update_time: new Date().toISOString()
        } satisfies TaskResponse
      })
    })

    await test.step('show the running download', async () => {
      await dispatchAssetDownload(page, {
        task_id: taskId,
        asset_name: assetName,
        bytes_total: 1000,
        bytes_downloaded: 200,
        progress: 20,
        status: 'running'
      })
    })

    const toast = page.getByRole('status').filter({ hasText: assetName })
    await expect(toast).toBeVisible()

    await test.step('cancel through user-visible controls', async () => {
      await toast.getByRole('button', { name: 'Expand' }).click()
      await expect(
        toast.getByRole('button', { name: 'Collapse' })
      ).toBeVisible()
      const cancelButton = toast.getByRole('button', {
        name: 'Cancel Download'
      })
      await expect(cancelButton).toBeVisible()
      await cancelButton.click()

      const response = await cancellationResponse
      expect(response.status()).toBe(204)
      await expect(
        toast.getByText('Cancelled', { exact: true }).first()
      ).toBeVisible()
      await expect(toast.getByRole('button', { name: 'Close' })).toBeHidden()
    })

    await test.step('keep the terminal backend state rendered', async () => {
      await dispatchAssetDownload(page, {
        task_id: taskId,
        asset_name: assetName,
        bytes_total: 1000,
        bytes_downloaded: 200,
        progress: 20,
        status: 'cancelled'
      })

      await expect(
        toast.getByText('Cancelled', { exact: true }).first()
      ).toBeVisible()
      await expect(
        toast.getByRole('button', { name: 'Cancel Download' })
      ).toBeHidden()
      await expect(toast.getByRole('button', { name: 'Close' })).toBeVisible()
    })
  })

  test('closing a failed download while polling does not reopen its toast', async ({
    comfyPage
  }) => {
    const { page } = comfyPage
    const taskId = '1396cc07-bab2-4f12-9b54-741f83f9224b'
    const assetName = 'failed-model.safetensors'
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

    await test.step('start reconciling a failed model import', async () => {
      await page.clock.install()
      await dispatchAssetDownload(page, {
        task_id: taskId,
        asset_name: assetName,
        bytes_total: 1000,
        bytes_downloaded: 200,
        progress: 20,
        status: 'failed',
        error: 'Source server error'
      })
      const request = page.waitForRequest(`**/tasks/${taskId}`)
      await page.clock.runFor(10_000)
      await request
    })

    const toast = page
      .getByRole('status')
      .filter({ hasText: '1 download failed' })

    await test.step('dismiss the model import during reconciliation', async () => {
      await toast.getByRole('button', { name: 'Close' }).click()
      await expect(toast).toBeHidden()
    })

    await test.step('keep the model import dismissed after polling settles', async () => {
      const completedResponse = page.waitForResponse(`**/tasks/${taskId}`)
      releaseResponse()
      await (await completedResponse).finished()
      await page.clock.runFor(100)

      await expect(toast).toBeHidden()
    })
  })
})
