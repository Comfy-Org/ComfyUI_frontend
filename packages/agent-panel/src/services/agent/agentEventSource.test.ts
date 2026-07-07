import { describe, expect, it, vi } from 'vitest'

import type { EventTargetSocket } from './agentEventSource'
import { createWebSocketEventSource } from './agentEventSource'

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
