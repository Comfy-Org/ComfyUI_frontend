import { shallowRef, triggerRef } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'

import { isCrdtDebugEnabled } from './crdtDebugGate'
import type { CrdtLogLevel } from './crdtDebugGate'

/**
 * In-memory ring buffer feeding the CRDT debug panel. Deliberately
 * module-level (one buffer per page, like the follower gate) so the panel
 * component and the follower composable never need a shared injection seam.
 *
 * Every entry carries the same four axes the console logger uses — kind,
 * scope, level, detail — so "what the panel shows" and "what the console
 * printed" are the same record read two ways, and a copied report is a
 * faithful transcript rather than a second, drifting summary.
 */

/**
 * The layer an event came from. Filtering by scope is how the panel offers
 * "varying levels of abstraction": `wire` is bytes on the socket and `doc`
 * is document lineage.
 */
export type CrdtLogScope = 'wire' | 'doc'

export type DevEventKind =
  | 'ws_out'
  | 'doc_subscribed'
  | 'doc_update'
  | 'doc_ops_result'
  | 'human_ops_settled'
  | 'doc_reset'
  | 'schema_error'
  | 'reconnected'
  | 'subscribe_retry'
  | 'doc_nodes_changed'
  | 'rebind'
  | 'stale_probe'
  | 'doc_gap'
  | 'doc_stale'
  | 'agent_node_adapters_materialized'

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
const REDACTED = '[REDACTED]'
const MAX_SANITIZE_DEPTH = 12
const SENSITIVE_KEY =
  /(^|_)(token|accesstoken|secret|password|passwd|credential|api_key|apikey|authorization|auth|bearer|session|cookie|signature|jwt|prompt|text)$/
const CONTENT_KEYS = new Set([
  'value',
  'old',
  'widgets_values',
  'widgets_values_named',
  'node',
  'workflow'
])

let nextSeq = 1
let buffer: DevEvent[] | undefined

function isSensitiveKey(key: string): boolean {
  const normalized = key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toLowerCase()
  return SENSITIVE_KEY.test(normalized)
}

function sanitizeDetail(
  value: unknown,
  depth = 0,
  ancestors: readonly object[] = []
): unknown {
  if (depth > MAX_SANITIZE_DEPTH) return REDACTED
  if (ArrayBuffer.isView(value)) {
    return `${value.constructor.name}(${value.byteLength})`
  }
  if (Object.prototype.toString.call(value) === '[object ArrayBuffer]') {
    return `ArrayBuffer(${(value as ArrayBuffer).byteLength})`
  }
  if (value === null || typeof value !== 'object') return value
  if (ancestors.includes(value)) return '[Circular]'

  const nextAncestors = [...ancestors, value]
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDetail(item, depth + 1, nextAncestors))
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (isSensitiveKey(key) || CONTENT_KEYS.has(key)) {
        return [key, REDACTED]
      }
      return [key, sanitizeDetail(item, depth + 1, nextAncestors)]
    })
  )
}

/**
 * Shallow ref over the lazily allocated ring buffer. Production sessions that
 * never enable the debug instrument retain no event buffer. Once recording is
 * enabled, consumers get a stable array identity and mutations are announced
 * via triggerRef so a 500-entry log never churns deep reactivity.
 */
export const devEvents = shallowRef<readonly DevEvent[]>([])

export function recordDevEvent(
  kind: DevEventKind,
  detail: unknown,
  options: DevEventOptions = {}
): void {
  if (!isCrdtDebugEnabled()) return
  const events = buffer ?? (buffer = [])
  events.push({
    seq: nextSeq++,
    at: Date.now(),
    kind,
    scope: options.scope ?? 'doc',
    level: options.level ?? 'info',
    detail: sanitizeDetailSafely(detail)
  })
  if (events.length > CAPACITY) events.splice(0, events.length - CAPACITY)
  if (devEvents.value !== events) devEvents.value = events
  else triggerRef(devEvents)
}

function sanitizeDetailSafely(detail: unknown): unknown {
  try {
    return sanitizeDetail(detail)
  } catch {
    reportError(new Error('Failed to sanitize CRDT dev event detail'), {
      errorType: 'crdt_dev_event_sanitization_failed'
    })
    return REDACTED
  }
}

export function clearDevEvents(): void {
  if (!buffer) return
  buffer.length = 0
  triggerRef(devEvents)
}

/** Serializes an event detail defensively (Uint8Array etc. don't JSON well). */
export function stringifyDevEvents(events: readonly DevEvent[]): string {
  return JSON.stringify(events, devEventReplacer(), 2)
}

/**
 * JSON replacer shared by the panel's copy actions and the debug report.
 *
 * A binary payload is summarized by length rather than dumped: the bytes are
 * a Yjs update, unreadable to a human and large enough to push the interesting
 * fields out of a paste. Cyclic values degrade to a marker instead of
 * throwing, because the report must survive whatever the doc happens to hold.
 */
export function devEventReplacer(): (
  this: unknown,
  key: string,
  value: unknown
) => unknown {
  // Tracks the ANCESTOR chain, not everything visited: a doc snapshot legally
  // references one object from two sibling positions, and a visited-set would
  // report the second as `[Circular]` and silently drop real data.
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
