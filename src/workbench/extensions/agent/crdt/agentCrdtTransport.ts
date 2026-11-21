import { wireLog } from './crdtLog'
import type { DocFrameTransport } from './docFrameClient'

function traceableFrame(frame: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(frame)
    return parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

export function createLoggedTransport(
  base: DocFrameTransport,
  diagnosticsEnabled: () => boolean
): DocFrameTransport {
  return {
    send(frame) {
      const delivered = base.send(frame)
      const parsed = diagnosticsEnabled() ? traceableFrame(frame) : null
      wireLog.trace('ws_out', 'outbound frame', {
        delivered,
        frame: parsed,
        ...(parsed === null ? { unparsed_chars: frame.length } : {})
      })
      return delivered
    },
    addEventListener(type, listener) {
      base.addEventListener(type, listener)
    },
    removeEventListener(type, listener) {
      base.removeEventListener(type, listener)
    }
  }
}
