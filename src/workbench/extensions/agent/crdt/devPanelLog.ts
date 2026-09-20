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

export const DEV_EVENT_KINDS = [
  'ws_out',
  'doc_subscribed',
  'doc_update',
  'doc_ops_result',
  'human_ops_settled',
  'doc_reset',
  'doc_nodes_changed',
  'schema_error',
  'reconnected',
  'subscribe_retry',
  'stale_probe',
  'rebind',
  'doc_gap',
  'doc_stale',
  'frame_send_failed',
  'agent_node_adapters_materialized'
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
const REDACTED = '[REDACTED]'
const MAX_SANITIZE_DEPTH = 12
const SENSITIVE_KEY =
  /(^|_)(token|accesstoken|secret|password|passwd|credential|api_key|apikey|authorization|auth|bearer|session|cookie|signature|jwt|prompt|text)$/
const CONTENT_KEYS = new Set([
  'value',
  'old',
  'widgets_values',
  'widgets_values_named',
  'signed_url',
  'node',
  'workflow'
])

// Key-based redaction only works when the producer used a recognized name, and
// the server-controlled `message`/`code`/`description` fields on `doc_subscribed`
// and `doc_ops_result` do not. These run over every retained string so a
// credential embedded in one is redacted whatever key it arrived under.
const URL_LIKE = /\b(?:https?|wss?):\/\/[^\s"'<>]+/gi
const AUTH_SCHEME_TOKEN = /\b(?:Bearer|Basic|Token)\s+[\w.~+/=-]{8,}/gi
const PREFIXED_SECRET =
  /\b(?:sk|pk|rk|ghp|gho|ghs|xox[abprs])[-_][\w.-]{8,}\b/gi

let nextSeq = 1
let buffer: DevEvent[] | undefined

/**
 * Keeps a URL's scheme, host and path (the part that says which endpoint a
 * frame was about) and drops userinfo and the whole query, because that is
 * where a presigned URL carries its signature and access token.
 */
function sanitizeUrl(raw: string): string {
  let url
  try {
    url = new URL(raw)
  } catch {
    return REDACTED
  }
  url.username = ''
  url.password = ''
  url.hash = ''
  const query = url.search === '' ? '' : `?${REDACTED}`
  url.search = ''
  return `${url.toString()}${query}`
}

function sanitizeString(value: string): string {
  return value
    .replace(URL_LIKE, (match) => sanitizeUrl(match))
    .replace(AUTH_SCHEME_TOKEN, REDACTED)
    .replace(PREFIXED_SECRET, REDACTED)
}

function normalizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toLowerCase()
}

function sanitizeObject(
  value: object,
  depth: number,
  ancestors: readonly object[]
): unknown {
  const nextAncestors = [...ancestors, value]
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDetail(item, depth + 1, nextAncestors))
  }
  if (value instanceof Error)
    return { name: value.name, message: sanitizeString(value.message) }
  if (value instanceof Map) return `Map(${value.size})`
  if (value instanceof Set) return `Set(${value.size})`
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString()
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      const normalizedKey = normalizeKey(key)
      if (
        SENSITIVE_KEY.test(normalizedKey) ||
        CONTENT_KEYS.has(normalizedKey)
      ) {
        return [key, REDACTED]
      }
      return [key, sanitizeDetail(item, depth + 1, nextAncestors)]
    })
  )
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
  if (typeof value === 'string') return sanitizeString(value)
  if (value === null || typeof value !== 'object') return value
  if (ancestors.includes(value)) return '[Circular]'

  return sanitizeObject(value, depth, ancestors)
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
    detail: sanitizeDevEventDetail(detail)
  })
  if (events.length > CAPACITY) events.splice(0, events.length - CAPACITY)
  if (devEvents.value !== events) devEvents.value = events
  else triggerRef(devEvents)
}

export function sanitizeDevEventDetail(detail: unknown): unknown {
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
