import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const DOWNLOAD_TASK_ID = '11111111-1111-4111-8111-111111111111'
const EXPORT_TASK_ID = '22222222-2222-4222-8222-222222222222'
const LATE_EXPORT_NAME = 'late.zip'

test.describe('Stale background task polling', { tag: ['@ui'] }, () => {
  test('marks a missing download task as failed and stops polling it', async ({
    comfyPage
  }) => {
    const { page } = comfyPage
    const taskRequests: string[] = []

    await page.clock.install()
    await page.route('**/api/tasks/**', async (route) => {
      taskRequests.push(route.request().url())
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'not found' })
      })
    })

    await page.evaluate((taskId) => {
      const appEl = document.querySelector('#vue-app') as {
        __vue_app__?: {
          config: {
            globalProperties: {
              $pinia?: {
                _s?: Map<
                  string,
                  {
                    trackDownload: (
                      taskId: string,
                      modelType: string,
                      assetName: string
                    ) => void
                  }
                >
              }
            }
          }
        }
      } | null
      const store =
        appEl?.__vue_app__?.config.globalProperties.$pinia?._s?.get(
          'assetDownload'
        )
      if (!store) throw new Error('assetDownload store is not available')
      store.trackDownload(taskId, 'checkpoints', 'missing-model.safetensors')
    }, DOWNLOAD_TASK_ID)

    const toast = page
      .getByRole('status')
      .filter({ has: page.getByRole('heading', { name: 'Importing Models' }) })
    await expect(toast).toBeVisible()
    await toast.getByRole('button', { name: 'Expand' }).click()
    await expect(toast.getByText('missing-model.safetensors')).toBeVisible()
    await expect(toast.getByText('Pending')).toBeVisible()

    await page.clock.fastForward(15_000)

    await expect(toast.getByText('Failed', { exact: true })).toBeVisible()
    await expect.poll(() => taskRequests).toHaveLength(1)

    await page.clock.fastForward(20_000)
    await expect.poll(() => taskRequests).toHaveLength(1)
  })

  test('keeps a missing export failed after a late completion event', async ({
    comfyPage
  }) => {
    const { page } = comfyPage
    const taskRequests: string[] = []
    const downloadRequests: string[] = []

    await page.clock.install()
    await page.route('**/api/tasks/**', async (route) => {
      taskRequests.push(route.request().url())
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'not found' })
      })
    })
    await page.route('**/api/assets/exports/**', async (route) => {
      downloadRequests.push(route.request().url())
      await route.fulfill({
        status: 200,
        json: { url: 'https://example.test/late.zip' }
      })
    })

    await page.evaluate((taskId) => {
      const appEl = document.querySelector('#vue-app') as {
        __vue_app__?: {
          config: {
            globalProperties: {
              $pinia?: {
                _s?: Map<string, { trackExport: (taskId: string) => void }>
              }
            }
          }
        }
      } | null
      const store =
        appEl?.__vue_app__?.config.globalProperties.$pinia?._s?.get(
          'assetExport'
        )
      if (!store) throw new Error('assetExport store is not available')
      store.trackExport(taskId)
    }, EXPORT_TASK_ID)

    const toast = page
      .getByRole('status')
      .filter({ has: page.getByRole('heading', { name: 'Exporting Assets' }) })
    await expect(toast).toBeVisible()
    await toast.getByRole('button', { name: 'Expand' }).click()
    await expect(toast.getByText('Preparing export...').first()).toBeVisible()

    await page.clock.fastForward(15_000)

    await expect(
      toast.getByText('Export failed', { exact: true })
    ).toBeVisible()
    await expect.poll(() => taskRequests).toHaveLength(1)
    expect(downloadRequests).toHaveLength(0)

    await page.evaluate(
      ({ taskId, exportName }) => {
        window.app!.api.dispatchCustomEvent('asset_export', {
          task_id: taskId,
          export_name: exportName,
          assets_total: 1,
          assets_attempted: 1,
          assets_failed: 0,
          bytes_total: 100,
          bytes_processed: 100,
          progress: 1,
          status: 'completed'
        })
      },
      { taskId: EXPORT_TASK_ID, exportName: LATE_EXPORT_NAME }
    )

    await expect(
      toast.getByText('Export failed', { exact: true })
    ).toBeVisible()
    expect(downloadRequests).toHaveLength(0)

    await page.clock.fastForward(20_000)
    await expect.poll(() => taskRequests).toHaveLength(1)
  })
})
