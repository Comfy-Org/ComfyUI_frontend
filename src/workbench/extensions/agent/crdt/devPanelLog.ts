import { shallowRef, triggerRef } from 'vue'

/**
 * Dev instrumentation: in-memory ring buffer feeding the CRDT dev panel.
 * Deliberately module-level (one buffer per page, like the follower gate) so
 * the panel component and the follower composable never need a shared
 * injection seam. No mount site until the agent-panel slice lands.
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
  | 'stale_probe'

export interface DevEvent {
  seq: number
  at: number
  kind: DevEventKind
  detail: unknown
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

export function recordDevEvent(kind: DevEventKind, detail: unknown): void {
  buffer.push({ seq: nextSeq++, at: Date.now(), kind, detail })
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
