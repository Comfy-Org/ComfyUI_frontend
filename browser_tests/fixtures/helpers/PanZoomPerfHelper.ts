import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'

import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { measureCadence } from '@e2e/fixtures/helpers/MinimapCadenceHelper'
import type { CadenceOptions } from '@e2e/fixtures/helpers/MinimapCadenceHelper'
import type { PerfMeasurement } from '@e2e/fixtures/helpers/PerformanceHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { nodeGraphPosition } from '@e2e/fixtures/utils/nodeGraphPosition'
import {
  logMeasurement,
  recordMeasurement
} from '@e2e/fixtures/utils/perfReporter'
import { nextFrame } from '@e2e/fixtures/utils/timing'

const PAN_STEPS = 60
const ZOOM_STEPS = 40
const DRAG_STEPS = 60
const SETTLE_FRAMES = 10
const IDLE_MS = 1500
const LOAD_TIMEOUT_MS = 120_000
const VIEW_SCALE = 0.6
const LARGE_GRAPH_NODE_COUNT = 245

export type Renderer = 'vue' | 'litegraph'

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

export async function centerOnGraph(comfyPage: ComfyPage, scale = VIEW_SCALE) {
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
  }, scale)
  await comfyPage.nextFrame()
}

async function waitForMeasuredVueNodes(
  comfyPage: ComfyPage,
  nodeCount: number,
  timeout?: number
) {
  await expect(
    comfyPage.page.locator('[data-node-id][data-measured]')
  ).toHaveCount(nodeCount, { timeout })
}

export async function loadCenteredGraph(
  comfyPage: ComfyPage,
  renderer: Renderer,
  nodeCount: number
) {
  await comfyPage.workflow.loadWorkflowData('large-graph-workflow')
  if (nodeCount < LARGE_GRAPH_NODE_COUNT)
    await trimGraphTo(comfyPage, nodeCount)
  await centerOnGraph(comfyPage)
  if (renderer === 'vue') await waitForMeasuredVueNodes(comfyPage, nodeCount)
}

export async function measureLoad(
  comfyPage: ComfyPage,
  name: string,
  workflow: ComfyWorkflowJSON,
  renderer: Renderer
) {
  await comfyPage.perf.startMeasuring()
  await comfyPage.page.evaluate((wf) => window.app!.loadGraphData(wf), workflow)
  if (renderer === 'vue') {
    const allNodesMeasured = comfyPage.page
      .locator('[data-node-id][data-measured]')
      .nth(workflow.nodes.length - 1)
    await expect(
      comfyPage.page.getByTestId('node-box-overlay').or(allNodesMeasured)
    ).toBeVisible({ timeout: LOAD_TIMEOUT_MS })
  }
  await comfyPage.nextFrame()
  return comfyPage.perf.stopMeasuring(name)
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

async function settle(comfyPage: ComfyPage) {
  for (let i = 0; i < SETTLE_FRAMES; i++) await nextFrame(comfyPage.page)
}

export async function findCenterNodeGrip(comfyPage: ComfyPage) {
  return comfyPage.page.evaluate(() => {
    const canvas = window.app!.canvas
    const rect = canvas.canvas.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const titleHeight = window.LiteGraph!.NODE_TITLE_HEIGHT
    const grips = window.app!.graph.nodes.map((node) => {
      const [x, y] = canvas.ds.convertOffsetToCanvas([
        node.pos[0] + node.size[0] / 2,
        node.pos[1] - titleHeight / 2
      ])
      return { id: node.id, x: rect.left + x, y: rect.top + y }
    })
    const distance = (grip: { x: number; y: number }) =>
      Math.hypot(grip.x - centerX, grip.y - centerY)
    return grips.reduce((a, b) => (distance(a) <= distance(b) ? a : b))
  })
}

export async function measureNodeDrag(comfyPage: ComfyPage, name: string) {
  const grip = await findCenterNodeGrip(comfyPage)
  const position = () => nodeGraphPosition(comfyPage, grip.id)
  const start = await position()

  const { mouse } = comfyPage.page
  await mouse.move(grip.x, grip.y)
  await comfyPage.perf.startMeasuring()
  await mouse.down()
  for (let i = 1; i <= DRAG_STEPS; i++) {
    await mouse.move(grip.x + i * 4, grip.y + i * 2)
    await nextFrame(comfyPage.page)
  }
  const farthest = await position()
  for (let i = DRAG_STEPS; i >= 0; i--) {
    await mouse.move(grip.x + i * 4, grip.y + i * 2)
    await nextFrame(comfyPage.page)
  }
  await mouse.up()
  await settle(comfyPage)
  const measurement = await comfyPage.perf.stopMeasuring(name)
  expect(farthest).not.toEqual(start)
  return measurement
}

export async function measureSelectAll(comfyPage: ComfyPage, name: string) {
  const nodeCount = await comfyPage.nodeOps.getGraphNodesCount()
  await comfyPage.perf.startMeasuring()
  await comfyPage.canvas.press('Control+a')
  await expect
    .poll(() =>
      comfyPage.page.evaluate(() => window.app!.canvas.selectedItems.size)
    )
    .toBe(nodeCount)
  await settle(comfyPage)
  return comfyPage.perf.stopMeasuring(name)
}

const PROGRESS_MAX = 20
const PROGRESS_NODES = 8
const FILL_TOLERANCE = 0.01

export const SLOW_PROGRESS_CADENCE = { updates: 10, intervalMs: 400 }

async function expectFilled(fills: Locator, count: number, fraction: number) {
  await expect(fills).toHaveCount(count)
  await expect
    .poll(() =>
      fills.evaluateAll(
        (elements, fraction) =>
          Math.max(
            ...elements.map((element) => {
              const track = element.parentElement!.getBoundingClientRect()
              if (!element.checkVisibility({ visibilityProperty: true }))
                return Infinity
              const filled =
                (element.getBoundingClientRect().right - track.left) /
                track.width
              return Math.abs(filled - fraction)
            })
          ),
        fraction
      )
    )
    .toBeLessThan(FILL_TOLERANCE)
}

export function queueProgressFill(comfyPage: ComfyPage, docked: boolean) {
  return docked
    ? comfyPage.actionbar.inlineProgressNodeFill
    : comfyPage.queuePanel.progressNodeFill
}

export async function measureProgress(
  comfyPage: ComfyPage,
  name: string,
  renderer: Renderer,
  {
    cadence,
    queueFill
  }: {
    cadence?: CadenceOptions
    queueFill?: Locator
  } = {}
) {
  const { nodeIds, nodesRenderAsDom } = await comfyPage.page.evaluate(
    ({ count, vueRenderer }) => {
      const nodesRenderAsDom =
        vueRenderer && !window.LiteGraph!.vueNodesSuspended
      const nodeIds = window
        .app!.graph.nodes.map((node) => String(node.id))
        .filter(
          (nodeId) =>
            !nodesRenderAsDom ||
            document.querySelector(`[data-node-id="${nodeId}"]`) !== null
        )
        .slice(0, count)
      return { nodeIds, nodesRenderAsDom }
    },
    { count: PROGRESS_NODES, vueRenderer: renderer === 'vue' }
  )
  expect(nodeIds).toHaveLength(PROGRESS_NODES)
  const jobId = await new ExecutionHelper(comfyPage).run({ start: false })
  await comfyPage.page.evaluate((jobId) => {
    window.app!.api.dispatchCustomEvent('execution_start', {
      prompt_id: jobId,
      timestamp: Date.now()
    })
  }, jobId)
  try {
    const updates = cadence?.updates ?? PROGRESS_MAX
    const step = PROGRESS_MAX / updates
    const measurement = await measureCadence(
      comfyPage,
      name,
      (update) =>
        comfyPage.page.evaluate(
          ({ nodeIds, value, max, jobId }) => {
            const nodes = Object.fromEntries(
              nodeIds.map((nodeId) => [
                nodeId,
                {
                  value,
                  max,
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
          {
            nodeIds,
            value: update * step,
            max: PROGRESS_MAX,
            jobId
          }
        ),
      { ...cadence, updates }
    )
    const shown = ((updates - 1) * step) / PROGRESS_MAX
    if (nodesRenderAsDom) {
      await expectFilled(
        comfyPage.page.getByTestId(TestIds.node.progressFill),
        nodeIds.length,
        shown
      )
    }
    if (queueFill) await expectFilled(queueFill, 1, shown)
    return measurement
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
