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

  receiveRaw(data: string): void {
    this.dispatchEvent(new MessageEvent('message', { data }))
  }

  error(): void {
    this.dispatchEvent(new Event('error'))
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

  it('forwards an empty text frame instead of dropping it', () => {
    const { source, sockets } = sourceHarness()
    const seen = vi.fn()

    source.subscribe(seen)
    sockets[0].open()
    sockets[0].receiveRaw('')

    expect(seen).toHaveBeenCalledWith('')
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

  it('reconnects exactly once when the upgrade fails before open', () => {
    vi.useFakeTimers()
    const { source, sockets } = sourceHarness()
    const status = vi.fn()

    source.subscribe(vi.fn())
    source.onStatus?.(status)
    sockets[0].error()
    vi.advanceTimersByTime(999)

    expect(sockets[0].readyState).toBe(WebSocket.CLOSED)
    expect(status).toHaveBeenCalledTimes(1)
    expect(status).toHaveBeenLastCalledWith(false)
    expect(sockets).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(sockets).toHaveLength(2)

    vi.advanceTimersByTime(5000)
    expect(sockets).toHaveLength(2)
  })

  it('reports live again once the replacement socket opens', () => {
    vi.useFakeTimers()
    const { source, sockets } = sourceHarness()
    const status = vi.fn()

    source.subscribe(vi.fn())
    source.onStatus?.(status)
    sockets[0].open()
    sockets[0].close()
    vi.advanceTimersByTime(1000)
    sockets[1].open()

    expect(status.mock.calls.map(([live]) => live)).toEqual([true, false, true])
  })

  it('drops frames from a superseded socket after resubscribing', () => {
    vi.useFakeTimers()
    const { source, sockets } = sourceHarness()
    const first = vi.fn()
    const second = vi.fn()

    const unsubscribe = source.subscribe(first)
    sockets[0].open()
    unsubscribe()
    source.subscribe(second)
    sockets[1].open()
    sockets[0].receive({ type: 'agent_message_delta', data: { delta: 'old' } })
    sockets[1].receive({ type: 'agent_message_delta', data: { delta: 'new' } })

    expect(sockets).toHaveLength(2)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledWith({
      type: 'agent_message_delta',
      data: { delta: 'new' }
    })
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

  it('reports disconnected to status-only listeners on unsubscribe', () => {
    const { source, sockets } = sourceHarness()
    const status = vi.fn()
    const unsubscribe = source.subscribe(vi.fn())
    source.onStatus?.(status)
    sockets[0].open()

    unsubscribe()

    expect(status.mock.calls.map(([live]) => live)).toEqual([true, false])
  })
})
