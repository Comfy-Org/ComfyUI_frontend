import type { AgentEventSocket } from '@/workbench/extensions/agent/services/agent/agentEventSource'
import { SERVER_DOC_FRAME_TYPES } from './docFrameCodes'
import type { DocFrameTransport } from './docFrameClient'

const INBOUND_DOC_FRAMES = new Set<string>(SERVER_DOC_FRAME_TYPES)

export interface AgentDocFrameTransport extends DocFrameTransport {
  onSocketOpen(listener: () => void): () => void
  onSocketStatus(listener: (live: boolean) => void): () => void
  /** Reopen the shared socket, which reads a fresh credential on connect. */
  reconnect(): void
  destroy(): void
}

export function createAgentDocFrameTransport(
  source: AgentEventSocket
): AgentDocFrameTransport {
  const target = new EventTarget()
  let unsubscribe: (() => void) | null = null
  let destroyed = false

  function tap(): void {
    if (destroyed || unsubscribe !== null) return
    unsubscribe = source.subscribe((raw) => {
      if (typeof raw !== 'object' || raw === null || !('type' in raw)) return
      const { type } = raw
      if (typeof type !== 'string' || !INBOUND_DOC_FRAMES.has(type)) return
      const detail = 'data' in raw ? raw.data : undefined
      target.dispatchEvent(new CustomEvent(type, { detail }))
    })
  }

  return {
    send(frame) {
      return source.send(frame)
    },
    addEventListener(type, listener) {
      // Without the latch a listener added after destroy() re-tapped the socket,
      // because tap() only checked whether a subscription was currently open. The
      // panel destroys this on unmount, so any async callback landing after that
      // resurrected the transport and held the subscription open for good.
      if (destroyed) return
      tap()
      target.addEventListener(type, listener)
    },
    removeEventListener(type, listener) {
      target.removeEventListener(type, listener)
    },
    onSocketOpen(listener) {
      return source.onStatus((live) => {
        if (live) listener()
      })
    },
    onSocketStatus(listener) {
      return source.onStatus(listener)
    },
    reconnect() {
      source.reconnect()
    },
    destroy() {
      destroyed = true
      unsubscribe?.()
      unsubscribe = null
    }
  }
}
