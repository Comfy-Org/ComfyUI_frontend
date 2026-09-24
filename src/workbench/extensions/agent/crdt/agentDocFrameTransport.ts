/**
 * The `DocFrameTransport` every follower uses: document frames ride the
 * agent's one socket (`/api/agent/events`, see agentEventSource), which speaks
 * the document protocol on both backends — doc_subscribe / doc_unsubscribe /
 * doc_ops / awareness up; doc_subscribed / doc_update / doc_ops_result /
 * doc_reset / awareness down. Outbound frames are forwarded verbatim; inbound
 * document frames surface as events.
 *
 * ONE socket, on purpose. An earlier cut opened a second socket per followed
 * workflow because the agent fixed a connection's follows at connect time;
 * reconnecting to follow tore the chat stream down mid-turn and lost every
 * progress frame published while it re-established. With follows as frames,
 * nothing reconnects.
 */
import type { AgentEventSocket } from '../services/agent/agentEventSource'
import type { DocFrameTransport } from './docFrameClient'

/** Frames the agent sends followers. Anything else on the socket is chat. */
const INBOUND_DOC_FRAMES = new Set([
  'doc_update',
  'doc_subscribed',
  'doc_ops_result',
  'doc_reset',
  'awareness'
])

interface AgentFrame {
  type?: unknown
  data?: unknown
}

export interface AgentDocFrameTransport extends DocFrameTransport {
  onConnected(listener: () => void): () => void
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
      if (typeof raw !== 'object' || raw === null) return
      const frame = raw as AgentFrame
      if (typeof frame.type !== 'string') return
      if (!INBOUND_DOC_FRAMES.has(frame.type)) return
      target.dispatchEvent(new CustomEvent(frame.type, { detail: frame.data }))
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
    /**
     * Fires each time the shared socket opens. The chat stream's `onStatus`
     * reports every open and close; only the opens matter here, because
     * that is the moment a subscribe dropped while connecting can go out.
     */
    onConnected(listener) {
      return (
        source.onStatus?.((live) => {
          if (live) listener()
        }) ?? (() => {})
      )
    },
    destroy() {
      unsubscribe?.()
      unsubscribe = null
    }
  }
}
