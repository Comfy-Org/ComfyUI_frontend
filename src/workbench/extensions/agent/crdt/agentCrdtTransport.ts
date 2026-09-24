import { isCrdtDebugEnabled } from './crdtDebugGate'
import { wireLog } from './crdtLog'
import type { DocFrameTransport } from './docFrameClient'

/**
 * Both of `wireLog.trace`'s sinks drop the detail unless the debug instrument
 * is on, so an ungated parse costs every user edit a full `JSON.parse` of the
 * `doc_ops` batch `DocFrameClient.send` just serialised, on the main thread,
 * for a value nothing reads.
 */
function traceableFrame(frame: string): Record<string, unknown> | null {
  if (!isCrdtDebugEnabled()) return null
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

/**
 * Wraps `base` with the dev-panel tap (poc-4): every outbound frame is logged
 * with its delivery result.
 */
export function createLoggedTransport(
  base: DocFrameTransport
): DocFrameTransport {
  return {
    send(frame) {
      const delivered = base.send(frame)
      const parsed = traceableFrame(frame)
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
