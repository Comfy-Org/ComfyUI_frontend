import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import type { Renderer } from '@e2e/fixtures/helpers/PanZoomPerfHelper'
import {
  centerOnGraph,
  measureIdle,
  measureLoad,
  measureNodeDrag,
  measurePan,
  measureProgress,
  measureSelectAll,
  measureZoom,
  reportPerf
} from '@e2e/fixtures/helpers/PanZoomPerfHelper'
import { createChainWorkflow } from '@e2e/fixtures/utils/chainWorkflow'

const NODE_COUNT = 500
const TEST_TIMEOUT_MS = 600_000

function defineLargeGraphTest(renderer: Renderer) {
  test(`${renderer} ${NODE_COUNT} nodes`, async ({ comfyPage }) => {
    const prefix = `${renderer}-${NODE_COUNT}`
    reportPerf(
      `${prefix} load`,
      await measureLoad(
        comfyPage,
        `${prefix}-load`,
        createChainWorkflow(NODE_COUNT),
        renderer
      )
    )
    await centerOnGraph(comfyPage)
    await comfyPage.expectNodeCount(NODE_COUNT)

    reportPerf(`${prefix} idle`, await measureIdle(comfyPage, `${prefix}-idle`))
    reportPerf(`${prefix} pan`, await measurePan(comfyPage, `${prefix}-pan`))
    reportPerf(`${prefix} zoom`, await measureZoom(comfyPage, `${prefix}-zoom`))
    reportPerf(
      `${prefix} progress`,
      await measureProgress(comfyPage, `${prefix}-progress`, renderer)
    )
    reportPerf(
      `${prefix} node drag`,
      await measureNodeDrag(comfyPage, `${prefix}-node-drag`)
    )
    reportPerf(
      `${prefix} select all`,
      await measureSelectAll(comfyPage, `${prefix}-select-all`)
    )
  })
}

test.use({ trace: 'off', video: 'off' })

test.describe('Vue nodes large graph', { tag: ['@perf', '@vue-nodes'] }, () => {
  test.setTimeout(TEST_TIMEOUT_MS)
  defineLargeGraphTest('vue')
})

test.describe('LiteGraph large graph', { tag: ['@perf'] }, () => {
  test.setTimeout(TEST_TIMEOUT_MS)
  defineLargeGraphTest('litegraph')
})
