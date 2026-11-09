import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  centerOnGraph,
  measureIdle,
  measurePan,
  measureProgress,
  measureZoom,
  reportPerf,
  trimGraphTo,
  waitForMeasuredVueNodes
} from '@e2e/fixtures/helpers/PanZoomPerfHelper'

const NODE_COUNTS = [60, 245] as const
const TEST_TIMEOUT_MS = 300_000

function definePanZoomTests(renderer: 'vue' | 'litegraph') {
  for (const nodeCount of NODE_COUNTS) {
    test(`${renderer} ${nodeCount} nodes`, async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflowData('large-graph-workflow')
      if (nodeCount < 245) await trimGraphTo(comfyPage, nodeCount)
      await centerOnGraph(comfyPage)
      await comfyPage.expectNodeCount(nodeCount)
      if (renderer === 'vue') {
        await waitForMeasuredVueNodes(comfyPage, nodeCount)
      }

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
