import { shallowRef, triggerRef } from 'vue'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { Settings } from '@/platform/settings/types'

import { sanitizeDevEventDetail } from '@/platform/telemetry/redact'

const { flags } = useFeatureFlags()
export type CrdtLogLevel = Settings['Comfy.Agent.CrdtDebug.Level']
export const CRDT_LOG_LEVELS: readonly CrdtLogLevel[] = [
  'warn',
  'info',
  'debug',
  'trace'
]

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
  message: string
  detail?: unknown
}

function crdtLog(entry: CrdtLogEntry): void {
  if (!flags.agentCrdtDebugEnabled) return
  const { scope, level, kind, message, detail } = entry
  recordDevEvent(kind, detail ?? null, { scope, level })
  const threshold = useSettingStore().get('Comfy.Agent.CrdtDebug.Level')
  if (CRDT_LOG_LEVELS.indexOf(level) > CRDT_LOG_LEVELS.indexOf(threshold))
    return
  const line = `%c[crdt:${scope}]%c ${kind} — ${message}`
  const args: unknown[] = [line, SCOPE_STYLE[scope], '']
  if (detail !== undefined) args.push(sanitizeDevEventDetail(detail))
  console[CONSOLE_METHOD[level]](...args)
}

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

export type CrdtLogScope = 'wire' | 'doc'
export const DEV_EVENT_KINDS = [
  'ws_out',
  'doc_subscribed',
  'doc_update',
  'doc_ops_result',
  'doc_ops_result_dropped',
  'human_ops_settled',
  'doc_reset',
  'doc_nodes_changed',
  'schema_error',
  'reconnected',
  'subscribe_retry',
  'subscribe_ack_timeout',
  'subscribe_refused_permanent',
  'doc_reseed_sent',
  'doc_reseed_result',
  'stale_probe',
  'catchup_probe',
  'rebind',
  'doc_gap',
  'doc_stale',
  'frame_send_failed',
  'agent_node_adapters_materialized',
  'local_widget_write_held'
] as const
export type DevEventKind = (typeof DEV_EVENT_KINDS)[number]
export interface DevEvent {
  seq: number
  at: number
  kind: DevEventKind
  scope: CrdtLogScope
  level: CrdtLogLevel
  detail: unknown
}
export interface DevEventOptions {
  scope?: CrdtLogScope
  level?: CrdtLogLevel
}
const CAPACITY = 500
let nextSeq = 1
let buffer: DevEvent[] | undefined
export const devEvents = shallowRef<readonly DevEvent[]>([])
export function recordDevEvent(
  kind: DevEventKind,
  detail: unknown,
  options: DevEventOptions = {}
): void {
  if (!flags.agentCrdtDebugEnabled) return
  const events = buffer ?? (buffer = [])
  events.push({
    seq: nextSeq++,
    at: Date.now(),
    kind,
    scope: options.scope ?? 'doc',
    level: options.level ?? 'info',
    detail: sanitizeDevEventDetail(detail)
  })
  if (events.length > CAPACITY) events.splice(0, events.length - CAPACITY)
  if (devEvents.value !== events) devEvents.value = events
  else triggerRef(devEvents)
}
export function clearDevEvents(): void {
  if (!buffer) return
  buffer.length = 0
  triggerRef(devEvents)
}
export function stringifyDevEvents(events: readonly DevEvent[]): string {
  return JSON.stringify(events, devEventReplacer(), 2)
}
export function devEventReplacer(): (
  this: unknown,
  key: string,
  value: unknown
) => unknown {
  const ancestors: unknown[] = []
  return function (this: unknown, _key, value) {
    while (ancestors.length > 0 && ancestors.at(-1) !== this) ancestors.pop()
    if (ArrayBuffer.isView(value)) {
      return `${value.constructor.name}(${value.byteLength})`
    }
    if (Object.prototype.toString.call(value) === '[object ArrayBuffer]') {
      return `ArrayBuffer(${(value as ArrayBuffer).byteLength})`
    }
    if (typeof value === 'bigint') return value.toString()
    if (typeof value === 'object' && value !== null) {
      if (ancestors.includes(value)) return '[Circular]'
      ancestors.push(value)
    }
    return value
  }
}
