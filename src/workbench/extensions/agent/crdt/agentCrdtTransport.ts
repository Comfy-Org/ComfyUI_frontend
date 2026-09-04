import { api } from '@/scripts/api'

import { wireLog } from './crdtLog'
import type { DocFrameTransport } from './docFrameClient'

export const apiTransport: DocFrameTransport = {
  send(frame) {
    // Never throws: a closed socket is a recoverable state, not an error. See
    // DocFrameTransport.send - throwing here aborted both the immediate
    // subscribe watcher and the unmount hook.
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

/**
 * Dev-panel tap (poc-4): logs every outbound frame with its delivery result.
 * Wraps `apiTransport` instead of modifying it, so the exported transport's
 * never-throw contract stays exactly what `apiTransport.test.ts` covers.
 */
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
