import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  GRID_IMAGE_NAMES,
  GRID_LOGGED_FIELDS,
  panSweep,
  uploadGridImages,
  waitForGridImagesDecoded,
  zoomSweep
} from '@e2e/fixtures/utils/largeImageGrid'
import {
  logMeasurement,
  recordMeasurement
} from '@e2e/fixtures/utils/perfReporter'

test.use({ trace: 'off' })

for (const { size, displaySize } of [
  { size: 4096, displaySize: 1024 },
  { size: 256, displaySize: 256 }
]) {
  test.describe(
    `Image previews ${size}px`,
    { tag: ['@vue-nodes', '@perf'] },
    () => {
      test.beforeEach(async ({ comfyPage, comfyFiles }) => {
        for (const filename of GRID_IMAGE_NAMES)
          comfyFiles.deleteAfterTest({ filename, type: 'input' })
        await uploadGridImages(comfyPage, size)
      })

      test('load, pan and zoom a 4x3 grid', async ({ comfyPage }) => {
        const label = (phase: string) => `image-preview-${size}-${phase}`

        await test.step('Load the image grid', async () => {
          await comfyPage.perf.startMeasuring()
          await comfyPage.workflow.loadWorkflow('vueNodes/load-image-grid-4x3')
          await waitForGridImagesDecoded(comfyPage, displaySize)
          const load = await comfyPage.perf.stopMeasuring(label('load'))
          recordMeasurement(load)
          logMeasurement(label('load'), load, [...GRID_LOGGED_FIELDS])
        })

        await test.step('Pan across the image grid', async () => {
          await comfyPage.perf.startMeasuring()
          await panSweep(comfyPage)
          const pan = await comfyPage.perf.stopMeasuring(label('pan'))
          recordMeasurement(pan)
          logMeasurement(label('pan'), pan, [...GRID_LOGGED_FIELDS])
        })

        await test.step('Zoom the image grid', async () => {
          await comfyPage.perf.startMeasuring()
          await zoomSweep(comfyPage)
          const zoom = await comfyPage.perf.stopMeasuring(label('zoom'))
          recordMeasurement(zoom)
          logMeasurement(label('zoom'), zoom, [...GRID_LOGGED_FIELDS])
        })
      })
    }
  )
}
