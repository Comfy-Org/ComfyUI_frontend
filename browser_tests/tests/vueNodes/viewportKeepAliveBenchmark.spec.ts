import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
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
const MAX_ATTACHED_RATIO_WITH_KEEP_ALIVE = 0.8
// Kept intentionally small: the "off" baseline re-renders every attached
// node on every frame-synced step, so cost scales with step count far
// faster than with retention on. dx/dy (not steps) control sweep distance —
// see runPanZoomSequence.
const PAN_ZOOM_REPEATS = 1
// Lets the trailing edge of the 100ms throttled refresh in
// useViewportKeepAlive.ts (REFRESH_THROTTLE_MS) fire after the last pan/zoom
// step, so the settle cost is captured rather than cut off mid-flight.
const KEEP_ALIVE_SETTLE_FRAMES = 10

async function measureMarkDurationMs(
  comfyPage: ComfyPage,
  measureName: string
): Promise<number> {
  return comfyPage.page.evaluate((name) => {
    const [entry] = performance.getEntriesByName(name, 'measure')
    return entry?.duration ?? 0
  }, measureName)
}

async function runPanZoomSequence(
  comfyPage: ComfyPage,
  repeats: number
): Promise<void> {
  for (let i = 0; i < repeats; i++) {
    // dx/dy are 6x the panSweep() defaults: the graph spans ~5300x19600
    // units, and the default 8/3 amplitude only traverses a few hundred
    // units round trip — far too small to cross viewport boundaries and
    // force real attach/detach churn.
    await comfyPage.canvasOps.panSweep({ steps: 20, dx: 48, dy: 18 })
    for (let z = 0; z < 5; z++) {
      await comfyPage.canvasOps.zoom(-100)
      await comfyPage.nextFrame()
    }
    for (let z = 0; z < 5; z++) {
      await comfyPage.canvasOps.zoom(100)
      await comfyPage.nextFrame()
    }
  }
}

type KeepAliveVariant = 'keep-alive-on' | 'keep-alive-off'

interface BenchmarkResult {
  totalNodeCount: number
  attachedNodeCount: number
  domNodeCount: number
  taskDurationMs: number
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

  // Wait for the first node to mount, then let the throttled keep-alive
  // refresh settle, before measuring — otherwise mount cost lands inside
  // the measurement window. Retention keeps the attached count below the
  // total from the start, so waiting for the full total here would hang
  // when keep-alive is on.
  await comfyPage.vueNodes.waitForNodes()
  await comfyPage.idleFrames(30)

  if (keepAliveEnabled) {
    // Sanity check that retention actually engaged for this graph size — a
    // silent no-op here would make the run identical to "off". Detached
    // nodes are moved out of the live document, so attached count reads
    // lower than the total. This poll also acts as this variant's settle
    // gate: it only resolves once retention has caught up.
    await expect
      .poll(() => comfyPage.vueNodes.nodes.count())
      .toBeLessThan(totalNodeCount)
  } else {
    // Confirm the baseline really does mount and hold every node attached
    // before the timed measurement starts — keep-alive never engages here,
    // so this should simply catch up with a slow-mounting CI container.
    await expect
      .poll(() => comfyPage.vueNodes.nodes.count(), { timeout: 30_000 })
      .toBe(totalNodeCount)
  }

  const label = variant
  const markStart = `${label}-start`
  const markEnd = `${label}-end`
  const measureName = `${label}-pan-zoom`

  await comfyPage.page.evaluate((name) => performance.mark(name), markStart)
  await comfyPage.perf.startMeasuring()

  await runPanZoomSequence(comfyPage, PAN_ZOOM_REPEATS)

  // Let the trailing edge of the throttled refresh (and any pending
  // attach/detach) settle before reading final numbers.
  await comfyPage.idleFrames(KEEP_ALIVE_SETTLE_FRAMES)

  const cdpMetrics = await comfyPage.perf.stopMeasuring(label)
  await comfyPage.page.evaluate(
    ({ start, end, name }) => {
      performance.mark(end)
      performance.measure(name, start, end)
    },
    { start: markStart, end: markEnd, name: measureName }
  )

  const [wallClockMs, attachedNodeCount, domNodeCount] = await Promise.all([
    measureMarkDurationMs(comfyPage, measureName),
    comfyPage.vueNodes.nodes.count(),
    comfyPage.page.evaluate(() => document.getElementsByTagName('*').length)
  ])

  recordMeasurement(cdpMetrics)
  // frameDurationMs is intentionally excluded: PerformanceHelper samples it
  // after stopMeasuring(), i.e. during idle, so it reflects idle rAF
  // cadence rather than the pan/zoom interaction and isn't a meaningful
  // comparison point here.
  logMeasurement(`Viewport KeepAlive (${label})`, cdpMetrics, [
    'domNodes',
    'layouts',
    'taskDurationMs',
    'totalBlockingTimeMs'
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
    taskDurationMs: cdpMetrics.taskDurationMs
  }
}

test.describe('Viewport KeepAlive benchmark', { tag: ['@perf'] }, () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  // Split into separate tests (each with its own fresh comfyPage) rather
  // than running both variants back to back on one page: a shared page
  // gives the second variant a warmed-up JIT and a larger heap, biasing
  // whichever variant runs second. Each variant's own duration is logged
  // via recordMeasurement/console.log above; there's no same-test on/off
  // ratio to assert since nothing is shared between the two runs.

  test('viewport KeepAlive on reduces attached nodes', async ({
    comfyPage
  }) => {
    // Observed task duration for this variant is ~4.5-6.5s; the 60s
    // performance-project default covers that comfortably, but workflow
    // load + mount settle adds real wall-clock time on a loaded CI runner.
    test.setTimeout(90_000)

    const on = await benchmarkViewportKeepAlive(comfyPage, 'keep-alive-on')

    // Retention must reduce the attached set by more than a token amount -
    // bound to a viewport-derived fraction rather than "less than the full
    // count", which a single detached node would also satisfy.
    expect(on.attachedNodeCount).toBeLessThan(
      on.totalNodeCount * MAX_ATTACHED_RATIO_WITH_KEEP_ALIVE
    )
  })

  test('viewport KeepAlive off keeps every node attached', async ({
    comfyPage
  }) => {
    // Observed task duration for this variant is ~20-26s, well above the
    // "on" variant, so give it more headroom than the 60s project default.
    test.setTimeout(120_000)

    const off = await benchmarkViewportKeepAlive(comfyPage, 'keep-alive-off')

    // The "off" baseline keeps every node attached for the whole sequence.
    expect(off.attachedNodeCount).toBe(off.totalNodeCount)
  })
})
