import { test as base } from '@playwright/test'
import type { WebSocketRoute } from '@playwright/test'

export const webSocketFixture = base.extend<{
  connectWebSocketToServer: boolean
  getWebSocket: () => Promise<WebSocketRoute>
  webSocketMessages: string[]
}>({
  connectWebSocketToServer: [true, { option: true }],
  webSocketMessages: async ({}, use) => {
    await use([])
  },
  getWebSocket: [
    async ({ context, connectWebSocketToServer, webSocketMessages }, use) => {
      let latest: WebSocketRoute | undefined
      let resolve: ((ws: WebSocketRoute) => void) | undefined

      await context.routeWebSocket(/\/ws/, (ws) => {
        const server = connectWebSocketToServer
          ? ws.connectToServer()
          : undefined

        ws.onMessage((message) => {
          if (typeof message === 'string') webSocketMessages.push(message)
          server?.send(message)
        })
        if (server) {
          server.onMessage((message) => {
            ws.send(message)
          })
        }

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
