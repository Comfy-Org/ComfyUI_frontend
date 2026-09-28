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
  'subscribe_ack_timeout',
  'subscribe_refused_permanent',
  'stale_probe',
  'catchup_probe',
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

// Strings are the only place free-form producer or user content can reach the
// buffer, so string retention is an ALLOW-LIST, not a deny-list: a string
// survives verbatim only under a key this module knows to be structural, and
// only when it also has a structural shape. Everything else is summarized by
// length. Enumerating sensitive content cannot work — a `description` holding
// user prose and an unlisted credential format are both retained verbatim by a
// deny-list, whatever shapes it knows about.
const STRUCTURAL_STRING_KEYS = new Set([
  'actor',
  'added',
  'class_type',
  'code',
  'context',
  'doc_id',
  'failed',
  'frame_type',
  'id',
  'kind',
  'level',
  'name',
  'node_id',
  'op',
  'op_id',
  'op_ids',
  'outcome',
  'phase',
  'prompt_id',
  'removed',
  'scope',
  'seq',
  'session_id',
  'skipped',
  'source',
  'state',
  'status',
  'tab',
  'tab_id',
  'target',
  'type',
  'v',
  'workflow_id'
])

// An identifier, enum member or opaque id: bounded, and with no whitespace it
// cannot carry a sentence. A value that fails this is summarized even under an
// allow-listed key, so a producer that starts putting prose in `code` does not
// silently reopen the leak.
const STRUCTURAL_VALUE = /^[A-Za-z0-9_.:@+/-]{0,64}$/

// Defense in depth for the strings the allow-list does retain: a short opaque
// id can still be a credential or a presigned URL.
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

/**
 * What a free-form string degrades to. Length is the one property a reader can
 * use (empty vs. truncated vs. a whole prompt) that the string's content cannot
 * leak, and it reads like the other summaries the buffer already emits
 * (`Uint8Array(3)`, `Map(1)`).
 */
function summarizeString(value: string): string {
  return `String(${value.length})`
}

/**
 * `key` is the nearest enclosing object key, which an array passes down to its
 * items so `skipped: ['op-1']` is judged as `skipped`. A string with no
 * enclosing key — a bare `detail` — is never structural.
 */
function sanitizeStringValue(value: string, key: string | undefined): string {
  if (key !== undefined && STRUCTURAL_STRING_KEYS.has(key)) {
    if (STRUCTURAL_VALUE.test(value)) return sanitizeString(value)
  }
  return summarizeString(value)
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
  ancestors: readonly object[],
  key: string | undefined
): unknown {
  const nextAncestors = [...ancestors, value]
  if (Array.isArray(value)) {
    return value.map((item) =>
      sanitizeDetail(item, depth + 1, nextAncestors, key)
    )
  }
  if (value instanceof Error) {
    // `name` is the structural half of an Error; `message` is producer prose
    // and gets the same treatment as any other free-form string.
    return {
      name: sanitizeStringValue(value.name, 'name'),
      message: summarizeString(value.message)
    }
  }
  if (value instanceof Map) return `Map(${value.size})`
  if (value instanceof Set) return `Set(${value.size})`
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString()
  }

  return Object.fromEntries(
    Object.entries(value).map(([entryKey, item]) => {
      const normalizedKey = normalizeKey(entryKey)
      if (
        SENSITIVE_KEY.test(normalizedKey) ||
        CONTENT_KEYS.has(normalizedKey)
      ) {
        return [entryKey, REDACTED]
      }
      return [
        entryKey,
        sanitizeDetail(item, depth + 1, nextAncestors, normalizedKey)
      ]
    })
  )
}

function sanitizeDetail(
  value: unknown,
  depth = 0,
  ancestors: readonly object[] = [],
  key?: string
): unknown {
  if (depth > MAX_SANITIZE_DEPTH) return REDACTED
  if (ArrayBuffer.isView(value)) {
    return `${value.constructor.name}(${value.byteLength})`
  }
  if (Object.prototype.toString.call(value) === '[object ArrayBuffer]') {
    return `ArrayBuffer(${(value as ArrayBuffer).byteLength})`
  }
  if (typeof value === 'string') return sanitizeStringValue(value, key)
  if (value === null || typeof value !== 'object') return value
  if (ancestors.includes(value)) return '[Circular]'

  return sanitizeObject(value, depth, ancestors, key)
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

/**
 * Serializes an event detail defensively (typed arrays / ArrayBuffer don't
 * JSON well). Intentionally broad: any `ArrayBuffer.isView` value (not just
 * `Uint8Array`) collapses to `"<TypedArrayName>(byteLength)"`, and raw
 * `ArrayBuffer` collapses to `"ArrayBuffer(byteLength)"`. Dev-panel-only
 * output — see `devPanelLog.test.ts` "stringifies binary payloads
 * defensively" for the covered cases. (Follow-up to
 * https://github.com/Comfy-Org/ComfyUI_frontend/pull/16344 review comment.)
 */
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
