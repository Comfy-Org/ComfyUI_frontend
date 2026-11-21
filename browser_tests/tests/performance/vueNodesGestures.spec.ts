import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  measureNodeNudges,
  measureNodeSelect,
  measurePanFlicks,
  measureZoomFlicks,
  measureZoomSteps
} from '@e2e/fixtures/helpers/GesturePerfHelper'
import {
  centerOnGraph,
  measureLoad,
  reportPerf
} from '@e2e/fixtures/helpers/PanZoomPerfHelper'
import { createChainWorkflow } from '@e2e/fixtures/utils/chainWorkflow'

const NODE_COUNT = 1000
const TEST_TIMEOUT_MS = 600_000
const MID_SCALE = 0.5
const FAR_SCALE = 0.2
const ACTUAL_SIZE_SCALE = 1

function defineGestureTest(renderer: 'vue' | 'litegraph') {
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
    await comfyPage.expectNodeCount(NODE_COUNT)

    await centerOnGraph(comfyPage, MID_SCALE)
    reportPerf(
      `${prefix} zoom flick mid`,
      await measureZoomFlicks(comfyPage, `${prefix}-zoom-flick-mid`)
    )
    reportPerf(
      `${prefix} pan flick mid`,
      await measurePanFlicks(comfyPage, `${prefix}-pan-flick-mid`)
    )

    await centerOnGraph(comfyPage, FAR_SCALE)
    reportPerf(
      `${prefix} zoom flick far`,
      await measureZoomFlicks(comfyPage, `${prefix}-zoom-flick-far`)
    )
    reportPerf(
      `${prefix} pan flick far`,
      await measurePanFlicks(comfyPage, `${prefix}-pan-flick-far`)
    )

    await centerOnGraph(comfyPage, ACTUAL_SIZE_SCALE)
    reportPerf(
      `${prefix} zoom step 100`,
      await measureZoomSteps(comfyPage, `${prefix}-zoom-step-100`)
    )
    reportPerf(
      `${prefix} node select`,
      await measureNodeSelect(comfyPage, `${prefix}-node-select`)
    )
    reportPerf(
      `${prefix} node nudge`,
      await measureNodeNudges(comfyPage, `${prefix}-node-nudge`)
    )
  })
}

test.use({ trace: 'off', video: 'off' })

test.describe('Vue nodes gestures', { tag: ['@perf', '@vue-nodes'] }, () => {
  test.setTimeout(TEST_TIMEOUT_MS)
  defineGestureTest('vue')
})

test.describe('LiteGraph gestures', { tag: ['@perf'] }, () => {
  test.setTimeout(TEST_TIMEOUT_MS)
  defineGestureTest('litegraph')
})
