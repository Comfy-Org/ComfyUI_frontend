import { mergeTests } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

test.describe('WebSocket reconnect on account switch', { tag: '@ui' }, () => {
  test('tears down the old socket and re-handshakes on an identity switch', async ({
    comfyPage,
    getWebSocket
  }) => {
    const initialSocket = await getWebSocket()
    let initialClosed = false
    initialSocket.onClose(() => {
      initialClosed = true
    })

    // The account-switch path (authStore.onAuthStateChanged) reconnects the
    // realtime socket through api.resetSocket(); drive it directly to assert
    // the connection-plane contract without a full cloud-auth harness.
    await comfyPage.page.evaluate(() => window.app!.api.resetSocket())

    await expect.poll(() => initialClosed).toBe(true)
    await expect
      .poll(async () => (await getWebSocket()) !== initialSocket)
      .toBe(true)
  })
})
