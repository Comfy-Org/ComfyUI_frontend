import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { PerfMeasurement } from '@e2e/fixtures/helpers/PerformanceHelper'

const CADENCE_UPDATES = 20
const CADENCE_INTERVAL_MS = 110

export interface CadenceOptions {
  updates?: number
  intervalMs?: number
}

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

export async function measureCadence(
  comfyPage: ComfyPage,
  measurementKey: string,
  applyUpdate: (update: number) => Promise<unknown>,
  {
    updates = CADENCE_UPDATES,
    intervalMs = CADENCE_INTERVAL_MS
  }: CadenceOptions = {}
) {
  await comfyPage.perf.startMeasuring()
  for (let update = 0; update < updates; update++) {
    await applyUpdate(update)
    await comfyPage.nextFrame()
    await comfyPage.page.evaluate(
      (delayMs) =>
        new Promise((resolve) => window.setTimeout(resolve, delayMs)),
      intervalMs
    )
  }
  return await comfyPage.perf.stopMeasuring(measurementKey)
}
