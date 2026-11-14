import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { PerfMeasurement } from '@e2e/fixtures/helpers/PerformanceHelper'

const CADENCE_UPDATES = 20
const CADENCE_INTERVAL_MS = 110

/**
 * Assert the sampled frames cover the measurement window rather than a slice of
 * it, so a recorded baseline describes the cadence under test.
 */
export function expectFramesToSpanMeasurementWindow(
  measurement: PerfMeasurement
) {
  const sampledMs = measurement.allFrameDurationsMs.reduce((a, b) => a + b, 0)
  expect(sampledMs).toBeGreaterThan(measurement.durationMs / 2)
}

/**
 * Drive a fixed cadence of graph updates inside one measurement window.
 *
 * Owns the iteration count, the frame wait and the inter-update delay; callers
 * supply only the update to apply and receive the measurement to assert on.
 * The update index is passed through so a caller can alternate behaviour.
 */
export async function measureCadence(
  comfyPage: ComfyPage,
  measurementKey: string,
  applyUpdate: (update: number) => Promise<unknown>
) {
  await comfyPage.perf.startMeasuring()
  for (let update = 0; update < CADENCE_UPDATES; update++) {
    await applyUpdate(update)
    await comfyPage.nextFrame()
    await comfyPage.page.evaluate(
      (intervalMs) =>
        new Promise((resolve) => window.setTimeout(resolve, intervalMs)),
      CADENCE_INTERVAL_MS
    )
  }
  return await comfyPage.perf.stopMeasuring(measurementKey)
}
