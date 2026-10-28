import { expect } from '@playwright/test'

import {
  lateDownload,
  lateExport,
  runningDownload,
  runningExport
} from '@e2e/fixtures/data/staleTasks'
import { test } from '@e2e/fixtures/staleTasksFixture'

test.describe('Stale background task polling', { tag: ['@ui'] }, () => {
  test.describe('Downloads', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.page.evaluate((data) => {
        window.app!.api.dispatchCustomEvent('asset_download', data)
      }, runningDownload)
    })

    test('recovers a missing download after a late completion event', async ({
      comfyPage,
      staleTasks: { downloadToast, taskRequests }
    }) => {
      await test.step('Show the running download', async () => {
        await expect(downloadToast).toBeVisible()
        await downloadToast.getByRole('button', { name: 'Expand' }).click()
        await expect(
          downloadToast.getByText('missing-model.safetensors').first()
        ).toBeVisible()
        await expect(downloadToast.getByText('37%')).toBeVisible()
      })

      await test.step('Fail the missing task', async () => {
        await comfyPage.page.clock.fastForward(10_000)
        await expect.poll(() => taskRequests.length).toBe(1)
        await comfyPage.page.clock.fastForward(10_000)
        await expect.poll(() => taskRequests.length).toBe(2)
        expect(taskRequests.map((url) => new URL(url).pathname)).toEqual([
          `/api/tasks/${runningDownload.task_id}`,
          `/api/tasks/${runningDownload.task_id}`
        ])
        await expect(
          downloadToast.getByText('Failed', { exact: true })
        ).toBeVisible()
      })

      await test.step('Accept late completion and stop polling', async () => {
        await comfyPage.page.evaluate((data) => {
          window.app!.api.dispatchCustomEvent('asset_download', data)
        }, lateDownload)
        await comfyPage.page.clock.fastForward(20_000)

        await expect(
          downloadToast.getByText('All downloads completed', { exact: true })
        ).toBeVisible()
        await expect(
          downloadToast.getByText('late-model.safetensors', { exact: true })
        ).toBeVisible()
        await expect(
          downloadToast.getByText('missing-model.safetensors')
        ).toHaveCount(0)
        expect(taskRequests).toHaveLength(2)
      })
    })
  })

  test.describe('Exports', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.page.evaluate((data) => {
        window.app!.api.dispatchCustomEvent('asset_export', data)
      }, runningExport)
    })

    test('recovers a missing export after a late completion event', async ({
      comfyPage,
      staleTasks: { exportToast, taskRequests, downloadRequests }
    }) => {
      await test.step('Show the populated running export', async () => {
        await expect(exportToast).toBeVisible()
        await exportToast.getByRole('button', { name: 'Expand' }).click()
        await expect(
          exportToast.getByText('partial-export.zip').first()
        ).toBeVisible()
        await expect(
          exportToast.getByText('2/7', { exact: true })
        ).toBeVisible()
        await expect(exportToast.getByText('37%')).toBeVisible()
      })

      await test.step('Preserve counters when the task is missing', async () => {
        await comfyPage.page.clock.fastForward(10_000)
        await expect.poll(() => taskRequests.length).toBe(1)
        await comfyPage.page.clock.fastForward(10_000)
        await expect.poll(() => taskRequests.length).toBe(2)
        expect(taskRequests.map((url) => new URL(url).pathname)).toEqual([
          `/api/tasks/${runningExport.task_id}`,
          `/api/tasks/${runningExport.task_id}`
        ])
        await expect(
          exportToast.getByText('1 export failed', { exact: true })
        ).toBeVisible()
        await expect(
          exportToast.getByText('2/7', { exact: true })
        ).toBeVisible()
        expect(downloadRequests).toHaveLength(0)
      })

      await test.step('Download the completed export without resuming polling', async () => {
        const downloadPromise = comfyPage.page.waitForEvent('download')
        await comfyPage.page.evaluate((data) => {
          window.app!.api.dispatchCustomEvent('asset_export', data)
        }, lateExport)
        const download = await downloadPromise
        expect(download.suggestedFilename()).toBe('late.zip')
        await comfyPage.page.clock.fastForward(20_000)

        await expect(
          exportToast.getByText('All exports completed', { exact: true })
        ).toBeVisible()
        await expect(
          exportToast.getByText('7/7', { exact: true })
        ).toBeVisible()
        await expect(exportToast.getByText('late.zip').first()).toBeVisible()
        expect(downloadRequests).toHaveLength(1)
        expect(taskRequests).toHaveLength(2)
      })
    })
  })
})
