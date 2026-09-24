import { vi } from 'vitest'

import type { AgentEventSocket } from '../../services/agent/agentEventSource'
import { createAgentDocFrameTransport } from '../agentDocFrameTransport'

/**
 * The agent's one socket, faked at its seam, with the production document
 * transport riding it — so a follower under test sends and receives frames
 * exactly the way it does against `/api/agent/events`.
 */
export function createFakeAgentSocket() {
  const listeners = new Set<(raw: unknown) => void>()
  const statusListeners = new Set<(live: boolean) => void>()
  const send = vi.fn<(frame: string) => boolean>(() => true)
  const socket: AgentEventSocket = {
    send: (frame) => send(frame),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    onStatus(listener) {
      statusListeners.add(listener)
      return () => statusListeners.delete(listener)
    }
  }
  return {
    send,
    transport: createAgentDocFrameTransport(socket),
    /** The socket's open edge — a first connect or a reconnect. */
    open(): void {
      statusListeners.forEach((listener) => listener(true))
    },
    /** An inbound frame from the agent. */
    receive(type: string, data: unknown): void {
      listeners.forEach((listener) => listener({ type, data }))
    }
  }
}
