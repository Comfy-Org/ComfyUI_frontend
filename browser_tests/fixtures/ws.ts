import { test as base } from '@playwright/test'
import type { WebSocketRoute } from '@playwright/test'

export function createWebSocketRouteHandler(
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
}>({
  connectWebSocketToServer: [true, { option: true }],
  getWebSocket: [
    async ({ context, connectWebSocketToServer }, use) => {
      let latest: WebSocketRoute | undefined
      let resolve: ((ws: WebSocketRoute) => void) | undefined

      await context.routeWebSocket(
        /\/ws/,
        createWebSocketRouteHandler(connectWebSocketToServer, (ws) => {
          latest = ws
          resolve?.(ws)
        })
      )

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
