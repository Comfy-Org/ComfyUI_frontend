/**
 * sessionStorage-backed `OutboxStore` (mutref-3 / M7 s4). The memory store
 * dies with the composable that owns it, so a panel remount (the FE-1902
 * shape) or a page reload lost every parked human op the moment it happened:
 * the sender's `detach()` drops in-flight and queued batches without a
 * verdict, and nothing was left to replay them. Persisting the outbox
 * per-tab lets the next mount rehydrate those entries as `parked` and replay
 * them under their ORIGINAL op ids once the doc is bound again (KA-6: the
 * host's `op_id` gate turns a replay of an op it already applied into a
 * `no-op`, so rehydrating "maybe applied" is safe).
 *
 * Scope decisions, in the order they matter:
 *
 * - sessionStorage, not localStorage: the outbox is one browser tab's record
 *   of what IT minted. localStorage would let every tab replay every other
 *   tab's ops; sessionStorage is already per-tab.
 * - No page-session nonce, unlike `agentCrdtDocLifecycle`. The doc-id record
 *   refuses to cross a reload because rebinding a stale doc id is wrong; a
 *   parked op crossing a reload is exactly the case this store exists for.
 *   The one place sessionStorage leaks across tabs, browser-tab duplication,
 *   clones the record into a second tab that then replays the same op ids
 *   toward the same workflow the URL names. That replay is idempotent by
 *   construction and settles as `skipped` on whichever tab sends second.
 * - Rehydration TTL: a record older than {@link OUTBOX_REHYDRATE_TTL_MS} is
 *   refused and cleared. It matches the doc-id record's own TTL: an op
 *   minted against a binding the lifecycle itself no longer trusts should
 *   not resurface after a long-idle reload as a surprise mutation. The TTL
 *   only gates `load`; a live outbox keeps its entries in memory regardless.
 * - Tolerant of a hostile environment: no `window`, a privacy mode that
 *   throws on access, a full quota, or a malformed record all degrade to the
 *   memory store's behaviour (nothing persisted, nothing thrown). A record
 *   that fails shape validation is treated as absent and cleared, never
 *   trusted partially.
 */
import type { OutboxEntry, OutboxStore } from './humanOpOutbox'

/**
 * The follower's outbox slot. One per browser tab (sessionStorage scope);
 * entries inside are already keyed by the workflow they were minted against.
 */
export const HUMAN_OP_OUTBOX_KEY = 'Comfy.Agent.HumanOpOutbox'

/** Records saved longer ago than this are refused on rehydration. */
export const OUTBOX_REHYDRATE_TTL_MS = 5 * 60 * 1000

interface PersistedOutboxRecord {
  savedAt: number
  entries: OutboxEntry[]
}

const ENTRY_STATES: ReadonlySet<string> = new Set([
  'queued',
  'parked',
  'rejected'
])

function safeSessionStorage(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function hasOpId(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  return isNonEmptyString((value as Record<string, unknown>).op_id)
}

function isEntry(value: unknown): value is OutboxEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  return (
    isNonEmptyString(entry.workflowId) &&
    typeof entry.state === 'string' &&
    ENTRY_STATES.has(entry.state) &&
    hasOpId(entry.op)
  )
}

function parseRecord(raw: string): PersistedOutboxRecord | null {
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed !== 'object' || parsed === null) return null
  const record = parsed as Partial<PersistedOutboxRecord>
  if (typeof record.savedAt !== 'number' || !Array.isArray(record.entries))
    return null
  if (!record.entries.every(isEntry)) return null
  return { savedAt: record.savedAt, entries: record.entries }
}

export function createSessionOutboxStore(
  deps: {
    /** Storage accessor; defaults to the window's sessionStorage. */
    storage?: () => Storage | null
    now?: () => number
  } = {}
): OutboxStore {
  const storage = deps.storage ?? safeSessionStorage
  const now = deps.now ?? Date.now

  function clear(key: string): void {
    try {
      storage()?.removeItem(key)
    } catch {
      // Best-effort.
    }
  }

  return {
    load(key) {
      let raw: string | null
      try {
        raw = storage()?.getItem(key) ?? null
      } catch {
        return null
      }
      if (raw === null) return null
      let record: PersistedOutboxRecord | null
      try {
        record = parseRecord(raw)
      } catch {
        record = null
      }
      if (
        record === null ||
        now() - record.savedAt >= OUTBOX_REHYDRATE_TTL_MS
      ) {
        clear(key)
        return null
      }
      return record.entries
    },
    save(key, entries) {
      try {
        const record: PersistedOutboxRecord = {
          savedAt: now(),
          entries: [...entries]
        }
        storage()?.setItem(key, JSON.stringify(record))
      } catch {
        // Quota / privacy mode: persistence is best-effort.
      }
    },
    clear
  }
}
