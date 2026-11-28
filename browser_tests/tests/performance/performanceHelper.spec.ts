import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { PerformanceHelper } from '@e2e/fixtures/helpers/PerformanceHelper'

test.describe('PerformanceHelper', { tag: '@perf' }, () => {
  test('captures an immediate blocking workload in frame timing', async ({
    page
  }) => {
    await page.goto('about:blank')
    const perf = new PerformanceHelper(page)
    await perf.init()

    try {
      await perf.startMeasuring()
      await page.evaluate(() => {
        const end = performance.now() + 80
        while (performance.now() < end) {
          // Deliberately block the renderer to falsify a missing first interval.
        }
      })
      const measurement = await perf.stopMeasuring('immediate-block')

      expect(Math.max(...measurement.allFrameDurationsMs)).toBeGreaterThan(50)
    } finally {
      await perf.dispose()
    }
  })
})
