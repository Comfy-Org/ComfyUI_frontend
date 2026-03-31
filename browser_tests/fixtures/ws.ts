import { test as base } from '@playwright/test'
import type { WebSocketRoute } from '@playwright/test'

export interface MockWebSocket {
  /** The intercepted WebSocket route. */
  ws: WebSocketRoute
  /** Stop forwarding real server messages to the page. */
  stopServerForwarding(): void
}

export const webSocketFixture = base.extend<{
  getWebSocket: () => Promise<MockWebSocket>
}>({
  getWebSocket: [
    async ({ context }, use) => {
      let latest: MockWebSocket | undefined
      let resolve: ((mock: MockWebSocket) => void) | undefined

      await context.routeWebSocket(/\/ws/, (ws) => {
        let forwarding = true
        const server = ws.connectToServer()
        server.onMessage((message) => {
          if (forwarding) ws.send(message)
        })

        const mock: MockWebSocket = {
          ws,
          stopServerForwarding() {
            forwarding = false
          }
        }
        latest = mock
        resolve?.(mock)
      })

      await use(() => {
        if (latest) return Promise.resolve(latest)
        return new Promise<MockWebSocket>((r) => {
          resolve = r
        })
      })
    },
    { auto: true }
  ]
})
