import { api } from '@/scripts/api'

import { wireLog } from './crdtLog'
import type { DocFrameTransport } from './docFrameClient'

export const apiTransport: DocFrameTransport = {
  send(frame) {
    if (api.socket?.readyState !== WebSocket.OPEN) return false
    api.socket.send(frame)
    return true
  },
  addEventListener(type, listener) {
    api.addCustomEventListener(type, listener)
  },
  removeEventListener(type, listener) {
    api.removeCustomEventListener(type, listener)
  }
}

/** Adds wire diagnostics without changing the transport's delivery contract. */
export function createLoggedTransport(): DocFrameTransport {
  return {
    send(frame) {
      const delivered = apiTransport.send(frame)
      let parsed: unknown = frame
      try {
        parsed = JSON.parse(frame)
      } catch {
        // Leave the raw string.
      }
      wireLog.trace('ws_out', 'outbound frame', { delivered, frame: parsed })
      return delivered
    },
    addEventListener(type, listener) {
      apiTransport.addEventListener(type, listener)
    },
    removeEventListener(type, listener) {
      apiTransport.removeEventListener(type, listener)
    }
  }
}
