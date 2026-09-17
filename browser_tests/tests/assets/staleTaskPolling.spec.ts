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

    test('keeps a missing download failed after a late completion event', async ({
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
        await comfyPage.page.clock.fastForward(15_000)
        await expect(
          downloadToast.getByText('Failed', { exact: true })
        ).toBeVisible()
        await expect.poll(() => taskRequests).toHaveLength(1)
      })

      await test.step('Ignore late completion and stop polling', async () => {
        await comfyPage.page.evaluate((data) => {
          window.app!.api.dispatchCustomEvent('asset_download', data)
        }, lateDownload)
        await comfyPage.page.clock.fastForward(20_000)

        await expect(
          downloadToast.getByText('Failed', { exact: true })
        ).toBeVisible()
        await expect(
          downloadToast.getByText('missing-model.safetensors', { exact: true })
        ).toBeVisible()
        await expect(
          downloadToast.getByText('late-model.safetensors')
        ).toHaveCount(0)
        expect(taskRequests).toHaveLength(1)
      })
    })
  })

  test.describe('Exports', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.page.evaluate((data) => {
        window.app!.api.dispatchCustomEvent('asset_export', data)
      }, runningExport)
    })

    test('preserves a missing export after a late completion event', async ({
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
        await comfyPage.page.clock.fastForward(15_000)
        await expect(
          exportToast.getByText('Export failed', { exact: true })
        ).toBeVisible()
        await expect(
          exportToast.getByText('2/7', { exact: true })
        ).toBeVisible()
        await expect.poll(() => taskRequests).toHaveLength(1)
        expect(downloadRequests).toHaveLength(0)
      })

      await test.step('Ignore late completion without downloading or polling', async () => {
        await comfyPage.page.evaluate((data) => {
          window.app!.api.dispatchCustomEvent('asset_export', data)
        }, lateExport)
        await comfyPage.page.clock.fastForward(20_000)

        await expect(
          exportToast.getByText('Export failed', { exact: true })
        ).toBeVisible()
        await expect(
          exportToast.getByText('2/7', { exact: true })
        ).toBeVisible()
        expect(downloadRequests).toHaveLength(0)
        expect(taskRequests).toHaveLength(1)
      })
    })
  })
})
