import { describe, expect, it, vi } from 'vitest'

import { AGENT_WS_EVENT_TYPES } from '../../schemas/agentApiSchema'

import type { AgentEventHost } from './agentEventSource'
import { createAgentEventSource } from './agentEventSource'

function fakeHost(readyState?: number) {
  const target = new EventTarget()
  const registered = new Set<string>()
  const host: AgentEventHost = {
    socket: readyState === undefined ? null : { readyState },
    addCustomEventListener(type, listener) {
      registered.add(type)
      target.addEventListener(type, listener as EventListener)
    },
    removeCustomEventListener(type, listener) {
      registered.delete(type)
      target.removeEventListener(type, listener as EventListener)
    },
    addEventListener(type, listener) {
      target.addEventListener(type, listener)
    },
    removeEventListener(type, listener) {
      target.removeEventListener(type, listener)
    }
  }
  const emit = (type: string, data?: unknown): void => {
    target.dispatchEvent(new CustomEvent(type, { detail: data }))
  }
  return { host, emit, registered }
}

describe('createAgentEventSource', () => {
  it('registers every agent event type and delivers frames as {type, data}', () => {
    const { host, emit, registered } = fakeHost()
    const seen = vi.fn()

    createAgentEventSource(host).subscribe(seen)

    expect(registered).toEqual(new Set(AGENT_WS_EVENT_TYPES))

    emit('agent_message_delta', { delta: 'hi' })
    expect(seen).toHaveBeenCalledWith({
      type: 'agent_message_delta',
      data: { delta: 'hi' }
    })
  })

  it('stops delivering after unsubscribe', () => {
    const { host, emit, registered } = fakeHost()
    const seen = vi.fn()

    const unsubscribe = createAgentEventSource(host).subscribe(seen)
    unsubscribe()

    emit('agent_message_delta', { delta: 'late' })
    expect(seen).not.toHaveBeenCalled()
    expect(registered.size).toBe(0)
  })

  it('emits false only for reconnecting and true for reconnected', () => {
    const { host, emit } = fakeHost()
    const status = vi.fn()

    createAgentEventSource(host).onStatus?.(status)
    expect(status).not.toHaveBeenCalled()

    emit('reconnecting')
    expect(status).toHaveBeenLastCalledWith(false)

    emit('reconnected')
    expect(status).toHaveBeenLastCalledWith(true)
  })

  it('characterizes R-107: reports only true for an open socket', () => {
    const { host } = fakeHost(WebSocket.OPEN)
    const status = vi.fn()

    createAgentEventSource(host).onStatus?.(status)

    expect(status).toHaveBeenCalledTimes(1)
    expect(status).toHaveBeenCalledWith(true)
    expect(status).not.toHaveBeenCalledWith(false)
  })

  // R-107: subscription stays silent until socket liveness is positively known.
  it.for([undefined, WebSocket.CONNECTING])(
    'does not report an initial status for socket state %s',
    (readyState) => {
      const { host } = fakeHost(readyState)
      const status = vi.fn()

      createAgentEventSource(host).onStatus?.(status)

      expect(status).not.toHaveBeenCalled()
    }
  )

  it('stops reporting status after unsubscribe', () => {
    const { host, emit } = fakeHost()
    const status = vi.fn()

    const unsubscribe = createAgentEventSource(host).onStatus?.(status)
    unsubscribe?.()
    emit('reconnected')

    expect(status).not.toHaveBeenCalled()
  })
})
