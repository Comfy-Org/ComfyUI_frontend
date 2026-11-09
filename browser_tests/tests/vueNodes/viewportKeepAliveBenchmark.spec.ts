import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import type { PerfMeasurement } from '@e2e/fixtures/helpers/PerformanceHelper'
import {
  logMeasurement,
  recordMeasurement
} from '@e2e/fixtures/utils/perfReporter'

/**
 * Comparative benchmark: Vue node viewport retention
 * (`Comfy.VueNodes.ViewportKeepAlive`) vs. keeping every node attached,
 * during a scripted pan + zoom sequence on a large graph.
 *
 * Logged, not asserted (beyond the per-variant attached-node invariants
 * below) — numbers vary per runner. See performance.spec.ts for the same
 * convention.
 */

const KEEP_ALIVE_SETTING = 'Comfy.VueNodes.ViewportKeepAlive'
const MAX_ATTACHED_RATIO_WITH_KEEP_ALIVE = 0.4
const PAN_ZOOM_REPEATS = 1
const KEEP_ALIVE_REFRESH_THROTTLE_MS = 100
const KEEP_ALIVE_SETTLE_MS = KEEP_ALIVE_REFRESH_THROTTLE_MS * 2
const ATTACHED_COUNT_STABLE_TIMEOUT_MS = 15_000

async function idleForMs(
  comfyPage: ComfyPage,
  durationMs: number
): Promise<void> {
  await comfyPage.page.evaluate(
    (ms) =>
      new Promise<void>((resolve) => {
        const start = performance.now()
        const tick = () => {
          if (performance.now() - start >= ms) resolve()
          else requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }),
    durationMs
  )
}

async function waitForAttachedNodeCountToStabilize(
  comfyPage: ComfyPage
): Promise<void> {
  await expect
    .poll(
      async () => {
        const before = await comfyPage.vueNodes.nodes.count()
        await idleForMs(comfyPage, KEEP_ALIVE_SETTLE_MS)
        const after = await comfyPage.vueNodes.nodes.count()
        return after === before
      },
      { timeout: ATTACHED_COUNT_STABLE_TIMEOUT_MS }
    )
    .toBe(true)
}

async function moveMouseToCanvasCenter(comfyPage: ComfyPage): Promise<void> {
  const box = await comfyPage.canvas.boundingBox()
  if (!box) throw new Error('Canvas bounding box not available')
  await comfyPage.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
}

async function wheelOnCanvas(
  comfyPage: ComfyPage,
  deltaY: number
): Promise<void> {
  await comfyPage.page.mouse.wheel(0, deltaY)
  await comfyPage.nextFrame()
}

async function runPanZoomSequence(
  comfyPage: ComfyPage,
  repeats: number
): Promise<void> {
  for (let i = 0; i < repeats; i++) {
    await comfyPage.canvasOps.panSweep({ steps: 20, dx: 48, dy: 18 })
    await moveMouseToCanvasCenter(comfyPage)
    const scaleBeforeZoom = await comfyPage.canvasOps.getScale()
    for (let z = 0; z < 5; z++) {
      await wheelOnCanvas(comfyPage, -100)
    }
    await expect
      .poll(() => comfyPage.canvasOps.getScale())
      .toBeGreaterThan(scaleBeforeZoom)
    for (let z = 0; z < 5; z++) {
      await wheelOnCanvas(comfyPage, 100)
    }
  }
}

type KeepAliveVariant = 'keep-alive-on' | 'keep-alive-off'

interface BenchmarkResult {
  totalNodeCount: number
  attachedNodeCount: number
  domNodeCount: number
  taskDurationMs: number
  measurement: PerfMeasurement
}

async function benchmarkViewportKeepAlive(
  comfyPage: ComfyPage,
  variant: KeepAliveVariant
): Promise<BenchmarkResult> {
  const keepAliveEnabled = variant === 'keep-alive-on'

  await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
  await comfyPage.settings.setSetting(KEEP_ALIVE_SETTING, keepAliveEnabled)
  await comfyPage.workflow.loadWorkflow('large-graph-workflow')

  const totalNodeCount = await comfyPage.page.evaluate(
    () => window.app!.graph.nodes.length
  )

  await comfyPage.vueNodes.waitForNodes()
  await comfyPage.idleFrames(30)

  if (keepAliveEnabled) {
    await expect
      .poll(() => comfyPage.vueNodes.nodes.count())
      .toBeLessThan(totalNodeCount)
    await expect.poll(() => comfyPage.vueNodes.nodes.count()).toBeGreaterThan(0)
  } else {
    await expect
      .poll(() => comfyPage.vueNodes.nodes.count(), { timeout: 30_000 })
      .toBe(totalNodeCount)
  }
  await waitForAttachedNodeCountToStabilize(comfyPage)

  const label = variant
  const markStart = `${label}-start`
  const markEnd = `${label}-end`
  const measureName = `${label}-pan-zoom`

  await comfyPage.perf.startMeasuring()
  await comfyPage.page.evaluate((name) => performance.mark(name), markStart)

  await runPanZoomSequence(comfyPage, PAN_ZOOM_REPEATS)
  await waitForAttachedNodeCountToStabilize(comfyPage)

  const wallClockMs = await comfyPage.page.evaluate(
    ({ start, end, name }) => {
      performance.mark(end)
      return performance.measure(name, start, end).duration
    },
    { start: markStart, end: markEnd, name: measureName }
  )
  const cdpMetrics = await comfyPage.perf.stopMeasuring(label)

  const [attachedNodeCount, domNodeCount] = await Promise.all([
    comfyPage.vueNodes.nodes.count(),
    comfyPage.page.evaluate(() => document.getElementsByTagName('*').length)
  ])

  logMeasurement(`Viewport KeepAlive (${label})`, cdpMetrics, [
    'domNodes',
    'layouts',
    'taskDurationMs',
    'totalBlockingTimeMs',
    'frameDurationMs'
  ])
  console.log(
    `Viewport KeepAlive (${label}): ${wallClockMs.toFixed(0)}ms wall clock, ` +
      `${attachedNodeCount}/${totalNodeCount} nodes attached, ` +
      `${domNodeCount} DOM elements total`
  )

  return {
    totalNodeCount,
    attachedNodeCount,
    domNodeCount,
    taskDurationMs: cdpMetrics.taskDurationMs,
    measurement: cdpMetrics
  }
}

test.describe('Viewport KeepAlive benchmark', { tag: ['@perf'] }, () => {
  test('viewport KeepAlive on reduces attached nodes', async ({
    comfyPage
  }) => {
    test.setTimeout(90_000)

    const on = await benchmarkViewportKeepAlive(comfyPage, 'keep-alive-on')

    expect(on.attachedNodeCount).toBeLessThan(
      on.totalNodeCount * MAX_ATTACHED_RATIO_WITH_KEEP_ALIVE
    )
    expect(on.attachedNodeCount).toBeGreaterThan(0)

    recordMeasurement(on.measurement)
  })

  test('viewport KeepAlive off keeps every node attached', async ({
    comfyPage
  }) => {
    test.setTimeout(120_000)

    const off = await benchmarkViewportKeepAlive(comfyPage, 'keep-alive-off')

    expect(off.attachedNodeCount).toBe(off.totalNodeCount)

    recordMeasurement(off.measurement)
  })
})
