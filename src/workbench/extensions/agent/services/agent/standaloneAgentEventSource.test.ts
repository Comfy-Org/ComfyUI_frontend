import { describe, expect, it, vi } from 'vitest'

import { createStandaloneAgentEventSource } from './standaloneAgentEventSource'

class FakeSocket extends EventTarget {
  readyState: number = WebSocket.CONNECTING
  readonly url: string

  constructor(url: string) {
    super()
    this.url = url
  }

  open(): void {
    this.readyState = WebSocket.OPEN
    this.dispatchEvent(new Event('open'))
  }

  receive(frame: unknown): void {
    this.dispatchEvent(
      new MessageEvent('message', { data: JSON.stringify(frame) })
    )
  }

  close(): void {
    if (this.readyState === WebSocket.CLOSED) return
    this.readyState = WebSocket.CLOSED
    this.dispatchEvent(new Event('close'))
  }
}

function sourceHarness() {
  const sockets: FakeSocket[] = []
  const source = createStandaloneAgentEventSource({
    createSocket(url) {
      const socket = new FakeSocket(url)
      sockets.push(socket)
      return socket as unknown as WebSocket
    }
  })
  return { source, sockets }
}

describe('createStandaloneAgentEventSource', () => {
  it('connects through the same-origin agent proxy and delivers JSON frames', () => {
    const { source, sockets } = sourceHarness()
    const seen = vi.fn()
    const status = vi.fn()

    source.subscribe(seen)
    source.onStatus?.(status)
    sockets[0].open()
    sockets[0].receive({ type: 'agent_message_delta', data: { delta: 'hi' } })

    expect(new URL(sockets[0].url).pathname).toBe('/api/agent/events')
    expect(status).toHaveBeenCalledWith(true)
    expect(seen).toHaveBeenCalledWith({
      type: 'agent_message_delta',
      data: { delta: 'hi' }
    })
  })

  it('reconnects after a backend reload', () => {
    vi.useFakeTimers()
    const { source, sockets } = sourceHarness()
    const status = vi.fn()

    source.subscribe(vi.fn())
    source.onStatus?.(status)
    sockets[0].open()
    sockets[0].close()
    vi.advanceTimersByTime(1000)

    expect(status).toHaveBeenLastCalledWith(false)
    expect(sockets).toHaveLength(2)
  })

  it('stops the socket and pending reconnect on unsubscribe', () => {
    vi.useFakeTimers()
    const { source, sockets } = sourceHarness()

    const unsubscribe = source.subscribe(vi.fn())
    sockets[0].open()
    sockets[0].close()
    unsubscribe()
    vi.advanceTimersByTime(1000)

    expect(sockets).toHaveLength(1)
  })
})
