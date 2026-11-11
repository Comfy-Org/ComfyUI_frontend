import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { createLargePng } from '@e2e/fixtures/utils/largePng'
import {
  logMeasurement,
  recordMeasurement
} from '@e2e/fixtures/utils/perfReporter'
import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'

const COLUMNS = 4
const ROWS = 3
const NODE_COUNT = COLUMNS * ROWS
const NODE_SIZE: [number, number] = [315, 314]
const SPACING = 340

function imageNames(size: number): string[] {
  return Array.from({ length: NODE_COUNT }, (_, i) => `perf_${size}_${i}.png`)
}

async function uploadImages(comfyPage: ComfyPage, size: number) {
  for (const [i, name] of imageNames(size).entries()) {
    const response = await comfyPage.page.request.post(
      `${comfyPage.url}/api/upload/image`,
      {
        multipart: {
          image: {
            name,
            mimeType: 'image/png',
            buffer: createLargePng(size, size, i + 1)
          },
          overwrite: 'true',
          type: 'input'
        }
      }
    )
    test.expect(response.ok()).toBe(true)
  }
}

function gridWorkflow(size: number): ComfyWorkflowJSON {
  return {
    last_node_id: NODE_COUNT,
    last_link_id: 0,
    nodes: imageNames(size).map((name, i) => ({
      id: i + 1,
      type: 'LoadImage',
      pos: [(i % COLUMNS) * SPACING, Math.floor(i / COLUMNS) * SPACING],
      size: NODE_SIZE,
      flags: {},
      order: i,
      mode: 0,
      inputs: [],
      outputs: [
        { name: 'IMAGE', type: 'IMAGE', links: null },
        { name: 'MASK', type: 'MASK', links: null }
      ],
      properties: { 'Node name for S&R': 'LoadImage' },
      widgets_values: [name, 'image']
    })),
    links: [],
    groups: [],
    config: {},
    extra: { ds: { offset: [40, 40], scale: 0.5 } },
    version: 0.4
  }
}

async function waitForAllImagesDecoded(comfyPage: ComfyPage) {
  await test
    .expect(comfyPage.page.getByTestId('main-image'))
    .toHaveCount(NODE_COUNT, { timeout: 30_000 })
  await comfyPage.page.waitForFunction(
    async (count) => {
      const imgs = [
        ...document.querySelectorAll<HTMLImageElement>(
          '[data-testid="main-image"]'
        )
      ]
      if (imgs.length !== count) return false
      if (!imgs.every((img) => img.complete && img.naturalWidth > 0))
        return false
      await Promise.all(imgs.map((img) => img.decode()))
      return true
    },
    NODE_COUNT,
    { timeout: 30_000, polling: 100 }
  )
}

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

      test.beforeEach(async ({ comfyPage }) => {
        await uploadImages(comfyPage, size)
      })

      test('load, pan and zoom a 4x3 grid', async ({ comfyPage }) => {
        const { page } = comfyPage
        const label = (phase: string) => `image-preview-${size}-${phase}`

        await comfyPage.perf.startMeasuring()
        await comfyPage.workflow.loadGraphData(gridWorkflow(size))
        await waitForAllImagesDecoded(comfyPage)
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
