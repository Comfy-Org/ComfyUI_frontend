import { describe, expect, it, vi } from 'vitest'

import type { EventTargetSocket, ReconnectingHost } from './agentEventSource'
import {
  createReconnectingEventSource,
  createWebSocketEventSource
} from './agentEventSource'

type Listener = (event: { data: unknown }) => void

function fakeSocket(readyState?: number) {
  const listeners = new Map<string, Set<Listener | (() => void)>>()
  const socket: EventTargetSocket = {
    readyState,
    addEventListener(type: string, listener: Listener | (() => void)) {
      const set = listeners.get(type) ?? new Set()
      set.add(listener)
      listeners.set(type, set)
    },
    removeEventListener(type: string, listener: Listener | (() => void)) {
      listeners.get(type)?.delete(listener)
    }
  } as EventTargetSocket
  const emit = (type: string, event?: { data: unknown }): void => {
    for (const listener of listeners.get(type) ?? []) {
      ;(listener as Listener)(event as { data: unknown })
    }
  }
  const count = (type: string): number => listeners.get(type)?.size ?? 0
  return { socket, emit, count }
}

describe('createWebSocketEventSource', () => {
  it('delivers message data to subscribers and stops after unsubscribe', () => {
    const { socket, emit, count } = fakeSocket()
    const source = createWebSocketEventSource(socket)
    const seen = vi.fn()

    const unsubscribe = source.subscribe(seen)
    emit('message', { data: '{"type":"draft_version"}' })
    expect(seen).toHaveBeenCalledWith('{"type":"draft_version"}')

    unsubscribe()
    emit('message', { data: 'late' })
    expect(seen).toHaveBeenCalledTimes(1)
    expect(count('message')).toBe(0)
  })

  it('maps open/close to status true/false and detaches on unsubscribe', () => {
    const { socket, emit, count } = fakeSocket()
    const source = createWebSocketEventSource(socket)
    const status = vi.fn()

    const unsubscribe = source.onStatus?.(status)
    emit('open')
    emit('close')
    expect(status.mock.calls).toEqual([[true], [false]])

    unsubscribe?.()
    emit('open')
    expect(status).toHaveBeenCalledTimes(2)
    expect(count('open')).toBe(0)
    expect(count('close')).toBe(0)
  })

  it('reports live immediately for a socket that is already open', () => {
    const { socket } = fakeSocket(1)
    const source = createWebSocketEventSource(socket)
    const status = vi.fn()

    source.onStatus?.(status)

    expect(status).toHaveBeenCalledWith(true)
  })

  it('does not report live for a connecting socket', () => {
    const { socket } = fakeSocket(0)
    const source = createWebSocketEventSource(socket)
    const status = vi.fn()

    source.onStatus?.(status)

    expect(status).not.toHaveBeenCalled()
  })
})

// A minimal EventTarget host with a swappable current socket, matching how the api nulls
// and replaces this.socket across reconnects and fires 'reconnected' afterward.
function fakeHost(initial: ReturnType<typeof fakeSocket> | null) {
  const reconnectListeners = new Set<() => void>()
  const host: ReconnectingHost = {
    socket: (initial?.socket ?? null) as EventTargetSocket | null,
    addEventListener(_type: 'reconnected', listener: () => void) {
      reconnectListeners.add(listener)
    },
    removeEventListener(_type: 'reconnected', listener: () => void) {
      reconnectListeners.delete(listener)
    }
  }
  // Swap in a new socket and announce the reconnect, exactly as the api does.
  const reconnect = (next: ReturnType<typeof fakeSocket>): void => {
    host.socket = next.socket
    for (const listener of reconnectListeners) listener()
  }
  const reconnectCount = (): number => reconnectListeners.size
  return { host, reconnect, reconnectCount }
}

describe('createReconnectingEventSource', () => {
  it('delivers messages from the initial socket', () => {
    const initial = fakeSocket()
    const { host } = fakeHost(initial)
    const seen = vi.fn()

    createReconnectingEventSource(host).subscribe(seen)
    initial.emit('message', { data: 'a' })

    expect(seen).toHaveBeenCalledWith('a')
  })

  it('re-attaches to a new socket on reconnect and drops the old one', () => {
    const initial = fakeSocket()
    const { host, reconnect } = fakeHost(initial)
    const seen = vi.fn()

    createReconnectingEventSource(host).subscribe(seen)
    const next = fakeSocket()
    reconnect(next)

    initial.emit('message', { data: 'old' })
    next.emit('message', { data: 'new' })

    expect(seen).toHaveBeenCalledTimes(1)
    expect(seen).toHaveBeenCalledWith('new')
    expect(initial.count('message')).toBe(0)
  })

  it('warns once for a null socket and flows after the first reconnect', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { host, reconnect } = fakeHost(null)
    const seen = vi.fn()

    createReconnectingEventSource(host).subscribe(seen)
    expect(warn).toHaveBeenCalledTimes(1)

    const live = fakeSocket()
    reconnect(live)
    live.emit('message', { data: 'x' })

    expect(seen).toHaveBeenCalledWith('x')
    warn.mockRestore()
  })

  it('detaches on unsubscribe, including across a later reconnect', () => {
    const initial = fakeSocket()
    const { host, reconnect, reconnectCount } = fakeHost(initial)
    const seen = vi.fn()

    const unsubscribe = createReconnectingEventSource(host).subscribe(seen)
    unsubscribe()

    initial.emit('message', { data: 'a' })
    expect(seen).not.toHaveBeenCalled()
    expect(reconnectCount()).toBe(0)

    const next = fakeSocket()
    reconnect(next)
    next.emit('message', { data: 'b' })
    expect(seen).not.toHaveBeenCalled()
  })

  it('reports live on the new socket open after a reconnect', () => {
    const initial = fakeSocket()
    const { host, reconnect } = fakeHost(initial)
    const status = vi.fn()

    createReconnectingEventSource(host).onStatus?.(status)
    const next = fakeSocket()
    reconnect(next)
    next.emit('open')

    expect(status).toHaveBeenCalledWith(true)
  })
})
