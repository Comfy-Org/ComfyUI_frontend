import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { summarizeRafIntervals } from '@e2e/fixtures/helpers/PerformanceHelper'

test.describe('Performance measurement controls', { tag: ['@perf'] }, () => {
  test('summarizes percentiles and strict budget buckets', () => {
    const intervals = [8.33, 8.34, 16.67, 16.68, 33.3, 33.31, 50, 50.01]

    expect(summarizeRafIntervals(intervals)).toEqual({
      rafIntervalCount: 8,
      rafIntervalP50Ms: 16.68,
      rafIntervalP95Ms: 50.01,
      rafIntervalP99Ms: 50.01,
      rafIntervalMaxMs: 50.01,
      rafIntervalsOver8_33Ms: 7,
      rafIntervalsOver16_67Ms: 5,
      rafIntervalsOver33_3Ms: 3,
      rafIntervalsOver50Ms: 1
    })
    expect(intervals).toEqual([
      8.33, 8.34, 16.67, 16.68, 33.3, 33.31, 50, 50.01
    ])
  })

  test('collects quiet rAF intervals inside the measured window', async ({
    comfyPage
  }) => {
    await comfyPage.perf.startMeasuring()
    await comfyPage.page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          let remaining = 10
          function tick() {
            remaining--
            if (remaining === 0) resolve()
            else requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        })
    )
    const measurement = await comfyPage.perf.stopMeasuring(
      'raf-collector-quiet-control'
    )

    expect(measurement.rejectedRunReason).toBeNull()
    expect(measurement.rafIntervalCount).toBeGreaterThanOrEqual(10)
    expect(measurement.rafIntervalsOver50Ms).toBe(0)
    expect(measurement.rafIntervalMaxMs).toBeLessThan(50)
    expect(measurement.rafIntervalsMs).toHaveLength(
      measurement.rafIntervalCount
    )
  })

  test('records a blocked main-thread gap before stop', async ({
    comfyPage
  }) => {
    await comfyPage.perf.startMeasuring()
    await comfyPage.page.evaluate(() => {
      const end = performance.now() + 100
      let now = performance.now()
      while (now < end) now = performance.now()
    })
    const measurement = await comfyPage.perf.stopMeasuring(
      'raf-collector-busy-control'
    )

    expect(measurement.rejectedRunReason).toBeNull()
    expect(measurement.rafIntervalsOver50Ms).toBeGreaterThanOrEqual(1)
    // rAF timestamps are display-aligned, so a 100ms task may surface as a
    // slightly shorter multiple of the refresh interval at either boundary.
    expect(measurement.rafIntervalMaxMs).toBeGreaterThan(50)
    expect(measurement.rafIntervalP50Ms).toBeLessThanOrEqual(
      measurement.rafIntervalP95Ms
    )
    expect(measurement.rafIntervalP95Ms).toBeLessThanOrEqual(
      measurement.rafIntervalP99Ms
    )
    expect(measurement.rafIntervalP99Ms).toBeLessThanOrEqual(
      measurement.rafIntervalMaxMs
    )
  })
})
