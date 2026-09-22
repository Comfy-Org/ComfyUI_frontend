import type { Op, OpBase } from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { BatchOutcome } from './opSender'
import type { PendingOpShadowSurface } from './pendingOpShadow'
import { createPendingOpShadowSurface } from './pendingOpShadow'
import {
  createPendingOpShadowBinding,
  rootGraphTargetsForOp
} from './pendingOpShadowBinding'
import { createPendingOpTracker } from './pendingOpTracker'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

const ACTOR = 'human:test-user:tab-1'
const ROOT = 'graph-root'

function envelope(opId: string): OpBase {
  return { op_id: opId, actor: ACTOR, base_version: 41, stamp: [41, ACTOR] }
}

function addNode(opId: string, nodeId: number): Op {
  return {
    ...envelope(opId),
    op: 'add_node',
    node_id: nodeId,
    class_type: 'TestNode',
    pos: [0, 0],
    node: { id: nodeId, type: 'TestNode' }
  }
}

function setWidget(opId: string, nodeId: number, path?: [number]): Op {
  return {
    ...envelope(opId),
    op: 'set_widget',
    node_id: nodeId,
    widget: 'seed',
    value: 7,
    ...(path ? { path } : {})
  } as Op
}

function acknowledged(
  ops: Op[],
  result: Extract<BatchOutcome, { state: 'acknowledged' }>['result']
): BatchOutcome {
  return { state: 'acknowledged', ops, result }
}

function nodeTarget(nodeId: number) {
  return { kind: 'node', graphId: ROOT, nodeId: String(nodeId) } as const
}

describe('createPendingOpShadowBinding (s3-opt-3 clear-on-effect)', () => {
  let surface: PendingOpShadowSurface
  let tracker: ReturnType<typeof createPendingOpTracker>
  let ops: Op[]

  beforeEach(() => {
    surface = createPendingOpShadowSurface()
    const bind = createPendingOpShadowBinding({
      surface,
      targetsForOp: rootGraphTargetsForOp(() => ROOT)
    })
    tracker = createPendingOpTracker({ onEvent: bind })
    ops = [addNode('op-1', 1), addNode('op-2', 2), addNode('op-3', 3)]
  })

  function mintAndAck(minted: Op[] = ops, seq?: number) {
    tracker.onBatchMinted(minted)
    tracker.onBatchTransmitted(minted)
    tracker.onBatchSettled(
      acknowledged(minted, {
        ok: true,
        applied: minted.map((op) => op.op_id),
        skipped: [],
        ...(seq === undefined ? {} : { seq })
      })
    )
  }

  it('shows a shadow per minted op, keyed by the op id, on the resolved targets', () => {
    tracker.onBatchMinted(ops)

    expect(surface.pendingShadows()).toEqual([
      { opId: 'op-1', targets: [nodeTarget(1)] },
      { opId: 'op-2', targets: [nodeTarget(2)] },
      { opId: 'op-3', targets: [nodeTarget(3)] }
    ])
    expect(surface.isPending(nodeTarget(2))).toBe(true)
  })

  it('the ack alone clears nothing: styling waits for the document effect (KA-9)', () => {
    mintAndAck()

    expect(surface.size()).toBe(3)
    expect(tracker.entries()).toHaveLength(3)
  })

  it('one op id in a doc_update removes that ledger entry and that shadow only', () => {
    mintAndAck()

    tracker.onDocEffect(['op-2'])

    expect(tracker.entries().map((e) => e.opId)).toEqual(['op-1', 'op-3'])
    expect(surface.pendingShadows().map((s) => s.opId)).toEqual([
      'op-1',
      'op-3'
    ])
    expect(surface.isPending(nodeTarget(2))).toBe(false)
    expect(surface.isPending(nodeTarget(1))).toBe(true)
  })

  it('a multi-op doc_update clears every matching id in one step', () => {
    mintAndAck()

    tracker.onDocEffect(['op-3', 'op-1'])

    expect(tracker.entries().map((e) => e.opId)).toEqual(['op-2'])
    expect(surface.pendingShadows().map((s) => s.opId)).toEqual(['op-2'])
  })

  it('unrelated op ids touch neither ledger nor shadows', () => {
    mintAndAck()
    const changes: string[] = []
    surface.subscribe((change) => changes.push(change.type))

    tracker.onDocEffect(['someone-else', 'op-9'])

    expect(tracker.entries()).toHaveLength(3)
    expect(surface.size()).toBe(3)
    expect(changes).toEqual([])
  })

  it('a skipped duplicate clears on the covering authoritative projection, not on the ack (s3-opt-2)', () => {
    tracker.onBatchMinted(ops)
    tracker.onBatchTransmitted(ops)
    tracker.onBatchSettled(
      acknowledged(ops, {
        ok: true,
        applied: ['op-1', 'op-3'],
        skipped: ['op-2'],
        seq: 50
      })
    )
    tracker.onDocEffect(['op-1', 'op-3'])
    // Still awaiting: the projection has not yet reached the ack seq.
    tracker.onAuthoritativeState(49)
    expect(surface.pendingShadows().map((s) => s.opId)).toEqual(['op-2'])

    tracker.onAuthoritativeState(50)
    expect(surface.size()).toBe(0)
  })

  it('a rejected op reverts its shadow and the never-reached suffix; the applied prefix keeps waiting', () => {
    tracker.onBatchMinted(ops)
    tracker.onBatchTransmitted(ops)
    const changes: string[] = []
    surface.subscribe((change) => changes.push(`${change.type}:${'opId' in change ? change.opId : ''}`))

    tracker.onBatchSettled(
      acknowledged(ops, {
        ok: false,
        applied: ['op-1'],
        skipped: [],
        failure: { op_id: 'op-2' }
      })
    )

    expect(changes).toEqual(['revert:op-2', 'revert:op-3'])
    expect(surface.pendingShadows().map((s) => s.opId)).toEqual(['op-1'])
  })

  it('delivery_unknown keeps every shadow: the op is still pending', () => {
    tracker.onBatchMinted(ops)
    tracker.onBatchTransmitted(ops)
    tracker.onBatchSettled({ state: 'unacknowledged', ops })

    expect(surface.size()).toBe(3)
    // The effect eventually arriving is still the clear path.
    tracker.onDocEffect(['op-1', 'op-2', 'op-3'])
    expect(surface.size()).toBe(0)
  })

  it('reset (doc_reset / unmount / workflow switch) drops every shadow at once (FEB-5)', () => {
    mintAndAck()
    const changes: string[] = []
    surface.subscribe((change) => changes.push(change.type))

    tracker.reset()

    expect(surface.size()).toBe(0)
    expect(changes).toEqual(['clear-all'])
    // A late effect for a dropped id is inert on both sides.
    tracker.onDocEffect(['op-1'])
    expect(changes).toEqual(['clear-all'])
  })

  it('a re-minted op id does not double-register a shadow', () => {
    tracker.onBatchMinted(ops)
    tracker.onBatchMinted([ops[0]])

    expect(surface.size()).toBe(3)
  })

  it('an op the resolver cannot place is tracked but unstyled, and still clears cleanly', () => {
    const interior = setWidget('op-i', 5, [42])
    mintAndAck([interior])

    expect(surface.get('op-i')).toEqual({ opId: 'op-i', targets: [] })
    expect(surface.pendingTargets()).toEqual([])

    tracker.onDocEffect(['op-i'])
    expect(surface.size()).toBe(0)
    expect(tracker.entries()).toEqual([])
  })
})

describe('rootGraphTargetsForOp', () => {
  const resolve = rootGraphTargetsForOp(() => ROOT)

  it('names every graph-local entity a root op touches', () => {
    expect(resolve(addNode('a', 1))).toEqual([nodeTarget(1)])
    expect(resolve(setWidget('w', 2))).toEqual([
      { kind: 'widget', graphId: ROOT, nodeId: '2', widgetName: 'seed' }
    ])
    expect(
      resolve({
        ...envelope('c'),
        op: 'connect',
        link_id: 9,
        from_node: 1,
        from_slot: 0,
        to_node: 2,
        to_slot: 0
      } as Op)
    ).toEqual([
      { kind: 'link', graphId: ROOT, linkId: '9' },
      nodeTarget(1),
      nodeTarget(2)
    ])
    expect(
      resolve({
        ...envelope('d'),
        op: 'disconnect',
        link_id: 9,
        to_node: 2,
        to_slot: 0
      } as Op)
    ).toEqual([{ kind: 'link', graphId: ROOT, linkId: '9' }, nodeTarget(2)])
    expect(
      resolve({
        ...envelope('x'),
        op: 'clear',
        removed_nodes: [1, 2]
      } as Op)
    ).toEqual([nodeTarget(1), nodeTarget(2)])
  })

  it('yields no targets for interior ops or when no root graph is live', () => {
    expect(resolve(setWidget('w', 2, [7]))).toEqual([])
    expect(rootGraphTargetsForOp(() => null)(addNode('a', 1))).toEqual([])
  })
})
