import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { PerformanceMonitor } from '../helpers/performanceMonitor'

function listenForEvent(): Promise<Event> {
  return new Promise<Event>((resolve) => {
    document.addEventListener('litegraph:canvas', (e) => resolve(e), {
      once: true
    })
  })
}

test.describe('Canvas Event', () => {
  test('@perf Emit litegraph:canvas empty-release', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'canvas-empty-release'

    await perfMonitor.startMonitoring(testName)

    const eventPromise = comfyPage.page.evaluate(listenForEvent)

    await perfMonitor.measureOperation('disconnect-edge', async () => {
      await comfyPage.disconnectEdge()
    })

    const event = await eventPromise

    expect(event).not.toBeNull()
    // No further check on event content as the content is dropped by
    // playwright for some reason.
    // See https://github.com/microsoft/playwright/issues/31580

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Emit litegraph:canvas empty-double-click', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'canvas-double-click'

    await perfMonitor.startMonitoring(testName)

    const eventPromise = comfyPage.page.evaluate(listenForEvent)

    await perfMonitor.measureOperation('double-click-canvas', async () => {
      await comfyPage.doubleClickCanvas()
    })

    const event = await eventPromise

    expect(event).not.toBeNull()
    // No further check on event content as the content is dropped by
    // playwright for some reason.
    // See https://github.com/microsoft/playwright/issues/31580

    await perfMonitor.finishMonitoring(testName)
  })
})
