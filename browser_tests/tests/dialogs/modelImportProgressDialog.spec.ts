import { mergeTests } from '@playwright/test'

import type { TaskResponse } from '@/platform/tasks/services/taskService'
import {
  comfyPageFixture,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import { modelImportProgressFixture } from '@e2e/fixtures/modelImportProgressFixture'

const test = mergeTests(comfyPageFixture, modelImportProgressFixture)

test.describe('Model import progress toast', { tag: ['@screenshot'] }, () => {
  test('filters failed imports through the popover above the expanded toast', async ({
    modelImportProgress
  }) => {
    await modelImportProgress.expand()
    await expect(
      modelImportProgress.job('completed-model.safetensors')
    ).toBeVisible()
    await expect(
      modelImportProgress.job('failed-model.safetensors')
    ).toBeVisible()

    await modelImportProgress.filterBy('Failed')

    await expect(
      modelImportProgress.job('completed-model.safetensors')
    ).toBeHidden()
    await expect(
      modelImportProgress.job('failed-model.safetensors')
    ).toBeVisible()
  })

  test('recovers from a premature failed status once the backend silently retries and completes it (PM-1302)', async ({
    comfyPage
  }) => {
    const { page } = comfyPage
    const taskId = 'pm-1302-repro-task'
    const assetName = 'stuck-model.safetensors'

    await test.step('show a running model import', async () => {
      await comfyPage.assets.dispatchDownload({
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
      await comfyPage.assets.dispatchDownload({
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
      await comfyPage.assets.dispatchDownload({
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
      await comfyPage.assets.dispatchDownload({
        task_id: taskId,
        asset_name: assetName,
        bytes_total: 1000,
        bytes_downloaded: 200,
        progress: 20,
        status: 'running'
      })
      await comfyPage.assets.dispatchDownload({
        task_id: taskId,
        asset_name: assetName,
        bytes_total: 1000,
        bytes_downloaded: 200,
        progress: 20,
        status: 'failed',
        error: 'Source server error'
      })
    })

    const toast = page
      .getByRole('status')
      .filter({ hasText: '1 download failed' })
    await expect(toast).toBeVisible()
    await expect(
      page.getByText('1 download failed', { exact: true })
    ).toBeVisible()

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
      await comfyPage.assets.dispatchDownload({
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
        name: 'Cancel',
        exact: true
      })
      await expect(cancelButton).toBeVisible()
      await cancelButton.focus()
      await page.keyboard.press('Enter')

      const response = await cancellationResponse
      expect(response.status()).toBe(204)
      await expect(
        toast.getByText('Cancelled', { exact: true }).first()
      ).toBeVisible()
      await expect(toast.getByRole('button', { name: 'Close' })).toBeVisible()
      await expect(
        toast.getByRole('button', { name: 'Collapse' })
      ).toBeFocused()
    })

    await test.step('keep the terminal backend state rendered', async () => {
      await comfyPage.assets.dispatchDownload({
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
        toast.getByRole('button', { name: 'Cancel', exact: true })
      ).toBeHidden()
      await expect(toast.getByRole('button', { name: 'Close' })).toBeVisible()
    })
  })

  test('a cancelled download whose task row is purged can still be dismissed', async ({
    comfyPage
  }) => {
    // The store waits a real 10s before its first reconciliation, and this
    // case has to observe that reconciliation rather than fake the clock: the
    // toast does not render at all under an installed clock.
    test.setTimeout(60_000)

    const { page } = comfyPage
    const taskId = '1396cc07-bab2-4f12-9b54-741f83f9224d'
    const assetName = 'purged-model.safetensors'
    // The backend accepts the cancellation, then purges the task row, so no
    // terminal WS message and no successful poll will ever arrive.
    await page.route(`**/tasks/${taskId}`, async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({ status: 204 })
        return
      }
      await route.fulfill({ status: 404, json: { detail: 'Task not found' } })
    })

    const toast = page.getByRole('status').filter({ hasText: assetName })

    await test.step('cancel a running download', async () => {
      await comfyPage.assets.dispatchDownload({
        task_id: taskId,
        asset_name: assetName,
        bytes_total: 1000,
        bytes_downloaded: 200,
        progress: 20,
        status: 'running'
      })

      await expect(toast).toBeVisible()
      await toast.getByRole('button', { name: 'Expand' }).click()
      await toast.getByRole('button', { name: 'Cancel', exact: true }).click()

      await expect(
        toast.getByText('Cancelled', { exact: true }).first()
      ).toBeVisible()
      await expect(toast.getByRole('button', { name: 'Close' })).toBeVisible()
    })

    await test.step('settle the cancellation once the task lookup 404s', async () => {
      await page.waitForResponse(
        (response) =>
          response.url().endsWith(`/tasks/${taskId}`) &&
          response.request().method() === 'GET',
        { timeout: 30_000 }
      )

      await expect(toast.getByRole('button', { name: 'Close' })).toBeVisible()
    })

    await test.step('dismiss the settled cancellation', async () => {
      await toast.getByRole('button', { name: 'Close' }).click()
      await expect(toast).toBeHidden()
    })
  })

  test('a dismissed unconfirmed cancellation stays hidden from late progress', async ({
    comfyPage
  }) => {
    test.setTimeout(30_000)
    const { page } = comfyPage
    const taskId = '1396cc07-bab2-4f12-9b54-741f83f9224e'
    const assetName = 'unconfirmed-cancel-model.safetensors'
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

    await comfyPage.assets.dispatchDownload({
      task_id: taskId,
      asset_name: assetName,
      bytes_total: 1000,
      bytes_downloaded: 200,
      progress: 20,
      status: 'running'
    })

    const toast = page.getByRole('status').filter({ hasText: assetName })
    await expect(toast).toBeVisible()
    await toast.getByRole('button', { name: 'Expand' }).click()
    const cancellation = page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith(`/tasks/${taskId}`) &&
        candidate.request().method() === 'DELETE'
    )
    await toast.getByRole('button', { name: 'Cancel', exact: true }).click()
    await cancellation
    await expect(
      toast.getByText('Cancelled', { exact: true }).first()
    ).toBeVisible()

    const advanceReconciliation = async () => {
      const response = page.waitForResponse(
        (candidate) =>
          candidate.url().endsWith(`/tasks/${taskId}`) &&
          candidate.request().method() === 'GET'
      )
      await (await response).finished()
    }
    await advanceReconciliation()
    await expect(
      toast.getByText('Cancelled', { exact: true }).first()
    ).toBeVisible()
    await toast.getByRole('button', { name: 'Close' }).click()
    await expect(toast).toBeHidden()

    await comfyPage.assets.dispatchDownload({
      task_id: taskId,
      asset_name: assetName,
      bytes_total: 1000,
      bytes_downloaded: 750,
      progress: 75,
      status: 'running'
    })
    await expect(toast).toBeHidden()
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
      await comfyPage.assets.dispatchDownload({
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
