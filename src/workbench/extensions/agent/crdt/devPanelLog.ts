import { shallowRef, triggerRef } from 'vue'

/**
 * PoC (branch poc/fe-crdt-follower-e2e): in-memory ring buffer feeding the
 * CRDT dev panel. Deliberately module-level (one buffer per page, like the
 * follower gate) so the panel component and the follower composable never
 * need a shared injection seam. Not shipped beyond the PoC branch.
 */

export type DevEventKind =
  | 'ws_out'
  | 'doc_subscribed'
  | 'doc_update'
  | 'doc_ops_result'
  | 'doc_reset'
  | 'schema_error'
  | 'reconnected'
  | 'subscribe_retry'
  | 'doc_nodes_changed'
  | 'rebind'

export interface DevEvent {
  seq: number
  at: number
  kind: DevEventKind
  detail: unknown
}

const CAPACITY = 500
const REDACTED = '[REDACTED]'
const SENSITIVE_KEY = /(token|password|authorization|prompt|text)/i
const WIDGET_VALUES_KEYS = new Set(['widgets_values', 'widgets_values_named'])

let nextSeq = 1
const buffer: DevEvent[] = []

function redactValues(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(() => REDACTED)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).map((key) => [key, REDACTED]))
  }
  return REDACTED
}

function sanitizeDetail(value: unknown, redactOpValue = false): unknown {
  if (value instanceof Uint8Array) return value
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDetail(item, redactOpValue))
  }
  if (value === null || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (SENSITIVE_KEY.test(key) || (redactOpValue && key === 'value')) {
        return [key, REDACTED]
      }
      if (WIDGET_VALUES_KEYS.has(key)) return [key, redactValues(item)]
      return [key, sanitizeDetail(item, key === 'ops')]
    })
  )
}

/**
 * Shallow ref over the ring buffer. Consumers get a stable array identity;
 * mutations are announced via triggerRef so a 500-entry log never churns
 * deep reactivity.
 */
export const devEvents = shallowRef<readonly DevEvent[]>(buffer)

export function recordDevEvent(kind: DevEventKind, detail: unknown): void {
  buffer.push({
    seq: nextSeq++,
    at: Date.now(),
    kind,
    detail: sanitizeDetail(detail)
  })
  if (buffer.length > CAPACITY) buffer.splice(0, buffer.length - CAPACITY)
  triggerRef(devEvents)
}

export function clearDevEvents(): void {
  buffer.length = 0
  triggerRef(devEvents)
}

/** Serializes an event detail defensively (Uint8Array etc. don't JSON well). */
export function stringifyDevEvents(events: readonly DevEvent[]): string {
  return JSON.stringify(
    events,
    (_key, value) =>
      value instanceof Uint8Array ? `Uint8Array(${value.length})` : value,
    2
  )
}
