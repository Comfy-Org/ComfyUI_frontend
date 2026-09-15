import { api } from '@/scripts/api'

import { isCrdtDebugEnabled } from './crdtDebugGate'
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

/**
 * Both of `wireLog.trace`'s sinks drop the detail unless the debug instrument
 * is on, so an ungated parse costs every user edit a full `JSON.parse` of the
 * `doc_ops` batch `DocFrameClient.send` just serialised, on the main thread,
 * for a value nothing reads.
 */
function traceableFrame(frame: string): unknown {
  if (!isCrdtDebugEnabled()) return frame
  try {
    return JSON.parse(frame)
  } catch {
    return frame
  }
}

export function createLoggedTransport(): DocFrameTransport {
  return {
    send(frame) {
      const delivered = apiTransport.send(frame)
      wireLog.trace('ws_out', 'outbound frame', {
        delivered,
        frame: traceableFrame(frame)
      })
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
