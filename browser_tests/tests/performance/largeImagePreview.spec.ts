import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  uploadGridImages,
  waitForGridImagesDecoded
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
        const { page } = comfyPage
        const label = (phase: string) => `image-preview-${size}-${phase}`

        await comfyPage.perf.startMeasuring()
        await comfyPage.workflow.loadWorkflow('vueNodes/load-image-grid-4x3')
        await waitForGridImagesDecoded(comfyPage)
        const load = await comfyPage.perf.stopMeasuring(label('load'))
        recordMeasurement(load)
        logMeasurement(label('load'), load, [...LOGGED_FIELDS])

        const box = await comfyPage.canvas.boundingBox()
        test.expect(box).not.toBeNull()
        const cx = box!.x + box!.width / 2
        const cy = box!.y + box!.height / 2

        await comfyPage.perf.startMeasuring()
        await page.mouse.move(cx, cy)
        await page.mouse.down({ button: 'middle' })
        for (let i = 0; i < 60; i++) {
          await page.mouse.move(cx + Math.sin(i / 6) * 300, cy + (i % 20) * 8)
          await comfyPage.nextFrame()
        }
        await page.mouse.up({ button: 'middle' })
        const pan = await comfyPage.perf.stopMeasuring(label('pan'))
        recordMeasurement(pan)
        logMeasurement(label('pan'), pan, [...LOGGED_FIELDS])

        await comfyPage.perf.startMeasuring()
        await page.mouse.move(cx, cy)
        for (let i = 0; i < 30; i++) {
          await page.mouse.wheel(0, i < 15 ? -120 : 120)
          await comfyPage.nextFrame()
        }
        const zoom = await comfyPage.perf.stopMeasuring(label('zoom'))
        recordMeasurement(zoom)
        logMeasurement(label('zoom'), zoom, [...LOGGED_FIELDS])
      })
    }
  )
}
