import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { measureCadence } from '@e2e/fixtures/helpers/MinimapCadenceHelper'
import type { PerfMeasurement } from '@e2e/fixtures/helpers/PerformanceHelper'
import { nextFrame } from '@e2e/fixtures/utils/timing'
import {
  logMeasurement,
  recordMeasurement
} from '@e2e/fixtures/utils/perfReporter'

const NODE_SCALES = [60, 245] as const
const PAN_STEPS = 60
const ZOOM_STEPS = 40
const IDLE_MS = 1500
const VIEW_SCALE = 0.6
const TEST_TIMEOUT_MS = 300_000

async function trimGraphTo(comfyPage: ComfyPage, nodeCount: number) {
  await comfyPage.page.evaluate((keep) => {
    const app = window.app
    if (!app) throw new Error('window.app is not available')
    const graph = app.graph
    for (const node of graph.nodes.slice(keep)) graph.remove(node)
    graph.setDirtyCanvas(true, true)
  }, nodeCount)
  await comfyPage.nextFrame()
}

async function centerOnGraph(comfyPage: ComfyPage) {
  await comfyPage.page.evaluate((scale) => {
    const app = window.app
    if (!app) throw new Error('window.app is not available')
    const nodes = app.graph.nodes
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const node of nodes) {
      minX = Math.min(minX, node.pos[0])
      minY = Math.min(minY, node.pos[1])
      maxX = Math.max(maxX, node.pos[0] + node.size[0])
      maxY = Math.max(maxY, node.pos[1] + node.size[1])
    }
    const canvas = app.canvas
    const width = canvas.canvas.width
    const height = canvas.canvas.height
    canvas.ds.scale = scale
    canvas.ds.offset[0] = -(minX + maxX) / 2 + width / scale / 2
    canvas.ds.offset[1] = -(minY + maxY) / 2 + height / scale / 2
    canvas.setDirty(true, true)
  }, VIEW_SCALE)
  await comfyPage.nextFrame()
}

async function measureIdle(comfyPage: ComfyPage, name: string) {
  await comfyPage.perf.startMeasuring()
  await comfyPage.page.evaluate(
    (ms) => new Promise((resolve) => window.setTimeout(resolve, ms)),
    IDLE_MS
  )
  return comfyPage.perf.stopMeasuring(name)
}

async function measurePan(comfyPage: ComfyPage, name: string) {
  await comfyPage.perf.startMeasuring()
  await comfyPage.canvasOps.panSweep({ steps: PAN_STEPS, dx: 6, dy: 3 })
  return comfyPage.perf.stopMeasuring(name)
}

async function measureZoom(comfyPage: ComfyPage, name: string) {
  const box = await comfyPage.canvas.boundingBox()
  if (!box) throw new Error('Canvas bounding box not available')
  await comfyPage.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await comfyPage.perf.startMeasuring()
  for (let i = 0; i < ZOOM_STEPS; i++) {
    await comfyPage.page.mouse.wheel(0, -60)
    await nextFrame(comfyPage.page)
  }
  for (let i = 0; i < ZOOM_STEPS; i++) {
    await comfyPage.page.mouse.wheel(0, 60)
    await nextFrame(comfyPage.page)
  }
  return comfyPage.perf.stopMeasuring(name)
}

async function measureProgress(comfyPage: ComfyPage, name: string) {
  const nodeIds = await comfyPage.page.evaluate(() =>
    window.app!.graph.nodes.slice(0, 8).map((node) => String(node.id))
  )
  return measureCadence(comfyPage, name, (update) =>
    comfyPage.page.evaluate(
      ({ nodeIds, update }) => {
        const api = window.app?.api
        if (!api) throw new Error('window.app.api is not available')
        const nodes = Object.fromEntries(
          nodeIds.map((nodeId) => [
            nodeId,
            {
              value: update,
              max: 20,
              state: 'running' as const,
              node_id: nodeId,
              display_node_id: nodeId,
              prompt_id: 'pan-zoom-perf-job'
            }
          ])
        )
        api.dispatchCustomEvent('progress_state', {
          prompt_id: 'pan-zoom-perf-job',
          nodes
        })
      },
      { nodeIds, update }
    )
  )
}

const FIELDS: (keyof PerfMeasurement)[] = [
  'frameDurationMs',
  'p95FrameDurationMs',
  'totalBlockingTimeMs',
  'taskDurationMs',
  'scriptDurationMs',
  'styleRecalcs',
  'styleRecalcDurationMs',
  'layouts',
  'layoutDurationMs',
  'durationMs'
]

function report(label: string, m: PerfMeasurement) {
  logMeasurement(label, m, FIELDS)
  recordMeasurement(m)
}

function defineArms(renderer: 'vue' | 'litegraph') {
  for (const nodeCount of NODE_SCALES) {
    test(`${renderer} ${nodeCount} nodes`, async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('large-graph-workflow')
      if (nodeCount < 245) await trimGraphTo(comfyPage, nodeCount)
      await centerOnGraph(comfyPage)
      const actual = await comfyPage.page.evaluate(
        () => window.app!.graph.nodes.length
      )
      expect(actual).toBe(nodeCount)
      await comfyPage.page.evaluate(
        () => new Promise((resolve) => window.setTimeout(resolve, 1000))
      )

      const prefix = `${renderer}-${nodeCount}`
      report(`${prefix} idle`, await measureIdle(comfyPage, `${prefix}-idle`))
      report(`${prefix} pan`, await measurePan(comfyPage, `${prefix}-pan`))
      report(`${prefix} zoom`, await measureZoom(comfyPage, `${prefix}-zoom`))
      report(
        `${prefix} progress`,
        await measureProgress(comfyPage, `${prefix}-progress`)
      )
    })
  }
}

test.use({ trace: 'off', video: 'off' })

test.describe('Vue nodes pan/zoom', { tag: ['@perf', '@vue-nodes'] }, () => {
  test.setTimeout(TEST_TIMEOUT_MS)
  defineArms('vue')
})

test.describe('LiteGraph pan/zoom', { tag: ['@perf'] }, () => {
  test.setTimeout(TEST_TIMEOUT_MS)
  defineArms('litegraph')
})
