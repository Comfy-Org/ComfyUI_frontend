import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.use({ initialSettings: { 'Comfy.UseNewMenu': 'Disabled' } })

function listenForEvent() {
  const state = { received: false }
  document.addEventListener(
    'litegraph:canvas',
    () => {
      state.received = true
    },
    { once: true }
  )
  return state
}

test.describe('Canvas Event', { tag: '@canvas' }, () => {
  test('Emit litegraph:canvas empty-release', async ({ comfyPage }) => {
    const state = await comfyPage.page.evaluateHandle(listenForEvent)
    await comfyPage.canvasOps.disconnectEdge()
    await expect
      .poll(() => state.evaluate(({ received }) => received))
      .toBe(true)
  })

  test('Emit litegraph:canvas empty-double-click', async ({ comfyPage }) => {
    const state = await comfyPage.page.evaluateHandle(listenForEvent)
    await comfyPage.canvasOps.doubleClick()
    await expect
      .poll(() => state.evaluate(({ received }) => received))
      .toBe(true)
  })
})
