import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import type { Renderer } from '@e2e/fixtures/helpers/PanZoomPerfHelper'
import {
  loadCenteredGraph,
  measureIdle,
  measurePan,
  measureProgress,
  measureZoom,
  queueProgressFill,
  reportPerf,
  SLOW_PROGRESS_CADENCE
} from '@e2e/fixtures/helpers/PanZoomPerfHelper'

const NODE_COUNTS = [60, 245] as const
const TEST_TIMEOUT_MS = 300_000
const QUEUE_PANEL_SETTING = 'Comfy.Queue.QPOV2'
const QUEUE_LAYOUTS = [
  { name: 'floating-queue', docked: false },
  { name: 'docked-queue', docked: true }
] as const

function definePanZoomTests(renderer: Renderer) {
  for (const nodeCount of NODE_COUNTS) {
    test(`${renderer} ${nodeCount} nodes`, async ({ comfyPage }) => {
      await loadCenteredGraph(comfyPage, renderer, nodeCount)
      await comfyPage.expectNodeCount(nodeCount)

      const prefix = `${renderer}-${nodeCount}`
      reportPerf(
        `${prefix} idle`,
        await measureIdle(comfyPage, `${prefix}-idle`)
      )
      reportPerf(`${prefix} pan`, await measurePan(comfyPage, `${prefix}-pan`))
      reportPerf(
        `${prefix} zoom`,
        await measureZoom(comfyPage, `${prefix}-zoom`)
      )
      reportPerf(
        `${prefix} progress`,
        await measureProgress(comfyPage, `${prefix}-progress`, renderer)
      )
      reportPerf(
        `${prefix} progress slow`,
        await measureProgress(comfyPage, `${prefix}-progress-slow`, renderer, {
          cadence: SLOW_PROGRESS_CADENCE
        })
      )
    })
  }

  for (const { name, docked } of QUEUE_LAYOUTS) {
    test.describe(name, () => {
      test.use({ initialSettings: { [QUEUE_PANEL_SETTING]: docked } })

      for (const nodeCount of NODE_COUNTS) {
        test(`${renderer} ${nodeCount} nodes current node progress`, async ({
          comfyPage
        }) => {
          await loadCenteredGraph(comfyPage, renderer, nodeCount)
          await comfyPage.expectNodeCount(nodeCount)

          const prefix = `${renderer}-${nodeCount}`
          reportPerf(
            `${prefix} progress ${name}`,
            await measureProgress(
              comfyPage,
              `${prefix}-progress-${name}`,
              renderer,
              { queueFill: queueProgressFill(comfyPage, docked) }
            )
          )
        })
      }
    })
  }
}

test.use({ trace: 'off', video: 'off' })

test.describe('Vue nodes pan/zoom', { tag: ['@perf', '@vue-nodes'] }, () => {
  test.setTimeout(TEST_TIMEOUT_MS)
  definePanZoomTests('vue')
})

test.describe('LiteGraph pan/zoom', { tag: ['@perf'] }, () => {
  test.setTimeout(TEST_TIMEOUT_MS)
  definePanZoomTests('litegraph')
})
