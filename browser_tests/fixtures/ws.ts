import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'
import type { WebSocketRoute } from '@playwright/test'

/**
 * The `/ws` connections the page opens, in order. A reconnect routes a second
 * time, so a test that drops the socket needs the route the client opened
 * *after* the drop, not the dead one it already holds.
 */
interface WebSocketTracker {
  current: () => WebSocketRoute | undefined
  waitForNext: () => Promise<WebSocketRoute>
}

function createWebSocketRouteHandler(
  connectWebSocketToServer: boolean,
  onRouted: (ws: WebSocketRoute) => void
) {
  return (ws: WebSocketRoute) => {
    if (connectWebSocketToServer) {
      const server = ws.connectToServer()
      server.onMessage((message) => {
        ws.send(message)
      })
    }

    onRouted(ws)
  }
}

export const webSocketFixture = base.extend<{
  connectWebSocketToServer: boolean
  getWebSocket: () => Promise<WebSocketRoute>
  nextWebSocket: () => Promise<WebSocketRoute>
  webSocketTracker: WebSocketTracker
}>({
  connectWebSocketToServer: [true, { option: true }],
  webSocketTracker: [
    async ({ context, connectWebSocketToServer }, use) => {
      let current: WebSocketRoute | undefined
      const waiters = new Set<(ws: WebSocketRoute) => void>()

      await context.routeWebSocket(
        /\/ws/,
        createWebSocketRouteHandler(connectWebSocketToServer, (ws) => {
          current = ws
          const pending = [...waiters]
          waiters.clear()
          for (const resolve of pending) resolve(ws)
        })
      )

      await use({
        current: () => current,
        waitForNext: () =>
          new Promise<WebSocketRoute>((resolve) => waiters.add(resolve))
      })
    },
    { auto: true }
  ],
  getWebSocket: async ({ webSocketTracker }, use) => {
    await use(() => {
      const open = webSocketTracker.current()
      return open ? Promise.resolve(open) : webSocketTracker.waitForNext()
    })
  },
  /**
   * Resolves with the NEXT socket the page opens. Call it before closing the
   * current one so the waiter is armed before the client reconnects.
   */
  nextWebSocket: async ({ webSocketTracker }, use) => {
    await use(() => webSocketTracker.waitForNext())
  }
})
