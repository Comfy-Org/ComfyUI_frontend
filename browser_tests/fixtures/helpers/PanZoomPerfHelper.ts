import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { measureCadence } from '@e2e/fixtures/helpers/MinimapCadenceHelper'
import type { PerfMeasurement } from '@e2e/fixtures/helpers/PerformanceHelper'
import { nextFrame } from '@e2e/fixtures/utils/timing'
import {
  logMeasurement,
  recordMeasurement
} from '@e2e/fixtures/utils/perfReporter'

const PAN_STEPS = 60
const ZOOM_STEPS = 40
const IDLE_MS = 1500
const VIEW_SCALE = 0.6

const FIELDS = [
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
] as const satisfies readonly (keyof PerfMeasurement)[]

export async function trimGraphTo(comfyPage: ComfyPage, nodeCount: number) {
  await comfyPage.page.evaluate((keep) => {
    const app = window.app
    if (!app) throw new Error('window.app is not available')
    const graph = app.graph
    for (const node of graph.nodes.slice(keep)) graph.remove(node)
    graph.setDirtyCanvas(true, true)
  }, nodeCount)
  await comfyPage.nextFrame()
}

export async function centerOnGraph(comfyPage: ComfyPage) {
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

export async function waitForMeasuredVueNodes(
  comfyPage: ComfyPage,
  nodeCount: number
) {
  await expect
    .poll(async () => {
      const mounted = await comfyPage.page.locator('[data-node-id]').count()
      const measured = await comfyPage.page
        .locator('[data-node-id][data-measured]')
        .count()
      return mounted > 0 && mounted <= nodeCount && measured === mounted
    })
    .toBe(true)
}

export async function measureIdle(comfyPage: ComfyPage, name: string) {
  await comfyPage.perf.startMeasuring()
  await comfyPage.page.evaluate(
    (ms) => new Promise((resolve) => window.setTimeout(resolve, ms)),
    IDLE_MS
  )
  return comfyPage.perf.stopMeasuring(name)
}

export async function measurePan(comfyPage: ComfyPage, name: string) {
  await comfyPage.perf.startMeasuring()
  await comfyPage.canvasOps.panSweep({ steps: PAN_STEPS, dx: 6, dy: 3 })
  return comfyPage.perf.stopMeasuring(name)
}

export async function measureZoom(comfyPage: ComfyPage, name: string) {
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

const PROGRESS_JOB_ID = 'pan-zoom-perf-job'

export async function measureProgress(comfyPage: ComfyPage, name: string) {
  const nodeIds = await comfyPage.page.evaluate(() =>
    window.app!.graph.nodes.slice(0, 8).map((node) => String(node.id))
  )
  await comfyPage.page.evaluate((jobId) => {
    window.app!.api.dispatchCustomEvent('execution_start', {
      prompt_id: jobId,
      timestamp: Date.now()
    })
  }, PROGRESS_JOB_ID)
  try {
    return await measureCadence(comfyPage, name, (update) =>
      comfyPage.page.evaluate(
        ({ nodeIds, update, jobId }) => {
          const nodes = Object.fromEntries(
            nodeIds.map((nodeId) => [
              nodeId,
              {
                value: update,
                max: 20,
                state: 'running' as const,
                node_id: nodeId,
                display_node_id: nodeId,
                prompt_id: jobId
              }
            ])
          )
          window.app!.api.dispatchCustomEvent('progress_state', {
            prompt_id: jobId,
            nodes
          })
        },
        { nodeIds, update, jobId: PROGRESS_JOB_ID }
      )
    )
  } finally {
    await comfyPage.page.evaluate(() => {
      window.app!.api.dispatchCustomEvent('executing', null)
    })
  }
}

export function reportPerf(label: string, m: PerfMeasurement) {
  logMeasurement(label, m, FIELDS)
  recordMeasurement(m)
}
