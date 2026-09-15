/**
 * One call site, two sinks: the console (for whoever has devtools open) and
 * the panel's ring buffer (for whoever is copying a report).
 *
 * Before this module the two were wired independently — a handful of
 * `recordDevEvent` calls that never printed, and a handful of bare
 * `console.warn`s the panel never saw — so the console and the copied report
 * disagreed about what happened. New structured wire events use
 * {@link crdtLog}; existing document events remain in the shared ring buffer.
 */
import type { CrdtLogLevel } from './crdtDebugGate'
import {
  isCrdtDebugEnabled,
  isCrdtDebugOptedOut,
  isLevelEnabled
} from './crdtDebugGate'
import type { CrdtLogScope, DevEventKind } from './devPanelLog'
import { recordDevEvent } from './devPanelLog'

/**
 * Console tint per scope, so a busy log reads as layers rather than as one
 * undifferentiated stream.
 */
const SCOPE_STYLE: Record<CrdtLogScope, string> = {
  wire: 'color:#7dd3fc',
  doc: 'color:#a5b4fc'
}

const CONSOLE_METHOD: Record<CrdtLogLevel, 'warn' | 'info' | 'debug'> = {
  warn: 'warn',
  info: 'info',
  debug: 'debug',
  trace: 'debug'
}

interface CrdtLogEntry {
  scope: CrdtLogScope
  level: CrdtLogLevel
  kind: DevEventKind
  /** Short human sentence; the `detail` carries the structure. */
  message: string
  detail?: unknown
}

/**
 * Emit one CRDT-internal event.
 *
 * The ring buffer records while the debug instrument is enabled even when the
 * selected console level is quiet. Ordinary production sessions retain no
 * frame or actor details; a tester must opt in before reproducing an issue.
 */
function crdtLog(entry: CrdtLogEntry): void {
  const { scope, level, kind, message, detail } = entry
  const optedOut = isCrdtDebugOptedOut()
  if (!optedOut) recordDevEvent(kind, detail ?? null, { scope, level })

  if (optedOut && level !== 'warn') return
  if (!isLevelEnabled(level)) return
  const line = `%c[crdt:${scope}]%c ${kind} — ${message}`
  const args: unknown[] = [line, SCOPE_STYLE[scope], '']
  // `warn` reaches the console even when the instrument is off, so that a
  // fail-closed follower is never silent. The MESSAGE is what earns that
  // exemption — dumping document state into an opted-out user's console does
  // not. The detail is still in the ring buffer for whoever opted in.
  if (detail !== undefined && isCrdtDebugEnabled()) args.push(detail)
  console[CONSOLE_METHOD[level]](...args)
}

/**
 * Bind a scope once so call sites read as `wire.trace('…')` rather than
 * repeating the scope on every event.
 */
function scopedCrdtLog(scope: CrdtLogScope) {
  const at =
    (level: CrdtLogLevel) =>
    (kind: DevEventKind, message: string, detail?: unknown): void =>
      crdtLog({ scope, level, kind, message, detail })

  return {
    warn: at('warn'),
    info: at('info'),
    debug: at('debug'),
    trace: at('trace')
  }
}

export const wireLog = scopedCrdtLog('wire')
