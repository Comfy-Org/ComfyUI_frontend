/**
 * Human-op outbox (mutref-3 / M7 s1). The behaviour under test: a pure,
 * store-backed record of minted human ops that parks members the host never
 * ruled on, removes members the host applied or already held, retains
 * rejected members without ever replaying them, keeps every workflow's
 * entries apart, and survives a rehydration with the same op ids.
 */
import { describe, expect, it } from 'vitest'

import type { Op } from '@comfyorg/comfy-multi-player'

import type { OutboxEntry, OutboxStore } from './humanOpOutbox'
import { createHumanOpOutbox, createMemoryOutboxStore } from './humanOpOutbox'
import type { BatchOutcome, OpsResultView } from './opSender'

const KEY = 'outbox:test'

const op = (id: string, baseVersion = 1): Op =>
  ({
    op: 'delete_node',
    node_id: `n-${id}`,
    op_id: id.repeat(32).slice(0, 32),
    actor: 'human:u1:t1',
    base_version: baseVersion,
    stamp: [baseVersion, 'human:u1:t1']
  }) as unknown as Op

const idsOf = (entries: readonly OutboxEntry[]): string[] =>
  entries.map((entry) => entry.op.op_id)

const opIds = (ops: readonly Op[]): string[] => ops.map((o) => o.op_id)

const acknowledged = (
  ops: Op[],
  result: Partial<OpsResultView>
): BatchOutcome => ({
  state: 'acknowledged',
  ops,
  result: { ok: true, applied: [], skipped: [], ...result }
})

const outbox = (store: OutboxStore = createMemoryOutboxStore()) =>
  createHumanOpOutbox({ store, key: KEY })

describe('humanOpOutbox', () => {
  it('records a batch in mint order as queued and refuses a re-record of a seen op id', () => {
    const box = outbox()
    const ops = [op('a'), op('b'), op('c')]
    expect(box.record('wf-1', ops)).toBe(3)
    expect(idsOf(box.entries())).toEqual(opIds(ops))
    expect(box.entries().map((e) => e.state)).toEqual([
      'queued',
      'queued',
      'queued'
    ])

    // Same id, different payload: still refused. The sender never re-mints.
    expect(box.record('wf-1', [op('b', 9), op('d')])).toBe(1)
    expect(idsOf(box.entries())).toEqual(
      opIds([op('a'), op('b'), op('c'), op('d')])
    )
    expect(box.entries()[1].op.base_version).toBe(1)
  })

  it('parks the whole batch on every verdict-less outcome and replays it in mint order', () => {
    for (const state of [
      'undeliverable',
      'unconfirmed',
      'unacknowledged'
    ] as const) {
      const box = outbox()
      const ops = [op('a'), op('b')]
      box.record('wf-1', ops)
      expect(box.settle('wf-1', { state, ops })).toEqual({
        removed: 0,
        rejected: 0,
        parked: 2,
        unknown: 0
      })
      expect(idsOf(box.replayable('wf-1'))).toEqual(opIds(ops))
      // Replay hands back the minted object, not a copy with a fresh id.
      expect(box.replayable('wf-1')[0].op).toBe(ops[0])
    }
  })

  it('removes applied and skipped members of an acknowledged batch', () => {
    const box = outbox()
    const ops = [op('a'), op('b')]
    box.record('wf-1', ops)
    const summary = box.settle(
      'wf-1',
      acknowledged(ops, { applied: [ops[0].op_id], skipped: [ops[1].op_id] })
    )
    expect(summary).toEqual({ removed: 2, rejected: 0, parked: 0, unknown: 0 })
    expect(box.entries()).toEqual([])
    expect(box.replayable('wf-1')).toEqual([])
  })

  it('retains a rejected member with its failure, parks the unprocessed tail, and never replays the rejection', () => {
    const box = outbox()
    const ops = [op('a'), op('b'), op('c')]
    box.record('wf-1', ops)
    const failure = { op_id: ops[1].op_id, code: 'unknown_node' }
    const summary = box.settle(
      'wf-1',
      acknowledged(ops, { ok: false, applied: [ops[0].op_id], failure })
    )
    expect(summary).toEqual({ removed: 1, rejected: 1, parked: 1, unknown: 0 })
    expect(box.entries()).toEqual([
      { workflowId: 'wf-1', op: ops[1], state: 'rejected', failure },
      { workflowId: 'wf-1', op: ops[2], state: 'parked' }
    ])
    expect(idsOf(box.replayable('wf-1'))).toEqual([ops[2].op_id])
  })

  it('parks every member of an anonymous failure (no ids, no failure op id)', () => {
    const box = outbox()
    const ops = [op('a'), op('b')]
    box.record('wf-1', ops)
    const summary = box.settle('wf-1', acknowledged(ops, { ok: false }))
    expect(summary).toEqual({ removed: 0, rejected: 0, parked: 2, unknown: 0 })
    expect(idsOf(box.replayable('wf-1'))).toEqual(opIds(ops))
  })

  it('keeps workflows apart: a settle addressed to another workflow is unknown and replay never crosses', () => {
    const box = outbox()
    const first = [op('a')]
    const second = [op('b')]
    box.record('wf-1', first)
    box.record('wf-2', second)
    // Wrong workflow for these ops: nothing moves.
    expect(box.settle('wf-2', { state: 'undeliverable', ops: first })).toEqual({
      removed: 0,
      rejected: 0,
      parked: 0,
      unknown: 1
    })
    expect(box.entries()[0].state).toBe('queued')
    box.settle('wf-1', { state: 'undeliverable', ops: first })
    box.settle('wf-2', { state: 'unconfirmed', ops: second })
    expect(idsOf(box.replayable('wf-1'))).toEqual([first[0].op_id])
    expect(idsOf(box.replayable('wf-2'))).toEqual([second[0].op_id])
  })

  it('settles each entry once: a second outcome for a parked or rejected member is unknown', () => {
    const box = outbox()
    const ops = [op('a'), op('b')]
    box.record('wf-1', ops)
    box.settle(
      'wf-1',
      acknowledged(ops, { ok: false, failure: { op_id: ops[0].op_id } })
    )
    // A late ack naming both: the rejection stands, the parked op stays parked.
    expect(
      box.settle('wf-1', acknowledged(ops, { applied: opIds(ops) }))
    ).toEqual({ removed: 0, rejected: 0, parked: 0, unknown: 2 })
    expect(box.entries().map((e) => e.state)).toEqual(['rejected', 'parked'])
  })

  it('drop forgets queued and parked entries of one workflow and keeps rejected ones and other workflows', () => {
    const box = outbox()
    const ops = [op('a'), op('b'), op('c')]
    const other = [op('d')]
    box.record('wf-1', ops)
    box.record('wf-2', other)
    box.settle(
      'wf-1',
      acknowledged(ops, { ok: false, failure: { op_id: ops[0].op_id } })
    )
    // a: rejected, b: parked, c: parked (via the failure), d: queued.
    expect(box.drop('wf-1')).toBe(2)
    expect(box.entries()).toEqual([
      expect.objectContaining({ op: ops[0], state: 'rejected' }),
      expect.objectContaining({ op: other[0], state: 'queued' })
    ])
    expect(box.drop('wf-1')).toBe(0)
  })

  it('writes through on every mutation and clears the slot when empty', () => {
    const store = createMemoryOutboxStore()
    const box = outbox(store)
    const ops = [op('a')]
    box.record('wf-1', ops)
    expect(store.load(KEY)?.map((e) => e.state)).toEqual(['queued'])
    box.settle('wf-1', { state: 'undeliverable', ops })
    expect(store.load(KEY)?.map((e) => e.state)).toEqual(['parked'])
    box.drop('wf-1')
    expect(store.load(KEY)).toBeNull()
  })

  it('rehydrates from the store with the same op ids, turning stranded queued entries into parked ones', () => {
    const store = createMemoryOutboxStore()
    const before = outbox(store)
    const ops = [op('a'), op('b'), op('c')]
    before.record('wf-1', ops)
    before.settle(
      'wf-1',
      acknowledged(ops, { ok: false, failure: { op_id: ops[1].op_id } })
    )
    // a: parked (unnamed by the host), b: rejected, c: parked. Record a
    // fourth op and leave it queued to simulate a page unload mid-flight.
    before.record('wf-1', [op('d')])

    const after = outbox(store)
    expect(after.entries().map((e) => [e.op.op_id, e.state])).toEqual([
      [ops[0].op_id, 'parked'],
      [ops[1].op_id, 'rejected'],
      [ops[2].op_id, 'parked'],
      [op('d').op_id, 'parked']
    ])
    // The rehydrated outbox still refuses the ids it knows.
    expect(after.record('wf-1', [op('d')])).toBe(0)
    // Replay order is record order, rejected excluded.
    expect(idsOf(after.replayable('wf-1'))).toEqual([
      ops[0].op_id,
      ops[2].op_id,
      op('d').op_id
    ])
  })
})
