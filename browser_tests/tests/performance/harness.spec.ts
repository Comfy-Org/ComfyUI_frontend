import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Performance measurement controls', { tag: ['@perf'] }, () => {
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
    if (result.kind !== 'accepted') {
      throw new Error(`Quiet control was rejected: ${result.reason}`)
    }
    const measurement = result.measurement

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
        buildMode: expect.any(String)
      }
    })
    expect(measurement.workloadIdentity.topology.hash).toMatch(/^sha256:/)
  })

  test('records a blocked main-thread gap before stop', async ({
    comfyPage
  }) => {
    await comfyPage.perf.startMeasuring()
    await comfyPage.page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            const end = performance.now() + 100
            let now = performance.now()
            while (now < end) now = performance.now()
            resolve()
          })
        })
    )
    const result = await comfyPage.perf.stopMeasuring(
      'raf-collector-busy-control'
    )
    if (result.kind !== 'accepted') {
      throw new Error(`Busy control was rejected: ${result.reason}`)
    }
    const measurement = result.measurement

    expect(measurement.rafIntervalsOver50Ms).toBeGreaterThanOrEqual(1)
    expect(measurement.totalBlockingTimeMs).toBeGreaterThan(0)
    expect(measurement.taskDurationMs).toBeGreaterThan(0)
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

  test('rejects workload identity drift during the window', async ({
    comfyPage
  }) => {
    await comfyPage.perf.startMeasuring()
    const viewport = comfyPage.page.viewportSize()
    if (!viewport) throw new Error('Viewport size is unavailable')
    await comfyPage.page.setViewportSize({
      width: viewport.width - 1,
      height: viewport.height
    })

    const result = await comfyPage.perf.stopMeasuring(
      'workload-identity-drift-control'
    )

    expect(result).toMatchObject({
      kind: 'rejected',
      reason: expect.stringContaining(
        'workload identity changed during measurement'
      )
    })
  })
})
