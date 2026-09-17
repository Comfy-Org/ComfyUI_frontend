import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'
import type { WebSocketRoute } from '@playwright/test'

function createWebSocketRouteHandler(
  connectWebSocketToServer: boolean,
  onRouted: (ws: WebSocketRoute) => void,
  messages: (string | Buffer)[]
) {
  return (ws: WebSocketRoute) => {
    if (connectWebSocketToServer) {
      const server = ws.connectToServer()
      server.onMessage((message) => {
        ws.send(message)
      })
      ws.onMessage((message) => {
        messages.push(message)
        server.send(message)
      })
    } else {
      ws.onMessage((message) => messages.push(message))
    }

    onRouted(ws)
  }
}

type WebSocketFixtures = {
  connectWebSocketToServer: boolean
  getWebSocket: () => Promise<WebSocketRoute>
  getWebSocketMessages: () => readonly (string | Buffer)[]
  webSocketMessages: (string | Buffer)[]
}

export const webSocketFixture = base.extend<WebSocketFixtures>({
  connectWebSocketToServer: [true, { option: true }],
  // oxlint-disable-next-line no-empty-pattern -- Playwright fixtures require destructuring.
  webSocketMessages: async ({}, use) => {
    await use([])
  },
  getWebSocket: [
    async ({ context, connectWebSocketToServer, webSocketMessages }, use) => {
      let latest: WebSocketRoute | undefined
      let resolve: ((ws: WebSocketRoute) => void) | undefined

      await context.routeWebSocket(
        /\/ws/,
        createWebSocketRouteHandler(
          connectWebSocketToServer,
          (ws) => {
            latest = ws
            resolve?.(ws)
          },
          webSocketMessages
        )
      )

      await use(() => {
        if (latest) return Promise.resolve(latest)
        return new Promise<WebSocketRoute>((r) => {
          resolve = r
        })
      })
    },
    { auto: true }
  ],
  getWebSocketMessages: [
    async ({ webSocketMessages }, use) => {
      await use(() => webSocketMessages)
    },
    { auto: true }
  ]
})
