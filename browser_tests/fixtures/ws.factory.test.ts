import { describe, expect, it, vi } from 'vitest'
import type { WebSocketRoute } from '@playwright/test'

import { createWebSocketRouteHandler } from '@e2e/fixtures/ws'

function fakeRoute() {
  const server = { onMessage: vi.fn() }
  return {
    connectToServer: vi.fn(() => server),
    send: vi.fn(),
    server
  }
}

describe('createWebSocketRouteHandler', () => {
  it('never connects the routed socket to the server when opted out', () => {
    const route = fakeRoute()
    const onRouted = vi.fn()

    createWebSocketRouteHandler(
      false,
      onRouted
    )(route as unknown as WebSocketRoute)

    expect(route.connectToServer).not.toHaveBeenCalled()
    expect(onRouted).toHaveBeenCalledExactlyOnceWith(route)
  })

  it('connects and forwards server messages to the page when opted in', () => {
    const route = fakeRoute()
    const onRouted = vi.fn()

    createWebSocketRouteHandler(
      true,
      onRouted
    )(route as unknown as WebSocketRoute)

    expect(route.connectToServer).toHaveBeenCalledOnce()
    const forward = route.server.onMessage.mock.calls[0][0]
    forward('frame-1')
    expect(route.send).toHaveBeenCalledExactlyOnceWith('frame-1')
    expect(onRouted).toHaveBeenCalledExactlyOnceWith(route)
  })
})
