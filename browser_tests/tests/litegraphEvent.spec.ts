import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

function listenForEvent(): Promise<Event> {
  return new Promise<Event>((resolve) => {
    document.addEventListener('litegraph:canvas', (e) => resolve(e), {
      once: true
    })
  })
}

test.describe('Canvas Event', () => {
  test('Emit litegraph:canvas empty-release', async ({ comfyPage }) => {
    const eventPromise = comfyPage.page.evaluate(listenForEvent)
    const disconnectPromise = comfyPage.disconnectEdge()
    const event = await eventPromise
    await disconnectPromise

    expect(event).not.toBeNull()
    // No further check on event content as the content is dropped by
    // playwright for some reason.
    // See https://github.com/microsoft/playwright/issues/31580
  })

  test('Emit litegraph:canvas empty-double-click', async ({ comfyPage }) => {
    const eventPromise = comfyPage.page.evaluate(listenForEvent)
    const doubleClickPromise = comfyPage.doubleClickCanvas()
    const event = await eventPromise
    await doubleClickPromise

    expect(event).not.toBeNull()
    // No further check on event content as the content is dropped by
    // playwright for some reason.
    // See https://github.com/microsoft/playwright/issues/31580
  })
})
