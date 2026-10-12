import { mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import {
  createRouteMockJob,
  jobsRouteFixture,
  routeMockJobTimestamp
} from '@e2e/fixtures/jobsRouteFixture'
import { HdrViewerDialog } from '@e2e/fixtures/components/HdrViewerDialog'
import { TestIds } from '@e2e/fixtures/selectors'
import { mockViewFiles } from '@e2e/fixtures/utils/viewFileMocks'

const hdrJob = createRouteMockJob({
  id: 'hdr-job',
  create_time: routeMockJobTimestamp - 1_000,
  execution_start_time: routeMockJobTimestamp - 1_000,
  execution_end_time: routeMockJobTimestamp,
  preview_output: {
    filename: 'sky.exr',
    subfolder: 'renders',
    type: 'output',
    nodeId: '1',
    mediaType: 'images'
  }
})

const test = mergeTests(comfyPageFixture, jobsRouteFixture).extend<{
  mockHdrJob: void
}>({
  mockHdrJob: [
    async ({ jobsRoutes, page }, use) => {
      await jobsRoutes.mockJobsScenario({ history: [hdrJob], queue: [] })
      await jobsRoutes.mockJobsHistory([hdrJob])
      await mockViewFiles(page, {
        'sky.exr': {
          path: 'browser_tests/assets/test_upload_image.exr',
          contentType: 'image/x-exr'
        }
      })
      await page.route('**/api/view**', async (route) => {
        const url = new URL(route.request().url())
        const wrongLocation =
          url.searchParams.get('filename') === 'sky.exr' &&
          (url.searchParams.get('type') !== 'output' ||
            url.searchParams.get('subfolder') !== 'renders')
        await (wrongLocation
          ? route.fulfill({ status: 404 })
          : route.fallback())
      })
      await use()
    },
    { auto: true }
  ]
})

test.describe('HDR outputs open in the HDR viewer', { tag: '@ui' }, () => {
  test.describe('from job history', () => {
    test.use({ initialSettings: { 'Comfy.Queue.QPOV2': true } })

    test('opens the job output instead of the image lightbox', async ({
      comfyPage
    }) => {
      await comfyPage.page
        .getByTestId(TestIds.sidebar.toolbar)
        .getByRole('button', { name: 'Job History', exact: true })
        .click()
      const row = comfyPage.queuePanel.jobRow('hdr-job')
      await row.dblclick()
      await new HdrViewerDialog(comfyPage.page, 'sky.exr').expectLoaded()
    })
  })

  test.describe('from the assets sidebar', () => {
    test('opens a generated HDR card on double click', async ({
      comfyPage
    }) => {
      const tab = comfyPage.menu.assetsTab
      await tab.open()
      await tab.getAssetCardByName('sky').dblclick()
      await new HdrViewerDialog(comfyPage.page, 'sky.exr').expectLoaded()
    })

    test('opens a generated HDR card from Inspect asset', async ({
      comfyPage
    }) => {
      const tab = comfyPage.menu.assetsTab
      await tab.open()
      await tab.rightClickAsset('sky')
      await comfyPage.contextMenu.clickMenuItemExact('Inspect asset')
      await new HdrViewerDialog(comfyPage.page, 'sky.exr').expectLoaded()
    })
  })
})
