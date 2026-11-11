import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  panSweep,
  uploadGridImages,
  waitForGridImagesDecoded,
  zoomSweep
} from '@e2e/fixtures/utils/largeImageGrid'
import {
  logMeasurement,
  recordMeasurement
} from '@e2e/fixtures/utils/perfReporter'

const LOGGED_FIELDS = [
  'durationMs',
  'frameDurationMs',
  'p95FrameDurationMs',
  'totalBlockingTimeMs',
  'taskDurationMs',
  'heapUsedBytes'
] as const

for (const size of [4096, 256]) {
  test.describe(
    `Image previews ${size}px`,
    { tag: ['@vue-nodes', '@perf'] },
    () => {
      test.setTimeout(120_000)

      test.beforeEach(async ({ comfyPage, comfyFiles }) => {
        const names = await uploadGridImages(comfyPage, size)
        for (const filename of names)
          comfyFiles.deleteAfterTest({ filename, type: 'input' })
      })

      test('load, pan and zoom a 4x3 grid', async ({ comfyPage }) => {
        const label = (phase: string) => `image-preview-${size}-${phase}`

        await comfyPage.perf.startMeasuring()
        await comfyPage.workflow.loadWorkflow('vueNodes/load-image-grid-4x3')
        await waitForGridImagesDecoded(comfyPage)
        const load = await comfyPage.perf.stopMeasuring(label('load'))
        recordMeasurement(load)
        logMeasurement(label('load'), load, [...LOGGED_FIELDS])

        await comfyPage.perf.startMeasuring()
        await panSweep(comfyPage)
        const pan = await comfyPage.perf.stopMeasuring(label('pan'))
        recordMeasurement(pan)
        logMeasurement(label('pan'), pan, [...LOGGED_FIELDS])

        await comfyPage.perf.startMeasuring()
        await zoomSweep(comfyPage)
        const zoom = await comfyPage.perf.stopMeasuring(label('zoom'))
        recordMeasurement(zoom)
        logMeasurement(label('zoom'), zoom, [...LOGGED_FIELDS])
      })
    }
  )
}
