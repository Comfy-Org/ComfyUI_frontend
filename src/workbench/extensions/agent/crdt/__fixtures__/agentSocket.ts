import { vi } from 'vitest'

import type { AgentEventSocket } from '@/workbench/extensions/agent/services/agent/agentEventSource'
import { createAgentDocFrameTransport } from '@/workbench/extensions/agent/crdt/agentDocFrameTransport'

export function createFakeAgentSocket() {
  const listeners = new Set<(raw: unknown) => void>()
  const statusListeners = new Set<(live: boolean) => void>()
  const send = vi.fn<(frame: string) => boolean>(() => true)
  const reconnect = vi.fn()
  let live = false

  function setLive(next: boolean): void {
    live = next
    statusListeners.forEach((listener) => listener(next))
  }

  const socket: AgentEventSocket = {
    reconnect,
    send: (frame) => send(frame),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    onStatus(listener) {
      statusListeners.add(listener)
      listener(live)
      return () => statusListeners.delete(listener)
    }
  }
  return {
    socket,
    send,
    reconnect,
    transport: createAgentDocFrameTransport(socket),
    open(): void {
      setLive(true)
    },
    drop(): void {
      setLive(false)
    },
    receive(type: string, data: unknown): void {
      listeners.forEach((listener) => listener({ type, data }))
    },
    listenerCount: () => listeners.size
  }
}
