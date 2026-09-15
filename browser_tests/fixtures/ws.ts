import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'
import type { WebSocketRoute } from '@playwright/test'

import type { ClientDocFrame } from '@/workbench/extensions/agent/crdt/docFrameClient'

type SubscriptionFrame = Extract<
  ClientDocFrame,
  { type: 'doc_subscribe' | 'doc_unsubscribe' }
>

export function countDocFrames(
  messagesBySocket: Map<WebSocketRoute, string[]>,
  ws: WebSocketRoute,
  type: SubscriptionFrame['type'],
  workflowId: string
): number {
  return (messagesBySocket.get(ws) ?? []).filter((message) => {
    const frame = JSON.parse(message) as ClientDocFrame
    return frame.type === type && frame.data.workflow_id === workflowId
  }).length
}

function createWebSocketRouteHandler(
  connectWebSocketToServer: boolean,
  onRouted: (ws: WebSocketRoute, server: WebSocketRoute | null) => void
) {
  return (ws: WebSocketRoute) => {
    if (!connectWebSocketToServer) {
      onRouted(ws, null)
      return
    }

    const server = ws.connectToServer()
    server.onMessage((message) => {
      ws.send(message)
    })
    onRouted(ws, server)
  }
}

export const webSocketFixture = base.extend<{
  connectWebSocketToServer: boolean
  getWebSocket: (after?: WebSocketRoute) => Promise<WebSocketRoute>
  webSocketMessages: Map<WebSocketRoute, string[]>
}>({
  connectWebSocketToServer: [true, { option: true }],
  // oxlint-disable-next-line no-empty-pattern -- Playwright requires an object pattern.
  webSocketMessages: async ({}, use) => {
    await use(new Map())
  },
  getWebSocket: [
    async ({ context, connectWebSocketToServer, webSocketMessages }, use) => {
      let latest: WebSocketRoute | undefined
      let resolve: ((ws: WebSocketRoute) => void) | undefined

      await context.routeWebSocket(
        /\/ws/,
        createWebSocketRouteHandler(connectWebSocketToServer, (ws, server) => {
          const messages: string[] = []
          webSocketMessages.set(ws, messages)
          // Registering a page-side handler switches off Playwright's automatic
          // page-to-server forwarding, so recording has to re-send the frame
          // itself. Without this every spec merging the fixture drops the
          // `feature_flags` handshake and leaves `api.serverFeatureFlags` empty.
          ws.onMessage((message) => {
            if (typeof message === 'string') messages.push(message)
            server?.send(message)
          })
          latest = ws
          resolve?.(ws)
        })
      )

      await use((after) => {
        if (latest && latest !== after) return Promise.resolve(latest)
        return new Promise<WebSocketRoute>((r) => {
          resolve = r
        })
      })
    },
    { auto: true }
  ]
})
