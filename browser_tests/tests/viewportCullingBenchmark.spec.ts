import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  logMeasurement,
  recordMeasurement
} from '@e2e/fixtures/utils/perfReporter'

/**
 * Comparative benchmark: Vue node viewport retention
 * (`Comfy.VueNodes.ViewportKeepAlive`, default on) vs. keeping every node
 * attached, during a scripted pan + zoom sequence on a large graph.
 *
 * Offscreen nodes are always cached with `<KeepAlive>` rather than
 * unmounted - there is no destructive-unmount mode in this architecture, so
 * this is purely a detach/reattach-vs-stay-attached comparison, not a
 * lifecycle-cost comparison.
 *
 * This is a comparison, not a regression gate: CDP metrics and
 * PerformanceObserver entries vary too much machine-to-machine for a hard
 * threshold. Read the two console lines side by side - domNodes, layouts
 * and longtask time should all be lower with retention on than off.
 */

const KEEP_ALIVE_SETTING = 'Comfy.VueNodes.ViewportKeepAlive'
// large-graph-workflow has 245 nodes, above the 150-node activation
// threshold (MIN_NODES_FOR_KEEP_ALIVE in useViewportKeepAlive.ts), so
// retention actually engages here.
const TOTAL_NODE_COUNT = 245
// Kept intentionally small: the "off" baseline re-renders all 245 attached
// nodes on every frame-synced step, and each step is a round trip to the
// browser, so cost scales with step count far faster than with retention
// on. A single, short sweep is enough to show the on/off delta without the
// "off" run running long enough to starve the browser's main thread and
// leave CDP unresponsive to Playwright's own timeout/teardown.
const PAN_ZOOM_REPEATS = 1
// Lets the trailing edge of the 100ms throttled refresh in
// useViewportKeepAlive.ts (REFRESH_THROTTLE_MS) fire after the last pan/zoom
// step, so the settle cost is captured rather than cut off mid-flight.
const KEEP_ALIVE_SETTLE_FRAMES = 10

interface ObserverEntrySnapshot {
  longtaskCount: number
  longtaskDurationMs: number
  paintCount: number
  layoutShiftScore: number
}

async function installPerfObservers(page: Page): Promise<void> {
  await page.evaluate(() => {
    const state: ObserverEntrySnapshot = {
      longtaskCount: 0,
      longtaskDurationMs: 0,
      paintCount: 0,
      layoutShiftScore: 0
    }

    const longtaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        state.longtaskCount++
        state.longtaskDurationMs += entry.duration
      }
    })
    longtaskObserver.observe({ type: 'longtask', buffered: true })

    const paintObserver = new PerformanceObserver((list) => {
      state.paintCount += list.getEntries().length
    })
    paintObserver.observe({ type: 'paint', buffered: true })

    const layoutShiftObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as unknown as {
          value: number
          hadRecentInput: boolean
        }
        if (!shift.hadRecentInput) state.layoutShiftScore += shift.value
      }
    })
    try {
      layoutShiftObserver.observe({ type: 'layout-shift', buffered: true })
    } catch {
      // Unsupported outside Chromium — score stays 0.
    }

    ;(window as unknown as Record<string, unknown>).__cullingBenchObservers =
      state
  })
}

async function readPerfObservers(page: Page): Promise<ObserverEntrySnapshot> {
  return page.evaluate(() => {
    const state = (window as unknown as Record<string, unknown>)
      .__cullingBenchObservers as ObserverEntrySnapshot | undefined
    return (
      state ?? {
        longtaskCount: 0,
        longtaskDurationMs: 0,
        paintCount: 0,
        layoutShiftScore: 0
      }
    )
  })
}

async function measureMarkDurationMs(
  page: Page,
  measureName: string
): Promise<number> {
  return page.evaluate((name) => {
    const [entry] = performance.getEntriesByName(name, 'measure')
    return entry?.duration ?? 0
  }, measureName)
}

async function runPanZoomSequence(
  comfyPage: ComfyPage,
  repeats: number
): Promise<void> {
  for (let i = 0; i < repeats; i++) {
    await comfyPage.canvasOps.panSweep({ steps: 20 })
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

async function benchmarkViewportKeepAlive(
  comfyPage: ComfyPage,
  variant: KeepAliveVariant
): Promise<number> {
  const keepAliveEnabled = variant === 'keep-alive-on'

  await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
  await comfyPage.settings.setSetting(KEEP_ALIVE_SETTING, keepAliveEnabled)
  await comfyPage.workflow.loadWorkflow('large-graph-workflow')
  await comfyPage.vueNodes.waitForNodes()
  await comfyPage.idleFrames(30)

  if (keepAliveEnabled) {
    // Sanity check that retention actually engaged for this graph size — a
    // silent no-op here would make the run identical to "off". Detached
    // nodes are moved out of the live document, so attached count reads
    // lower than the total.
    await expect
      .poll(() => comfyPage.vueNodes.nodes.count())
      .toBeLessThan(TOTAL_NODE_COUNT)
  }

  await installPerfObservers(comfyPage.page)
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

  const [observerSnapshot, wallClockMs, attachedNodeCount] = await Promise.all([
    readPerfObservers(comfyPage.page),
    measureMarkDurationMs(comfyPage.page, measureName),
    comfyPage.vueNodes.nodes.count()
  ])

  recordMeasurement(cdpMetrics)
  logMeasurement(`Viewport KeepAlive (${label})`, cdpMetrics, [
    'domNodes',
    'layouts',
    'taskDurationMs',
    'totalBlockingTimeMs',
    'frameDurationMs'
  ])
  console.log(
    `Viewport KeepAlive (${label}): ${wallClockMs.toFixed(0)}ms wall clock, ` +
      `${attachedNodeCount} nodes attached, ${observerSnapshot.longtaskCount} longtasks ` +
      `(${observerSnapshot.longtaskDurationMs.toFixed(0)}ms), ` +
      `${observerSnapshot.paintCount} paints, layout-shift score ` +
      `${observerSnapshot.layoutShiftScore.toFixed(4)}`
  )

  return attachedNodeCount
}

test.describe('Viewport KeepAlive benchmark', { tag: ['@perf'] }, () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  test('pan + zoom with viewport KeepAlive on', async ({ comfyPage }) => {
    // 245 attached nodes reacting to a pan+zoom sweep measures in the tens
    // of seconds even with retention reducing the attached set - triple the
    // default timeout so it isn't a coin flip against it.
    test.slow()
    const attachedNodeCount = await benchmarkViewportKeepAlive(
      comfyPage,
      'keep-alive-on'
    )
    // Confirms retention actually reduced attached DOM nodes, so the "on"
    // and "off" numbers logged above are a real comparison, not two
    // identical runs.
    expect(attachedNodeCount).toBeLessThan(TOTAL_NODE_COUNT)
  })

  test('pan + zoom with viewport KeepAlive off', async ({ comfyPage }) => {
    // The "off" baseline keeps every one of the 245 nodes attached for the
    // whole sequence, so it is reliably slower than the "on" run above -
    // same triple-timeout headroom applies here.
    test.slow()
    const attachedNodeCount = await benchmarkViewportKeepAlive(
      comfyPage,
      'keep-alive-off'
    )
    // Confirms the baseline run really does keep every node attached.
    expect(attachedNodeCount).toBe(TOTAL_NODE_COUNT)
  })
})
