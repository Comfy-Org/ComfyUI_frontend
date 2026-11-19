import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  centerOnGraph,
  measureIdle,
  measurePan,
  measureProgress,
  measureZoom,
  reportPerf,
  SLOW_PROGRESS_CADENCE,
  trimGraphTo,
  waitForMeasuredVueNodes
} from '@e2e/fixtures/helpers/PanZoomPerfHelper'

const NODE_COUNTS = [60, 245] as const
const TEST_TIMEOUT_MS = 300_000
const QUEUE_PANEL_SETTING = 'Comfy.Queue.QPOV2'
const QUEUE_LAYOUTS = [
  { name: 'floating-queue', docked: false },
  { name: 'docked-queue', docked: true }
] as const

type Renderer = 'vue' | 'litegraph'

async function loadCenteredGraph(
  comfyPage: ComfyPage,
  renderer: Renderer,
  nodeCount: number
) {
  await comfyPage.workflow.loadWorkflowData('large-graph-workflow')
  if (nodeCount < 245) await trimGraphTo(comfyPage, nodeCount)
  await centerOnGraph(comfyPage)
  if (renderer === 'vue') {
    await waitForMeasuredVueNodes(comfyPage, nodeCount)
  }
}

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
        await measureProgress(comfyPage, `${prefix}-progress`)
      )
      reportPerf(
        `${prefix} progress slow`,
        await measureProgress(
          comfyPage,
          `${prefix}-progress-slow`,
          SLOW_PROGRESS_CADENCE
        )
      )
    })
  }

  for (const { name, docked } of QUEUE_LAYOUTS) {
    test.describe(name, () => {
      test.use({ initialSettings: { [QUEUE_PANEL_SETTING]: docked } })

      for (const nodeCount of NODE_COUNTS) {
        test(`${renderer} ${nodeCount} nodes progress`, async ({
          comfyPage
        }) => {
          await loadCenteredGraph(comfyPage, renderer, nodeCount)
          await comfyPage.expectNodeCount(nodeCount)

          const prefix = `${renderer}-${nodeCount}`
          reportPerf(
            `${prefix} progress ${name}`,
            await measureProgress(comfyPage, `${prefix}-progress-${name}`)
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
