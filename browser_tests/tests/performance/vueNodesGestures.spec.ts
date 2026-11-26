import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import type { PerfMeasurement } from '@e2e/fixtures/helpers/PerformanceHelper'
import {
  measureNodeNudges,
  measureNodeSelect,
  measurePanFlicks,
  measureZoomFlicks,
  measureZoomSteps
} from '@e2e/fixtures/utils/gesturePerf'
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
    const measure = (
      scenario: string,
      run: (name: string) => Promise<PerfMeasurement>
    ) =>
      test.step(scenario, async () => {
        const name = `${prefix}-${scenario.replaceAll(' ', '-')}`
        reportPerf(`${prefix} ${scenario}`, await run(name))
      })

    await measure('load', (name) =>
      measureLoad(comfyPage, name, createChainWorkflow(NODE_COUNT), renderer)
    )
    await comfyPage.expectNodeCount(NODE_COUNT)

    await centerOnGraph(comfyPage, MID_SCALE)
    await measure('zoom flick mid', (name) =>
      measureZoomFlicks(comfyPage, name)
    )
    await measure('pan flick mid', (name) => measurePanFlicks(comfyPage, name))

    await centerOnGraph(comfyPage, FAR_SCALE)
    await measure('zoom flick far', (name) =>
      measureZoomFlicks(comfyPage, name)
    )
    await measure('pan flick far', (name) => measurePanFlicks(comfyPage, name))

    await centerOnGraph(comfyPage, ACTUAL_SIZE_SCALE)
    await measure('zoom step 100', (name) => measureZoomSteps(comfyPage, name))
    await measure('node select', (name) => measureNodeSelect(comfyPage, name))
    await measure('node nudge', (name) => measureNodeNudges(comfyPage, name))
  })
}

test.use({
  trace: 'off',
  video: 'off',
  initialSettings: { 'Comfy.Canvas.SmartGuides.Enabled': false }
})

test.describe('Vue nodes gestures', { tag: ['@perf', '@vue-nodes'] }, () => {
  test.setTimeout(TEST_TIMEOUT_MS)
  defineGestureTest('vue')
})

test.describe('LiteGraph gestures', { tag: ['@perf'] }, () => {
  test.setTimeout(TEST_TIMEOUT_MS)
  defineGestureTest('litegraph')
})
