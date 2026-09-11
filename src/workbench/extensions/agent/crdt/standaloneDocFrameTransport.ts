/**
 * A `DocFrameTransport` for the LOCAL (standalone) agent.
 *
 * The cloud transport (`apiTransport` in useAgentCrdtFollower) rides ComfyUI's
 * one same-origin socket, because ingest multiplexes the agent's document
 * frames onto it. Standalone has no ingest — but the agent's own socket now
 * speaks the identical document protocol (doc_subscribe / doc_unsubscribe /
 * doc_ops inbound; doc_subscribed / doc_update / doc_ops_result / doc_reset
 * outbound), so this transport is the same idea with the socket swapped: ride
 * the chat stream's socket, forward outbound frames verbatim, surface inbound
 * document frames as events.
 *
 * ONE socket, on purpose. An earlier cut opened a second socket per followed
 * workflow because the agent fixed a connection's follows at connect time;
 * reconnecting to follow tore the chat stream down mid-turn and lost every
 * progress frame published while it re-established. With follows as frames,
 * nothing reconnects.
 */
import type { StandaloneAgentEventSource } from '../services/agent/standaloneAgentEventSource'
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

export interface StandaloneDocFrameTransport extends DocFrameTransport {
  destroy(): void
}

export function createStandaloneDocFrameTransport(
  source: StandaloneAgentEventSource
): StandaloneDocFrameTransport {
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
    destroy() {
      unsubscribe?.()
      unsubscribe = null
    }
  }
}
