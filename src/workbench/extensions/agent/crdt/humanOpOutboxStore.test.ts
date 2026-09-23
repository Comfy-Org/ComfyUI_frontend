/**
 * sessionStorage-backed outbox store (mutref-3 / M7 s4). The behaviour under
 * test: a save/load round trip preserves entries verbatim; a record older
 * than the rehydration TTL, a malformed record, or a record with an entry of
 * the wrong shape is refused AND cleared; a missing or throwing storage
 * degrades to "nothing persisted" without throwing; and an outbox built on
 * the store rehydrates `queued` entries as `parked` with the same op ids.
 */
import { describe, expect, it } from 'vitest'

import type { Op } from '@comfyorg/comfy-multi-player'

import type { OutboxEntry } from './humanOpOutbox'
import { createHumanOpOutbox } from './humanOpOutbox'
import {
  OUTBOX_REHYDRATE_TTL_MS,
  createSessionOutboxStore
} from './humanOpOutboxStore'

const KEY = 'outbox:test'

const op = (id: string): Op =>
  ({
    op: 'delete_node',
    node_id: `n-${id}`,
    op_id: id.repeat(32).slice(0, 32),
    actor: 'human:u1:t1',
    base_version: 1,
    stamp: [1, 'human:u1:t1']
  }) as unknown as Op

const entry = (
  id: string,
  state: OutboxEntry['state'] = 'queued',
  workflowId = 'wf-a'
): OutboxEntry => ({ workflowId, op: op(id), state })

function fakeStorage(): Storage {
  const slots = new Map<string, string>()
  return {
    get length() {
      return slots.size
    },
    key: (index: number) => [...slots.keys()][index] ?? null,
    getItem: (key: string) => slots.get(key) ?? null,
    setItem(key: string, value: string) {
      slots.set(key, value)
    },
    removeItem(key: string) {
      slots.delete(key)
    },
    clear() {
      slots.clear()
    }
  }
}

function storeOn(storage: Storage | null, clock: { now: number }) {
  return createSessionOutboxStore({
    storage: () => storage,
    now: () => clock.now
  })
}

describe('createSessionOutboxStore', () => {
  it('round-trips entries verbatim through storage and clears on request', () => {
    const storage = fakeStorage()
    const clock = { now: 1_000 }
    const store = storeOn(storage, clock)
    const entries = [entry('a'), entry('b', 'parked'), entry('c', 'rejected')]

    store.save(KEY, entries)
    expect(storage.getItem(KEY)).not.toBeNull()
    expect(store.load(KEY)).toEqual(entries)

    store.clear(KEY)
    expect(storage.getItem(KEY)).toBeNull()
    expect(store.load(KEY)).toBeNull()
  })

  it('refuses and clears a record saved at or beyond the rehydration TTL', () => {
    const storage = fakeStorage()
    const clock = { now: 10_000 }
    const store = storeOn(storage, clock)
    store.save(KEY, [entry('a')])

    clock.now = 10_000 + OUTBOX_REHYDRATE_TTL_MS - 1
    expect(store.load(KEY)).toHaveLength(1)

    clock.now = 10_000 + OUTBOX_REHYDRATE_TTL_MS
    expect(store.load(KEY)).toBeNull()
    expect(storage.getItem(KEY)).toBeNull()
  })

  const malformedRecords: Array<[label: string, raw: string]> = [
    ['not json', '{not json'],
    ['a bare array (pre-envelope shape)', JSON.stringify([entry('a')])],
    ['a missing savedAt', JSON.stringify({ entries: [entry('a')] })],
    [
      'an entry with an unknown state',
      JSON.stringify({
        savedAt: 0,
        entries: [{ ...entry('a'), state: 'flying' }]
      })
    ],
    [
      'an entry without an op id',
      JSON.stringify({
        savedAt: 0,
        entries: [{ workflowId: 'wf-a', state: 'queued', op: { op: 'x' } }]
      })
    ],
    [
      'an entry without a workflow',
      JSON.stringify({
        savedAt: 0,
        entries: [{ ...entry('a'), workflowId: '' }]
      })
    ]
  ]

  for (const [label, raw] of malformedRecords) {
    it(`treats ${label} as absent and clears it`, () => {
      const storage = fakeStorage()
      storage.setItem(KEY, raw)
      const store = storeOn(storage, { now: 0 })

      expect(store.load(KEY)).toBeNull()
      expect(storage.getItem(KEY)).toBeNull()
    })
  }

  it('degrades to nothing-persisted when storage is missing or throws', () => {
    const missing = storeOn(null, { now: 0 })
    expect(() => missing.save(KEY, [entry('a')])).not.toThrow()
    expect(missing.load(KEY)).toBeNull()
    expect(() => missing.clear(KEY)).not.toThrow()

    const hostile: Storage = {
      length: 0,
      key: () => null,
      clear: () => {},
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {
        throw new Error('SecurityError')
      }
    }
    const throwing = storeOn(hostile, { now: 0 })
    expect(() => throwing.save(KEY, [entry('a')])).not.toThrow()
    expect(throwing.load(KEY)).toBeNull()
    expect(() => throwing.clear(KEY)).not.toThrow()
  })

  it('lets a second outbox on the same slot rehydrate queued ops as parked with the same op ids', () => {
    const storage = fakeStorage()
    const clock = { now: 0 }
    const first = createHumanOpOutbox({
      store: storeOn(storage, clock),
      key: KEY
    })
    first.record('wf-a', [op('a'), op('b')])
    // The owner goes away mid-flight: no settle, no drop.

    const second = createHumanOpOutbox({
      store: storeOn(storage, clock),
      key: KEY
    })
    const replayable = second.replayable('wf-a')
    expect(replayable.map((e) => e.op.op_id)).toEqual([
      op('a').op_id,
      op('b').op_id
    ])
    expect(replayable.every((e) => e.state === 'parked')).toBe(true)
    expect(second.replayable('wf-b')).toEqual([])

    // Once the second owner has ruled on them the slot is empty for a third.
    second.requeue('wf-a')
    second.settle('wf-a', {
      state: 'acknowledged',
      ops: [op('a'), op('b')],
      result: { ok: true, applied: [op('a').op_id], skipped: [op('b').op_id] }
    })
    expect(storage.getItem(KEY)).toBeNull()
  })
})
