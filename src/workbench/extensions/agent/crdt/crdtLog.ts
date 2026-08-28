/**
 * One call site, two sinks: the console (for whoever has devtools open) and
 * the panel's ring buffer (for whoever is copying a report).
 *
 * Before this module the two were wired independently — a handful of
 * `recordDevEvent` calls that never printed, and a handful of bare
 * `console.warn`s the panel never saw — so the console and the copied report
 * disagreed about what happened. Every CRDT-internal event now goes through
 * {@link crdtLog}, which is what makes the report a transcript.
 */
import type { CrdtLogLevel } from './crdtDebugGate'
import { isLevelEnabled } from './crdtDebugGate'
import type { CrdtLogScope, DevEventKind } from './devPanelLog'
import { recordDevEvent } from './devPanelLog'

/**
 * Console tint per scope, so a busy log reads as layers rather than as one
 * undifferentiated stream.
 */
const SCOPE_STYLE: Record<CrdtLogScope, string> = {
  wire: 'color:#7dd3fc',
  doc: 'color:#a5b4fc',
  ecs: 'color:#86efac',
  ops: 'color:#fcd34d',
  panel: 'color:#d8b4fe'
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
 * The ring buffer records unconditionally: a tester who only turns the panel
 * on AFTER something went wrong still needs the run-up in the copied report,
 * and 500 capped entries cost nothing. Only the console print is gated.
 */
function crdtLog(entry: CrdtLogEntry): void {
  const { scope, level, kind, message, detail } = entry
  recordDevEvent(kind, detail ?? null, { scope, level })

  if (!isLevelEnabled(level)) return
  const line = `%c[crdt:${scope}]%c ${kind} — ${message}`
  const args: unknown[] = [line, SCOPE_STYLE[scope], '']
  if (detail !== undefined) args.push(detail)
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
export const docLog = scopedCrdtLog('doc')
export const ecsLog = scopedCrdtLog('ecs')
export const opsLog = scopedCrdtLog('ops')
