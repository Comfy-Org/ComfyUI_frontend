import { test as base } from '@playwright/test'
import type { WebSocketRoute } from '@playwright/test'

export const webSocketFixture = base.extend<{
  getWebSocket: () => Promise<WebSocketRoute>
}>({
  getWebSocket: [
    async ({ context }, use) => {
      let latest: WebSocketRoute | undefined
      let resolve: ((ws: WebSocketRoute) => void) | undefined

      await context.routeWebSocket(/\/ws/, (ws) => {
        const server = ws.connectToServer()
        server.onMessage((message) => {
          ws.send(message)
        })

        latest = ws
        resolve?.(ws)
      })

      await use(() => {
        if (latest) return Promise.resolve(latest)
        return new Promise<WebSocketRoute>((r) => {
          resolve = r
        })
      })
    },
    { auto: true }
  ]
})
