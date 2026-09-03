import { shallowRef, triggerRef } from 'vue'

import { isCrdtDebugOptedOut } from './crdtDebugGate'
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
const buffer: DevEvent[] = []

/**
 * Shallow ref over the ring buffer. Consumers get a stable array identity;
 * mutations are announced via triggerRef so a 500-entry log never churns
 * deep reactivity.
 */
export const devEvents = shallowRef<readonly DevEvent[]>(buffer)

export function recordDevEvent(
  kind: DevEventKind,
  detail: unknown,
  options: DevEventOptions = {}
): void {
  if (isCrdtDebugOptedOut()) return
  buffer.push({
    seq: nextSeq++,
    at: Date.now(),
    kind,
    scope: options.scope ?? 'doc',
    level: options.level ?? 'info',
    detail
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
