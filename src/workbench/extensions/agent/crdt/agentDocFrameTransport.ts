import type { AgentEventSocket } from '@/workbench/extensions/agent/services/agent/agentEventSource'
import { reportError } from '@/platform/telemetry/reportError'
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
    sendDocFrame(frame) {
      let serialized: string
      try {
        serialized = JSON.stringify(frame)
      } catch {
        reportError(new Error('Failed to serialize agent document frame'), {
          surface: 'agent',
          errorType: 'failure_sending_agent_doc_frame'
        })
        return false
      }
      return source.send(serialized)
    },
    registerFrameHandler(type, handler) {
      tap()
      const listener = (event: Event) => {
        if (event instanceof CustomEvent) handler(event.detail)
      }
      target.addEventListener(type, listener)
      return () => target.removeEventListener(type, listener)
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
