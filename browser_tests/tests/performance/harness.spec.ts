import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { getMeasurementRejectionReason } from '@e2e/fixtures/helpers/PerformanceHelper'

test.describe('Performance measurement controls', { tag: ['@perf'] }, () => {
  test('rejects non-monotonic CDP counters', () => {
    expect(
      getMeasurementRejectionReason(null, ['TaskDuration', 'ProcessTime'])
    ).toBe('non-monotonic CDP metrics: TaskDuration, ProcessTime')
  })

  test('collects quiet rAF intervals inside the measured window', async ({
    comfyPage
  }) => {
    await comfyPage.perf.startMeasuring()
    await comfyPage.page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          let remaining = 30
          function tick() {
            remaining--
            if (remaining === 0) resolve()
            else requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        })
    )
    const result = await comfyPage.perf.stopMeasuring(
      'raf-collector-quiet-control'
    )
    const measurement = result.measurement

    expect(result.kind).toBe('accepted')
    expect(measurement.rafIntervalCount).toBeGreaterThanOrEqual(10)
    expect(measurement.rafIntervalMaxMs).toBeGreaterThan(0)
    expect(measurement.rafIntervalP50Ms).toBeGreaterThan(0)
    expect(measurement.rafIntervalsMs).toHaveLength(
      measurement.rafIntervalCount
    )
    expect(measurement.workloadIdentity).toMatchObject({
      schemaVersion: 1,
      environment: {
        frontendVersion: expect.any(String),
        frontendCommit: expect.any(String),
        buildMode: expect.stringMatching(/^(development|production|test)$/)
      }
    })
    expect(measurement.workloadIdentity.topology.hash).toMatch(/^sha256:/)
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
    const result = await comfyPage.perf.stopMeasuring(
      'raf-collector-busy-control'
    )
    const measurement = result.measurement

    expect(result.kind).toBe('accepted')
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

  test('rejects a window with an intervening visibility change', async ({
    comfyPage
  }) => {
    await comfyPage.perf.startMeasuring()
    await comfyPage.page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    const result = await comfyPage.perf.stopMeasuring(
      'raf-collector-visibility-control'
    )

    expect(result).toMatchObject({
      kind: 'rejected',
      reason: 'document visibility toggled during the measurement window'
    })
  })
})
