import type { AgentEventSocket } from '@/workbench/extensions/agent/services/agent/agentEventSource'
import { SERVER_DOC_FRAME_TYPES } from './docFrameCodes'
import type { DocFrameTransport } from './docFrameClient'

const INBOUND_DOC_FRAMES = new Set<string>(SERVER_DOC_FRAME_TYPES)

export interface AgentDocFrameTransport extends DocFrameTransport {
  onSocketOpen(listener: () => void): () => void
  onSocketStatus(listener: (live: boolean) => void): () => void
  destroy(): void
}

export function createAgentDocFrameTransport(
  source: AgentEventSocket
): AgentDocFrameTransport {
  const target = new EventTarget()
  let unsubscribe: (() => void) | null = null

  function tap(): void {
    if (unsubscribe !== null) return
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
    destroy() {
      unsubscribe?.()
      unsubscribe = null
    }
  }
}
