import type { BrowserContext, WebSocketRoute } from '@playwright/test'

import { AGENT_SOCKET_URL } from '@e2e/fixtures/agentSocket'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

/**
 * The connections the page opens on one routed socket URL, in order. A
 * reconnect routes a second time, so a test that drops the socket needs the
 * route the client opened *after* the drop, not the dead one it already holds.
 */
interface WebSocketTracker {
  current: () => WebSocketRoute | undefined
  waitForNext: () => Promise<WebSocketRoute>
}

async function trackWebSocket(
  context: BrowserContext,
  url: RegExp,
  connectToServer: boolean
): Promise<WebSocketTracker> {
  let current: WebSocketRoute | undefined
  const waiters = new Set<(ws: WebSocketRoute) => void>()

  await context.routeWebSocket(url, (ws) => {
    if (connectToServer) {
      const server = ws.connectToServer()
      server.onMessage((message) => {
        ws.send(message)
      })
    }
    current = ws
    const pending = [...waiters]
    waiters.clear()
    for (const resolve of pending) resolve(ws)
  })

  return {
    current: () => current,
    waitForNext: () =>
      new Promise<WebSocketRoute>((resolve) => waiters.add(resolve))
  }
}

function currentOrNext(tracker: WebSocketTracker): Promise<WebSocketRoute> {
  const open = tracker.current()
  return open ? Promise.resolve(open) : tracker.waitForNext()
}

export const webSocketFixture = base.extend<{
  connectWebSocketToServer: boolean
  getWebSocket: () => Promise<WebSocketRoute>
  nextWebSocket: () => Promise<WebSocketRoute>
  webSocketTracker: WebSocketTracker
  getAgentSocket: () => Promise<WebSocketRoute>
  nextAgentSocket: () => Promise<WebSocketRoute>
  agentSocketTracker: WebSocketTracker
}>({
  connectWebSocketToServer: [true, { option: true }],
  /** ComfyUI's `/ws`: execution status, feature flags, logs. */
  webSocketTracker: [
    async ({ context, connectWebSocketToServer }, use) => {
      await use(await trackWebSocket(context, /\/ws/, connectWebSocketToServer))
    },
    { auto: true }
  ],
  /**
   * The agent panel's `/api/agent/events` socket: agent_* events and doc_*
   * frames in both directions. Never connected to a server; the test is the
   * agent.
   */
  agentSocketTracker: [
    async ({ context }, use) => {
      await use(await trackWebSocket(context, AGENT_SOCKET_URL, false))
    },
    { auto: true }
  ],
  getWebSocket: async ({ webSocketTracker }, use) => {
    await use(() => currentOrNext(webSocketTracker))
  },
  /**
   * Resolves with the NEXT socket the page opens. Call it before closing the
   * current one so the waiter is armed before the client reconnects.
   */
  nextWebSocket: async ({ webSocketTracker }, use) => {
    await use(() => webSocketTracker.waitForNext())
  },
  /** The agent socket the panel has open, or the first one it opens. */
  getAgentSocket: async ({ agentSocketTracker }, use) => {
    await use(() => currentOrNext(agentSocketTracker))
  },
  /** Like `nextWebSocket`, for the agent socket's reconnect. */
  nextAgentSocket: async ({ agentSocketTracker }, use) => {
    await use(() => agentSocketTracker.waitForNext())
  }
})
