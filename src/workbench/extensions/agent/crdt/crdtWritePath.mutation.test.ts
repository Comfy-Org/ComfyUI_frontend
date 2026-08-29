/**
 * Mutation-style tests for the FE CRDT write path.
 *
 * Each case here exists to kill a specific plausible mutant of the production
 * code — an off-by-one on a cap boundary, a dropped clamp, a boolean flipped
 * in the mint gate, a timer not cleared — chosen because the existing example
 * suites pass with that mutant in place. The `Kills:` line on every test names
 * the edit it is there to catch; a test that stops failing when you make that
 * edit is no longer earning its place.
 *
 * Scope is the write path only: the mint gate and session, the three mint
 * ports, the envelope/chunker, and the sender.
 */
import type { Op } from '@comfyorg/comfy-multi-player'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GraphOperation } from './graphOperations'
import { attachLayoutMintPort } from './layoutMintPort'
import type { LayoutChangeView, LayoutMintPort } from './layoutMintPort'
import { shouldMint } from './mintGate'
import { createMintSession } from './mintSession'
import type { MintSession } from './mintSession'
import { WIRE_MAX_BATCH_BYTES, chunkWireOps, mintWireOps } from './opEnvelope'
import { createOpSender } from './opSender'
import type { BatchOutcome, OpsResultView } from './opSender'
import { attachWidgetMintPort } from './widgetMintPort'
import type { WidgetSetView } from './widgetMintPort'

const ACTOR = 'human:test-user:tab-1'
const MINT = { actor: ACTOR, baseVersion: 41 }

describe('shouldMint — the full gate truth table', () => {
  it('Kills: any conjunct swapped for a disjunct, or a negation dropped', () => {
    const bits = [false, true]
    for (const flagEnabled of bits) {
      for (const docBound of bits) {
        for (const localProvenance of bits) {
          for (const teardown of bits) {
            const input = { flagEnabled, docBound, localProvenance, teardown }

            // The gate is one conjunction, and the whole zero-mint guarantee
            // rests on it. The example suite pins the all-true row and the
            // four single-false rows; this pins all sixteen, so no rewrite of
            // the boolean expression can agree with it by accident.
            expect(shouldMint(input)).toBe(
              flagEnabled && docBound && localProvenance && !teardown
            )
          }
        }
      }
    }
  })
})

describe('createMintSession — depth bookkeeping', () => {
  it('Kills: dropping the Math.max(0, ...) clamp on endGraphTeardown', () => {
    const session = createMintSession()

    // An unbalanced end (a load path that closed a bracket it never opened —
    // exactly what a failed load does) must not drive the depth negative.
    session.endGraphTeardown()
    session.endGraphTeardown()
    session.endGraphTeardown()

    expect(session.inTeardown()).toBe(false)

    // Without the clamp the counter now sits at -3, so the next real load
    // bracket leaves it at -2: `inTeardown()` reads false and the load mints
    // a clear storm into the bound doc.
    session.beginGraphTeardown()
    expect(session.inTeardown()).toBe(true)

    session.endGraphTeardown()
    expect(session.inTeardown()).toBe(false)
  })

  it('Kills: modelling the remote-apply scope as a boolean instead of a depth', () => {
    const session = createMintSession()
    const observed: boolean[] = []

    session.runRemoteApply(() => {
      session.runRemoteApply(() => undefined)
      // A boolean flag would have been cleared by the inner scope's exit,
      // re-opening minting for the rest of the outer remote apply — every
      // remaining remote echo would mint straight back at the host (KA-6).
      observed.push(session.inRemoteApply())
    })
    observed.push(session.inRemoteApply())

    expect(observed).toEqual([true, false])
  })

  it('Kills: making the two scopes share one counter', () => {
    const session = createMintSession()

    session.beginGraphTeardown()
    session.runRemoteApply(() => undefined)

    // The remote-apply scope opened and closed inside the teardown bracket.
    // A shared counter would have been decremented back below the bracket and
    // reported the teardown as over.
    expect(session.inTeardown()).toBe(true)
    session.endGraphTeardown()
    expect(session.inTeardown()).toBe(false)
    expect(session.inRemoteApply()).toBe(false)
  })

  it('Kills: dropping the finally that closes a remote scope on a throw', () => {
    const session = createMintSession()

    expect(() =>
      session.runRemoteApply(() => {
        throw new Error('applier blew up')
      })
    ).toThrow('applier blew up')

    // Leaking the scope suppresses every human mint for the rest of the
    // session — the write leg goes permanently silent with no error.
    expect(session.inRemoteApply()).toBe(false)
  })
})

describe('chunkWireOps — cap boundaries', () => {
  function sized(id: number, bytes: number): GraphOperation {
    return {
      op: 'set_widget',
      node_id: id,
      widget: 'text',
      value: 'x'.repeat(bytes),
      old: null
    }
  }

  function wireBytes(op: Op): number {
    return new TextEncoder().encode(JSON.stringify(op)).length
  }

  it('Kills: `>` relaxed to `>=` on the byte cap (a batch exactly at the cap splits)', () => {
    const [probe] = mintWireOps([sized(1, 0)], MINT)
    // Two ops whose wire bytes sum to EXACTLY the cap must stay together:
    // the chunker splits when adding an op would exceed the cap, not when it
    // would reach it.
    const overhead = wireBytes(probe)
    const payload = Math.floor(WIRE_MAX_BATCH_BYTES / 2) - overhead
    const ops = mintWireOps([sized(1, payload), sized(2, payload)], MINT)
    const total = ops.reduce((sum, op) => sum + wireBytes(op), 0)

    expect(total).toBeLessThanOrEqual(WIRE_MAX_BATCH_BYTES)
    expect(chunkWireOps(ops)).toEqual([ops])

    // One byte more and it must split.
    const over = mintWireOps([sized(1, payload), sized(2, payload + 1)], MINT)
    expect(chunkWireOps(over)).toHaveLength(2)
  })

  it('Kills: dropping the `current.length > 0` guard before the byte flush', () => {
    // A single op larger than the whole cap ships alone. Without the guard the
    // chunker flushes an empty `current` first — harmless today only because
    // `flush` checks emptiness too; if either guard goes, this op is lost or a
    // zero-op batch reaches the transport.
    const ops = mintWireOps([sized(1, WIRE_MAX_BATCH_BYTES + 16)], MINT)

    expect(chunkWireOps(ops)).toEqual([ops])
  })

  it('Kills: dropping the flush before a non-batchable op', () => {
    const ops = mintWireOps(
      [
        sized(1, 8),
        sized(2, 8),
        { op: 'clear', removed_nodes: [1, 2] },
        sized(3, 8)
      ],
      MINT
    )

    const batches = chunkWireOps(ops)

    // The partial batch in front of `clear` must be closed BEFORE the clear
    // ships, or the clear overtakes writes that were minted before it and the
    // host applies them in the wrong order.
    expect(batches.map((batch) => batch.map((op) => op.op))).toEqual([
      ['set_widget', 'set_widget'],
      ['clear'],
      ['set_widget']
    ])
    expect(batches.flat()).toEqual(ops)
  })

  it('Kills: emitting a leading empty batch when the first op is non-batchable', () => {
    const ops = mintWireOps(
      [{ op: 'clear', removed_nodes: [] }, sized(1, 8)],
      MINT
    )

    const batches = chunkWireOps(ops)

    expect(batches.map((batch) => batch.length)).toEqual([1, 1])
  })
})

describe('createOpSender — timer and queue bookkeeping', () => {
  let sent: Op[][]
  let settled: BatchOutcome[]
  let resultListener: ((result: OpsResultView) => void) | null
  let transportUp: boolean
  let sender: ReturnType<typeof createOpSender>

  function addNode(id: number): GraphOperation {
    return {
      op: 'add_node',
      node_id: id,
      class_type: 'TestNode',
      pos: [0, 0],
      node: { id, type: 'TestNode' }
    }
  }

  function ackLast(): void {
    const last = sent.at(-1)
    if (!last) return
    resultListener?.({
      ok: true,
      applied: last.map((op) => op.op_id),
      skipped: []
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
    sent = []
    settled = []
    resultListener = null
    transportUp = true
    sender = createOpSender({
      sendOps: (_workflowId, _tab, ops) => {
        if (!transportUp) return false
        sent.push(ops)
        return true
      },
      onOpsResult: (listener) => {
        resultListener = listener
        return () => {
          resultListener = null
        }
      },
      workflowId: () => 'wf-1',
      tab: 'tab-1',
      actor: () => ACTOR,
      baseVersion: () => 41,
      onBatchSettled: (outcome) => settled.push(outcome)
    })
  })

  afterEach(() => {
    sender.detach()
  })

  // Two redundant guards keep a settled batch's clock away from its successor:
  // `settle` clears the in-flight timer, and the timeout callback re-checks
  // that the batch it fired for is still the in-flight one. Either alone is
  // sufficient, so only the mutant that removes BOTH changes behaviour — which
  // is what this test catches. It is deliberately written against the
  // observable invariant rather than against one guard.
  it('Kills: removing both stale-result-timer guards at once', () => {
    sender.enqueue([addNode(1)])
    expect(sent).toHaveLength(1)

    vi.advanceTimersByTime(5_000)
    ackLast()
    expect(settled).toHaveLength(1)

    sender.enqueue([addNode(2)])
    expect(sent).toHaveLength(2)

    // t = 10s: the FIRST batch's timeout would fire here if it were never
    // cleared. It must not resend, and it must not settle the second batch
    // early on the first batch's clock.
    vi.advanceTimersByTime(5_000)
    expect(sent).toHaveLength(2)
    expect(settled).toHaveLength(1)

    // t = 15s: the second batch's OWN timeout — one resend, same identity.
    vi.advanceTimersByTime(5_000)
    expect(sent).toHaveLength(3)
    expect(sent[2].map((op) => op.op_id)).toEqual(sent[1].map((op) => op.op_id))
  })

  it('Kills: an undeliverable batch that fails to release the queue behind it', () => {
    transportUp = false
    sender.enqueue([addNode(1)])
    sender.enqueue([addNode(2)])
    expect(sender.pending()).toBe(2)

    // Exhaust the first batch's transport retry budget while still down.
    vi.advanceTimersByTime(500 * 6)
    expect(settled).toHaveLength(1)
    expect(settled[0].state).toBe('undeliverable')

    // The second batch must now be in flight and must go out once the
    // transport recovers — a settle that forgot to pump would strand it.
    transportUp = true
    vi.advanceTimersByTime(500 * 6)
    expect(sent).toHaveLength(1)
    const [first] = sent[0]
    expect(first.op === 'add_node' && first.node_id).toBe(2)

    ackLast()
    expect(sender.pending()).toBe(0)
  })

  it('Kills: reading baseVersion() once per sender instead of once per enqueue', () => {
    let version = 10
    const versions: number[] = []
    const host: {
      ack: ((result: OpsResultView) => void) | null
      lastOps: Op[]
    } = { ack: null, lastOps: [] }
    const local = createOpSender({
      sendOps: (_workflowId, _tab, ops) => {
        host.lastOps = ops
        versions.push(...ops.map((op) => op.base_version))
        return true
      },
      onOpsResult: (listener) => {
        host.ack = listener
        return () => undefined
      },
      workflowId: () => 'wf-1',
      tab: 'tab-1',
      actor: () => ACTOR,
      baseVersion: () => version,
      onBatchSettled: () => undefined
    })

    local.enqueue([addNode(1)])
    version = 11
    local.enqueue([addNode(2)])
    // Release the first batch so the second reaches the transport.
    host.ack?.({
      ok: true,
      applied: host.lastOps.map((op) => op.op_id),
      skipped: []
    })

    // Each edit is stamped against the doc version it was actually made
    // against; a cached base_version would backdate every later edit and let
    // the LWW gate drop it against remote writes it did see.
    expect(versions).toEqual([10, 11])
    local.detach()
  })
})

describe('attachWidgetMintPort — interior path construction', () => {
  let minted: GraphOperation[]
  let interiorPaths: Map<string, string[]>
  let listeners: Set<(set: WidgetSetView) => void>

  function deliver(set: WidgetSetView): void {
    for (const listener of listeners) listener(set)
  }

  beforeEach(() => {
    minted = []
    interiorPaths = new Map()
    listeners = new Set()
    attachWidgetMintPort({
      events: {
        onSet: (listener) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        }
      },
      session: createMintSession(),
      isEnabled: () => true,
      isDocBound: () => true,
      rootGraphId: () => 'root-uuid',
      resolveInteriorPath: (owningGraphId) =>
        interiorPaths.get(owningGraphId) ?? null,
      enqueue: (operations) => minted.push(...operations)
    })
  })

  it('Kills: treating an EMPTY resolved path as resolvable', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    interiorPaths.set('subgraph-uuid', [])

    deliver({
      graphId: 'subgraph-uuid',
      nodeId: '27',
      name: 'seed',
      value: 1,
      old: 0
    })

    // An empty chain resolves to no owner at all. Minting it would produce
    // `path: ['27']` — an interior write addressed as if the node sat at the
    // root, which the host would apply to the wrong node.
    expect(minted).toEqual([])
    expect(consoleError).toHaveBeenCalledOnce()
    consoleError.mockRestore()
  })

  it('Kills: an interior path that omits or misorders the terminal node id', () => {
    interiorPaths.set('deep-uuid', ['57', '3'])

    deliver({
      graphId: 'deep-uuid',
      nodeId: '9',
      name: 'seed',
      value: 5,
      old: 4
    })

    // The wire path is the subgraph-node chain from the root FOLLOWED BY the
    // node's own id, in that order.
    expect(minted).toEqual([
      {
        op: 'set_widget',
        node_id: '9',
        widget: 'seed',
        value: 5,
        old: 4,
        path: ['57', '3', '9'],
        inner_widget: 'seed'
      }
    ])
  })

  it('Kills: routing a root-graph write through the interior branch', () => {
    interiorPaths.set('root-uuid', ['57'])

    deliver({
      graphId: 'root-uuid',
      nodeId: '7',
      name: 'seed',
      value: 1,
      old: 0
    })

    // A root write is a plain top-level `set_widget`. If the root check were
    // inverted or dropped, a resolvable root id would mint an interior form
    // and address a node that does not exist at that path.
    expect(minted).toEqual([
      { op: 'set_widget', node_id: '7', widget: 'seed', value: 1, old: 0 }
    ])
  })
})

describe('attachLayoutMintPort — intentional-clear capture', () => {
  const LOCAL_PREFIX = 'user-'
  const LOCAL_ACTOR = 'user-abc123def'

  let minted: GraphOperation[]
  let listeners: Set<(change: LayoutChangeView) => void>
  let port: LayoutMintPort
  let session: MintSession

  function deliver(change: LayoutChangeView): void {
    for (const listener of listeners) listener(change)
  }

  const clearChange: LayoutChangeView = {
    operation: { type: 'clearGraph', actor: LOCAL_ACTOR }
  }

  beforeEach(() => {
    minted = []
    listeners = new Set()
    session = createMintSession()
    port = attachLayoutMintPort({
      changes: {
        onChange: (listener) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        }
      },
      session,
      severedLinks: { take: () => [] },
      localActorPrefix: LOCAL_PREFIX,
      isEnabled: () => true,
      isDocBound: () => true,
      source: {
        serializeNode: () => null,
        nodeIds: () => ['1', '2']
      },
      enqueue: (operations) => minted.push(...operations)
    })
  })

  it('Kills: leaving the capture set after the first clearGraph consumes it', () => {
    port.runIntentionalClear(() => {
      deliver(clearChange)
      // A second clearGraph in the same tick is NOT the user's intentional
      // clear — it is teardown. Keeping the capture would mint a second
      // `clear` carrying a node set that no longer exists.
      deliver(clearChange)
    })

    expect(minted).toEqual([{ op: 'clear', removed_nodes: ['1', '2'] }])
  })

  it('Kills: minting a clear for a teardown that happens to be locally actored', () => {
    session.beginGraphTeardown()
    port.runIntentionalClear(() => deliver(clearChange))
    session.endGraphTeardown()

    // Teardown outranks the intentional-clear capture: a workflow switch that
    // races a user clear must not mint. Fail-closed is the whole point of the
    // bracket.
    expect(minted).toEqual([])
  })
})
