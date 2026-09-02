/**
 * Regression tests for the follower TRANSPORT SEAM — the part of PR #15457 that
 * outlives the disposable projector/diff/mutator spike (ADR-010).
 *
 * Three defects are pinned here, all of them previously unreachable by the
 * existing suite because `docFrameClient.test.ts` uses a transport double that
 * can always send and never throws:
 *
 *   FE-SUBSCRIBE-1  a subscribe attempted before the socket is OPEN was a
 *                   one-shot: the bridge latched its workflow id BEFORE the
 *                   send, the send threw, and the latch then blocked every
 *                   retry. `api` dispatches `reconnected` only on a RE-connect,
 *                   so the first open never repaired it — the follower stayed
 *                   inert for the life of the panel.
 *   FE-TEARDOWN-1   teardown sent an unsubscribe first, so on a closed socket it
 *                   threw before releasing listeners and the Y.Doc, leaving a
 *                   live bridge attached to the canvas; a remount then applied
 *                   every update twice.
 *   FE-KA11-1       nothing read `meta.schema_version`, so a doc written at a
 *                   schema this build does not understand was projected anyway.
 */
import { SCHEMA_VERSION, mint, nodesMap } from '@comfyorg/comfy-multi-player'
import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import type { DocFrameTransport, DocOp, DocUpdate } from './docFrameClient'
import { DocFrameClient, encodeBase64 } from './docFrameClient'
import { LayoutFollowerBridge } from './layoutFollowerBridge'
import { FollowerSchemaError, assertReadableSchema } from './schemaGuard'

const WORKFLOW_ID = 'wf-1'

/**
 * Transport double that models the real socket lifecycle rather than an
 * always-ready pipe: it starts CLOSED (the state `apiTransport` is in while
 * `ComfyApi.createSocket` awaits its auth token) and THROWS on a send while
 * closed — byte-for-byte the behaviour the shipped `apiTransport` had. It also
 * counts live listener registrations so a leak is observable.
 */
class SocketTransport extends EventTarget implements DocFrameTransport {
  open = false
  readonly sent: string[] = []
  private listeners = 0

  send(frame: string): boolean {
    if (!this.open) throw new Error('The ComfyUI WebSocket is not connected')
    this.sent.push(frame)
    return true
  }

  override addEventListener(type: string, listener: EventListener): void {
    this.listeners += 1
    super.addEventListener(type, listener)
  }

  override removeEventListener(type: string, listener: EventListener): void {
    this.listeners -= 1
    super.removeEventListener(type, listener)
  }

  get listenerCount(): number {
    return this.listeners
  }

  /** Simulate a server → client frame arriving on the socket. */
  deliver(type: string, data: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail: data }))
  }

  framesOfType(type: string): unknown[] {
    return this.sent
      .map((frame) => JSON.parse(frame) as { type: string })
      .filter((frame) => frame.type === type)
  }
}

/** A real host doc: seeded by the shared package, so it carries schema v1 meta. */
function hostDocUpdate(mutate?: (doc: Y.Doc) => void): Uint8Array {
  const doc = mint({ nodes: [], links: [] }, { types: {} })
  const node = new Y.Map<unknown>()
  node.set('type', 'LoadImage')
  node.set('pos', [10, 20])
  nodesMap(doc).set('1', node)
  mutate?.(doc)
  return Y.encodeStateAsUpdate(doc)
}

function docUpdateFrame(update: Uint8Array, workflowId = WORKFLOW_ID, seq = 1) {
  return {
    v: 1,
    workflow_id: workflowId,
    seq,
    update_b64: encodeBase64(update)
  }
}

function wire() {
  const transport = new SocketTransport()
  const client = new DocFrameClient(transport)
  const bridge = new LayoutFollowerBridge(client)
  const projected: DocUpdate[] = []
  const schemaErrors: unknown[] = []
  bridge.addEventListener('doc_update', (event) => {
    if (event instanceof CustomEvent) projected.push(event.detail as DocUpdate)
  })
  bridge.addEventListener('schema_error', (event) => {
    if (event instanceof CustomEvent) schemaErrors.push(event.detail)
  })
  return { transport, client, bridge, projected, schemaErrors }
}

describe('FE-SUBSCRIBE-1 — a subscribe raced against socket startup recovers', () => {
  it('retries the subscribe when the socket becomes usable, and then follows', () => {
    const { transport, bridge, projected } = wire()

    // The agent panel mounts while the socket is still being opened.
    bridge.subscribe(WORKFLOW_ID)
    expect(transport.framesOfType('doc_subscribe')).toHaveLength(0)
    expect(bridge.subscribedWorkflowId).toBeNull()
    expect(bridge.hasPendingSubscribe).toBe(true)

    // Updates that arrive before the subscription landed are not followed:
    // the follower is not subscribed, so nothing may be projected.
    transport.deliver('doc_update', docUpdateFrame(hostDocUpdate()))
    expect(projected).toHaveLength(0)

    // The socket opens. This is the FIRST open, so `api` never dispatches
    // `reconnected`; the composition root re-drives intent on socket activity.
    transport.open = true
    bridge.reconcile()

    expect(transport.framesOfType('doc_subscribe')).toHaveLength(1)
    expect(bridge.subscribedWorkflowId).toBe(WORKFLOW_ID)
    expect(bridge.hasPendingSubscribe).toBe(false)

    // And the follower is live: the next frame is applied and re-dispatched.
    transport.deliver('doc_update', docUpdateFrame(hostDocUpdate()))
    expect(projected).toHaveLength(1)
    expect(bridge.follower.updatesApplied).toBe(1)
  })

  it('re-driving intent while already subscribed sends nothing new', () => {
    const { transport, bridge } = wire()
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)
    bridge.reconcile()
    bridge.reconcile()
    expect(transport.framesOfType('doc_subscribe')).toHaveLength(1)
  })

  it('a workflow switch made while the socket is down lands on the next open', () => {
    const { transport, bridge } = wire()
    transport.open = true
    bridge.subscribe('wf-a')
    expect(bridge.subscribedWorkflowId).toBe('wf-a')

    transport.open = false
    bridge.subscribe('wf-b')
    // The old subscription is dropped locally (the server dropped it with the
    // socket), and the new one is still owed.
    expect(bridge.subscribedWorkflowId).toBeNull()
    expect(bridge.hasPendingSubscribe).toBe(true)

    transport.open = true
    bridge.reconcile()
    expect(bridge.subscribedWorkflowId).toBe('wf-b')
    expect(transport.framesOfType('doc_subscribe')).toHaveLength(2)
  })
})

describe('human op gating around subscription acknowledgement', () => {
  it('sends distinct human ops before and after acknowledgement', () => {
    const { transport, bridge } = wire()
    const preAckOp: DocOp = {
      op_id: 'op-before-ack',
      actor: 'human:user:tab-a',
      type: 'node.move'
    }
    const postAckOp: DocOp = {
      op_id: 'op-after-ack',
      actor: 'human:user:tab-a',
      type: 'node.move'
    }
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)

    bridge.sendHumanOps('tab-a', [preAckOp])
    expect(transport.framesOfType('doc_ops')).toEqual([
      {
        type: 'doc_ops',
        data: {
          v: 1,
          workflow_id: WORKFLOW_ID,
          tab: 'tab-a',
          ops: [preAckOp]
        }
      }
    ])

    transport.deliver('doc_subscribed', {
      v: 1,
      workflow_id: WORKFLOW_ID,
      ok: true,
      seq: 1
    })
    bridge.sendHumanOps('tab-a', [postAckOp])

    expect(transport.framesOfType('doc_ops')).toEqual([
      {
        type: 'doc_ops',
        data: {
          v: 1,
          workflow_id: WORKFLOW_ID,
          tab: 'tab-a',
          ops: [preAckOp]
        }
      },
      {
        type: 'doc_ops',
        data: {
          v: 1,
          workflow_id: WORKFLOW_ID,
          tab: 'tab-a',
          ops: [postAckOp]
        }
      }
    ])
  })

  it('stops sending human ops after the host rejects the subscription', () => {
    const { transport, bridge } = wire()
    const preNackOp: DocOp = {
      op_id: 'op-before-nack',
      actor: 'human:user:tab-a',
      type: 'node.move'
    }
    const postNackOp: DocOp = {
      op_id: 'op-after-nack',
      actor: 'human:user:tab-a',
      type: 'node.move'
    }
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)
    bridge.sendHumanOps('tab-a', [preNackOp])

    transport.deliver('doc_subscribed', {
      v: 1,
      workflow_id: WORKFLOW_ID,
      ok: false,
      seq: 0,
      reason: 'not_found'
    })
    bridge.sendHumanOps('tab-a', [postNackOp])

    expect(bridge.subscribedWorkflowId).toBeNull()
    expect(bridge.hasPendingSubscribe).toBe(true)
    expect(transport.framesOfType('doc_ops')).toEqual([
      {
        type: 'doc_ops',
        data: {
          v: 1,
          workflow_id: WORKFLOW_ID,
          tab: 'tab-a',
          ops: [preNackOp]
        }
      }
    ])
  })
})

describe('FE-TEARDOWN-1 — teardown completes with a dead socket', () => {
  it('releases every transport listener and the doc when unsubscribe cannot send', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { transport, client, bridge, projected } = wire()
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)
    expect(transport.listenerCount).toBe(5)

    // Backend restarts, then the user closes the agent panel.
    transport.open = false
    expect(() => {
      bridge.destroy()
      client.destroy()
    }).not.toThrow()

    expect(transport.listenerCount).toBe(0)
    expect(bridge.subscribedWorkflowId).toBeNull()

    // The torn-down bridge is inert: a frame arriving after the socket recovers
    // must not reach it. A bridge that survived here would double-apply every
    // update against the projector still wired to the live canvas.
    transport.open = true
    transport.deliver('doc_update', docUpdateFrame(hostDocUpdate()))
    expect(projected).toHaveLength(0)
    expect(bridge.follower.updatesApplied).toBe(0)
    warn.mockRestore()
  })

  it('a doc_update delivered mid-teardown cannot resurrect the follower', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { transport, client, bridge, projected } = wire()
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)
    transport.open = false
    bridge.destroy()
    client.destroy()
    transport.open = true

    // Re-mounting builds a SECOND client/bridge pair. Only it may follow.
    const second = wire()
    second.transport.open = true
    second.bridge.subscribe(WORKFLOW_ID)
    transport.deliver('doc_update', docUpdateFrame(hostDocUpdate()))
    second.transport.deliver('doc_update', docUpdateFrame(hostDocUpdate()))

    expect(projected).toHaveLength(0)
    expect(second.projected).toHaveLength(1)
    warn.mockRestore()
  })
})

describe('doc_reset — a lineage break drops the doc and resubscribes from zero', () => {
  it('replaces the follower doc and resubscribes with an empty state vector', () => {
    const { transport, bridge, projected } = wire()
    const resets: unknown[] = []
    let followerSeenDuringReset: unknown = null
    bridge.addEventListener('doc_reset', (event) => {
      if (event instanceof CustomEvent) {
        resets.push(event.detail)
        followerSeenDuringReset = bridge.follower
      }
    })
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)
    transport.deliver('doc_update', docUpdateFrame(hostDocUpdate()))
    const oldDoc = bridge.follower
    expect(oldDoc.updatesApplied).toBe(1)

    transport.deliver('doc_reset', { v: 1, workflow_id: WORKFLOW_ID, seq: 43 })

    // The old lineage is dropped wholesale, never folded into.
    expect(bridge.follower).not.toBe(oldDoc)
    expect(bridge.follower.updatesApplied).toBe(0)
    expect(bridge.follower.doc.getMap('nodes').size).toBe(0)
    expect(resets).toEqual([{ workflowId: WORKFLOW_ID, seq: 43 }])
    expect(followerSeenDuringReset).toBe(oldDoc)

    // The resubscribe carries the FRESH doc's state vector — the empty one —
    // so the server's ordinary catch-up path returns the full folded state.
    const subscribes = transport.framesOfType('doc_subscribe') as {
      data: { state_vector_b64: string }
    }[]
    expect(subscribes).toHaveLength(2)
    expect(subscribes[1].data.state_vector_b64).toBe(
      encodeBase64(Y.encodeStateVector(new Y.Doc()))
    )
    expect(bridge.subscribedWorkflowId).toBe(WORKFLOW_ID)

    // The next update lands on the fresh lineage and is projected.
    transport.deliver('doc_update', docUpdateFrame(hostDocUpdate()))
    expect(bridge.follower.updatesApplied).toBe(1)
    expect(projected).toHaveLength(2)

    // KA-6: a reset provokes nothing but subscription frames from the follower.
    const writes = transport.sent
      .map((frame) => JSON.parse(frame) as { type: string })
      .filter(
        (frame) =>
          frame.type !== 'doc_subscribe' && frame.type !== 'doc_unsubscribe'
      )
    expect(writes).toEqual([])
  })

  it('ignores a reset for a workflow it does not follow', () => {
    const { transport, bridge } = wire()
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)
    transport.deliver('doc_update', docUpdateFrame(hostDocUpdate()))
    const oldDoc = bridge.follower

    transport.deliver('doc_reset', { v: 1, workflow_id: 'wf-other', seq: 9 })

    expect(bridge.follower).toBe(oldDoc)
    expect(bridge.follower.updatesApplied).toBe(1)
    expect(transport.framesOfType('doc_subscribe')).toHaveLength(1)
  })

  it('a reset on a dead socket still drops the doc; the resubscribe lands on the next reconcile', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { transport, bridge } = wire()
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)
    transport.deliver('doc_update', docUpdateFrame(hostDocUpdate()))

    transport.open = false
    transport.deliver('doc_reset', { v: 1, workflow_id: WORKFLOW_ID, seq: 43 })

    // The lineage break is honoured even though the resubscribe cannot leave.
    expect(bridge.follower.updatesApplied).toBe(0)
    expect(bridge.subscribedWorkflowId).toBeNull()
    expect(bridge.hasPendingSubscribe).toBe(true)

    transport.open = true
    bridge.reconcile()
    expect(bridge.subscribedWorkflowId).toBe(WORKFLOW_ID)
    expect(transport.framesOfType('doc_subscribe')).toHaveLength(2)
    warn.mockRestore()
  })
})

describe('FE-GAP-1 — a seq jump means a dropped frame and forces a resync', () => {
  it('applies the catch-up update when its seq equals the preceding subscribe acknowledgement', () => {
    const { transport, bridge, projected } = wire()
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)
    transport.deliver('doc_subscribed', {
      v: 1,
      workflow_id: WORKFLOW_ID,
      ok: true,
      seq: 1
    })
    // The ack alone already tells the follower where the host is…
    expect(bridge.lastSequence).toBe(1)

    // …but the host then sends the catch-up AT that seq, and it must land:
    // treating the ack as an applied baseline dropped this frame as stale and
    // left the follower with an empty doc (the KA-11 schema_version=undefined
    // symptom on nightly).
    transport.deliver(
      'doc_update',
      docUpdateFrame(hostDocUpdate(), WORKFLOW_ID, 1)
    )

    expect(projected).toHaveLength(1)
    expect(bridge.follower.updatesApplied).toBe(1)
    expect(bridge.lastSequence).toBe(1)
    expect(transport.framesOfType('doc_subscribe')).toHaveLength(1)
    expect(nodesMap(bridge.follower.doc).get('1')?.toJSON()).toEqual({
      type: 'LoadImage',
      pos: [10, 20]
    })
  })

  it('an already-current follower gets an ack and no catch-up, and stays live from the ack seq', () => {
    const { transport, bridge, projected } = wire()
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)
    transport.deliver('doc_subscribed', {
      v: 1,
      workflow_id: WORKFLOW_ID,
      ok: true,
      seq: 7
    })

    // No doc_update follows (the state vector already covered everything), so
    // the outbound op baseVersion must come from the ack, not sit at 0.
    expect(bridge.lastSequence).toBe(7)

    // The next LIVE frame is contiguous with the ack: applied, no resubscribe.
    transport.deliver(
      'doc_update',
      docUpdateFrame(hostDocUpdate(), WORKFLOW_ID, 8)
    )
    expect(projected).toHaveLength(1)
    expect(bridge.lastSequence).toBe(8)
    expect(transport.framesOfType('doc_subscribe')).toHaveLength(1)
  })

  it('arms the gap detector from the ack: a first frame beyond ack+1 forces a resync', () => {
    const { transport, bridge, projected } = wire()
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)
    transport.deliver('doc_subscribed', {
      v: 1,
      workflow_id: WORKFLOW_ID,
      ok: true,
      seq: 1
    })

    // Both the catch-up (1) and the first live frame (2) were lost.
    transport.deliver(
      'doc_update',
      docUpdateFrame(hostDocUpdate(), WORKFLOW_ID, 3)
    )

    expect(projected).toHaveLength(0)
    expect(bridge.follower.updatesApplied).toBe(0)
    expect(transport.framesOfType('doc_subscribe')).toHaveLength(2)
    expect(bridge.subscribedWorkflowId).toBe(WORKFLOW_ID)
  })

  it('s5-metrics-1: dispatches doc_gap at the exact boundary a jump is detected', () => {
    const { transport, bridge } = wire()
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)
    transport.deliver('doc_subscribed', {
      v: 1,
      workflow_id: WORKFLOW_ID,
      ok: true,
      seq: 1
    })

    const gaps: unknown[] = []
    bridge.addEventListener('doc_gap', (event) => {
      gaps.push((event as CustomEvent).detail)
    })

    transport.deliver(
      'doc_update',
      docUpdateFrame(hostDocUpdate(), WORKFLOW_ID, 3)
    )

    expect(gaps).toEqual([
      { workflowId: WORKFLOW_ID, expected: 2, received: 3 }
    ])
  })

  it('an update that beats the ack to the follower keeps its baseline when the ack lands', () => {
    const { transport, bridge, projected } = wire()
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)

    // The host joined the fanout before acking, so a live frame can overtake
    // the acknowledgement on the wire.
    transport.deliver(
      'doc_update',
      docUpdateFrame(hostDocUpdate(), WORKFLOW_ID, 5)
    )
    expect(bridge.lastSequence).toBe(5)

    transport.deliver('doc_subscribed', {
      v: 1,
      workflow_id: WORKFLOW_ID,
      ok: true,
      seq: 4
    })

    // The ack never rewinds an applied baseline…
    expect(bridge.lastSequence).toBe(5)
    // …so the frame it announced is a duplicate here, and 6 is the next one.
    transport.deliver(
      'doc_update',
      docUpdateFrame(hostDocUpdate(), WORKFLOW_ID, 5)
    )
    transport.deliver(
      'doc_update',
      docUpdateFrame(hostDocUpdate(), WORKFLOW_ID, 6)
    )
    expect(projected).toHaveLength(2)
    expect(bridge.lastSequence).toBe(6)
    expect(transport.framesOfType('doc_subscribe')).toHaveLength(1)
  })

  it('still applies the catch-up (seq == ack) after a live frame beat the ack, then stays live', () => {
    const { transport, bridge, projected } = wire()
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)

    // doc_relay.go handleDocSubscribe: join the fanout, THEN ack (seq=N), THEN
    // the catch-up carrying that same seq N. The fanout writes from another
    // goroutine, so live N+1 can reach the follower before the ack. The
    // catch-up is the only frame holding what the follower's state vector
    // lacked; dropping it as "stale" (N <= N+1) leaves a hole no later seq
    // ever reveals.
    transport.deliver(
      'doc_update',
      docUpdateFrame(
        hostDocUpdate((doc) => {
          const node = new Y.Map<unknown>()
          node.set('type', 'SaveImage')
          nodesMap(doc).set('2', node)
        }),
        WORKFLOW_ID,
        5
      )
    )
    expect(bridge.lastSequence).toBe(5)

    transport.deliver('doc_subscribed', {
      v: 1,
      workflow_id: WORKFLOW_ID,
      ok: true,
      seq: 4
    })
    expect(bridge.lastSequence).toBe(5)

    const catchUp = hostDocUpdate((doc) => {
      const node = new Y.Map<unknown>()
      node.set('type', 'PreviewImage')
      nodesMap(doc).set('3', node)
    })
    transport.deliver('doc_update', docUpdateFrame(catchUp, WORKFLOW_ID, 4))
    expect(bridge.follower.updatesApplied).toBe(2)
    expect(nodesMap(bridge.follower.doc).get('3')?.toJSON()).toEqual({
      type: 'PreviewImage'
    })
    // The catch-up never rewinds the applied baseline.
    expect(bridge.lastSequence).toBe(5)

    // The catch-up window is one frame: a second seq-4 replay is stale again.
    transport.deliver('doc_update', docUpdateFrame(catchUp, WORKFLOW_ID, 4))
    expect(bridge.follower.updatesApplied).toBe(2)

    // 6 is contiguous with the applied baseline — no spurious resync.
    transport.deliver(
      'doc_update',
      docUpdateFrame(hostDocUpdate(), WORKFLOW_ID, 6)
    )
    expect(projected).toHaveLength(3)
    expect(bridge.lastSequence).toBe(6)
    expect(transport.framesOfType('doc_subscribe')).toHaveLength(1)
  })

  it('a resubscribe forgets the previous ack so the new catch-up re-baselines', () => {
    const { transport, bridge, projected } = wire()
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)
    transport.deliver('doc_subscribed', {
      v: 1,
      workflow_id: WORKFLOW_ID,
      ok: true,
      seq: 10
    })
    expect(bridge.lastSequence).toBe(10)

    bridge.resubscribe()
    expect(bridge.lastSequence).toBe(0)

    // Whatever the new ack says is the new arming point.
    transport.deliver('doc_subscribed', {
      v: 1,
      workflow_id: WORKFLOW_ID,
      ok: true,
      seq: 12
    })
    transport.deliver(
      'doc_update',
      docUpdateFrame(hostDocUpdate(), WORKFLOW_ID, 12)
    )
    expect(projected).toHaveLength(1)
    expect(bridge.lastSequence).toBe(12)
    expect(transport.framesOfType('doc_subscribe')).toHaveLength(2)
  })

  it('applies contiguous seqs without resubscribing', () => {
    const { transport, bridge, projected } = wire()
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)
    transport.deliver('doc_subscribed', {
      v: 1,
      workflow_id: WORKFLOW_ID,
      ok: true,
      seq: 1
    })

    transport.deliver(
      'doc_update',
      docUpdateFrame(hostDocUpdate(), WORKFLOW_ID, 2)
    )
    transport.deliver(
      'doc_update',
      docUpdateFrame(hostDocUpdate(), WORKFLOW_ID, 3)
    )

    expect(projected).toHaveLength(2)
    expect(transport.framesOfType('doc_subscribe')).toHaveLength(1)
  })

  it('withholds the gapped frame, retains the exact doc, and replays from its state vector', () => {
    const { transport, bridge, projected } = wire()
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)
    transport.deliver('doc_subscribed', {
      v: 1,
      workflow_id: WORKFLOW_ID,
      ok: true,
      seq: 1
    })

    transport.deliver(
      'doc_update',
      docUpdateFrame(hostDocUpdate(), WORKFLOW_ID, 2)
    )
    const retained = bridge.follower
    const retainedVector = encodeBase64(retained.stateVector())

    transport.deliver(
      'doc_update',
      docUpdateFrame(hostDocUpdate(), WORKFLOW_ID, 4)
    )

    expect(projected).toHaveLength(1)
    expect(bridge.follower).toBe(retained)
    expect(bridge.follower.updatesApplied).toBe(1)
    expect(transport.framesOfType('doc_subscribe')).toHaveLength(2)
    expect(bridge.subscribedWorkflowId).toBe(WORKFLOW_ID)

    // ADR-0024: an ordinary gap is same-lineage state-vector replay. Only a
    // separately delivered doc_reset may replace the document.
    const gapSubscribes = transport.framesOfType('doc_subscribe') as {
      data: { state_vector_b64: string }
    }[]
    expect(gapSubscribes[1].data.state_vector_b64).toBe(retainedVector)

    // The resubscribe re-baselined: the catch-up frame lands whatever its seq.
    transport.deliver(
      'doc_update',
      docUpdateFrame(hostDocUpdate(), WORKFLOW_ID, 4)
    )
    expect(projected).toHaveLength(2)
    expect(bridge.follower).toBe(retained)
    expect(transport.framesOfType('doc_subscribe')).toHaveLength(2)
  })

  it('ignores a duplicate or stale seq and provokes no resubscribe', () => {
    const { transport, bridge, projected } = wire()
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)

    transport.deliver(
      'doc_update',
      docUpdateFrame(hostDocUpdate(), WORKFLOW_ID, 2)
    )
    transport.deliver(
      'doc_update',
      docUpdateFrame(hostDocUpdate(), WORKFLOW_ID, 2)
    )

    expect(projected).toHaveLength(1)
    expect(bridge.follower.updatesApplied).toBe(1)
    expect(transport.framesOfType('doc_subscribe')).toHaveLength(1)
  })

  it('s5-metrics-1: dispatches doc_stale at the exact boundary a duplicate is discarded', () => {
    const { transport, bridge } = wire()
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)

    transport.deliver(
      'doc_update',
      docUpdateFrame(hostDocUpdate(), WORKFLOW_ID, 2)
    )

    const stale: unknown[] = []
    bridge.addEventListener('doc_stale', (event) => {
      stale.push((event as CustomEvent).detail)
    })

    transport.deliver(
      'doc_update',
      docUpdateFrame(hostDocUpdate(), WORKFLOW_ID, 2)
    )

    expect(stale).toEqual([{ workflowId: WORKFLOW_ID, seq: 2 }])
  })

  it('clears send reality BEFORE re-dispatching the refusal, so listeners observe the unbind synchronously', () => {
    // useAgentCrdtFollower's onSubscribed calls sender.abortIfUnbound() inside
    // this listener and relies on reading a null binding at that moment.
    const { transport, bridge } = wire()
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)
    const seenDuringDispatch: Array<string | null> = []
    bridge.addEventListener('doc_subscribed', () => {
      seenDuringDispatch.push(bridge.subscribedWorkflowId)
    })

    transport.deliver('doc_subscribed', {
      v: 1,
      workflow_id: WORKFLOW_ID,
      ok: false,
      code: 'not_found'
    })

    expect(seenDuringDispatch).toEqual([null])
  })

  it('a refused subscribe re-opens intent so the next reconcile retries', () => {
    const { transport, bridge } = wire()
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)
    expect(bridge.subscribedWorkflowId).toBe(WORKFLOW_ID)

    transport.deliver('doc_subscribed', {
      v: 1,
      workflow_id: WORKFLOW_ID,
      ok: false,
      code: 'not_found'
    })

    expect(bridge.subscribedWorkflowId).toBeNull()
    expect(bridge.hasPendingSubscribe).toBe(true)

    // The composition root drives reconcile on every status frame.
    bridge.reconcile()
    expect(bridge.subscribedWorkflowId).toBe(WORKFLOW_ID)
    expect(transport.framesOfType('doc_subscribe')).toHaveLength(2)
  })

  it('ignores a late acknowledgement for the previous workflow', () => {
    const { transport, bridge } = wire()
    transport.open = true
    bridge.subscribe('wf-a')
    bridge.subscribe('wf-b')

    const forwarded: unknown[] = []
    bridge.addEventListener('doc_subscribed', (event) => {
      if (event instanceof CustomEvent) forwarded.push(event.detail)
    })
    transport.deliver('doc_subscribed', {
      v: 1,
      workflow_id: 'wf-a',
      ok: true,
      seq: 9
    })

    expect(forwarded).toEqual([])
    expect(bridge.subscribedWorkflowId).toBe('wf-b')
  })
})

describe('FE-KA11-1 — the read-time schema gate fails closed', () => {
  it('accepts a doc the shared package seeded at the version this build reads', () => {
    const { transport, bridge, projected, schemaErrors } = wire()
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)

    transport.deliver('doc_update', docUpdateFrame(hostDocUpdate()))

    expect(projected).toHaveLength(1)
    expect(schemaErrors).toHaveLength(0)
    expect(bridge.lastSchemaError).toBeNull()
  })

  it('refuses to project a doc whose schema_version is newer than this build', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { transport, bridge, projected, schemaErrors } = wire()
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)

    const newerSchema = hostDocUpdate((doc) =>
      doc.getMap('meta').set('schema_version', SCHEMA_VERSION + 1)
    )
    transport.deliver('doc_update', docUpdateFrame(newerSchema))

    // Fail CLOSED: the frame is never re-dispatched, so nothing renders.
    expect(projected).toHaveLength(0)
    // …and the failure is distinguishable, not a silent "disconnected".
    expect(schemaErrors).toEqual([
      { workflowId: WORKFLOW_ID, found: SCHEMA_VERSION + 1 }
    ])
    expect(bridge.lastSchemaError).toBeInstanceOf(FollowerSchemaError)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  it('retains a schema error after a compatible continuation resumes dispatch', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { transport, bridge, projected, schemaErrors } = wire()
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)

    const host = initDoc(new Y.Doc())
    const incompatibleNode = new Y.Map<unknown>()
    incompatibleNode.set('type', 'SchemaV2Node')
    nodesMap(host).set('incompatible', incompatibleNode)
    metaMap(host).set('schema_version', 2)
    const incompatibleUpdate = Y.encodeStateAsUpdate(host)
    const incompatibleState = Y.encodeStateVector(host)
    const follower = bridge.follower

    transport.deliver('doc_update', docUpdateFrame(incompatibleUpdate))

    const retainedError = bridge.lastSchemaError
    expect(retainedError).toBeInstanceOf(FollowerSchemaError)
    expect(nodesMap(follower.doc).get('incompatible')?.get('type')).toBe(
      'SchemaV2Node'
    )
    expect(projected).toHaveLength(0)

    metaMap(host).set('schema_version', 1)
    const compatibleNode = new Y.Map<unknown>()
    compatibleNode.set('type', 'SchemaV1Node')
    nodesMap(host).set('compatible', compatibleNode)
    const compatibleUpdate = Y.encodeStateAsUpdate(host, incompatibleState)
    transport.deliver(
      'doc_update',
      docUpdateFrame(compatibleUpdate, WORKFLOW_ID, 2)
    )

    expect(bridge.follower).toBe(follower)
    expect(nodesMap(follower.doc).get('incompatible')?.get('type')).toBe(
      'SchemaV2Node'
    )
    expect(nodesMap(follower.doc).get('compatible')?.get('type')).toBe(
      'SchemaV1Node'
    )
    expect(projected).toEqual([
      expect.objectContaining({ seq: 2, update: compatibleUpdate })
    ])
    expect(schemaErrors).toEqual([{ workflowId: WORKFLOW_ID, found: 2 }])
    expect(bridge.lastSchemaError).toBe(retainedError)
    expect(transport.framesOfType('doc_subscribe')).toHaveLength(1)
    error.mockRestore()
  })

  it('refuses a doc that declares no schema_version at all', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { transport, bridge, projected, schemaErrors } = wire()
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)

    // Not a document this reader understands: no meta at all.
    const stranger = new Y.Doc()
    stranger.getMap('nodes').set('1', { type: 'LoadImage' })
    transport.deliver(
      'doc_update',
      docUpdateFrame(Y.encodeStateAsUpdate(stranger))
    )

    expect(projected).toHaveLength(0)
    expect(schemaErrors).toEqual([
      { workflowId: WORKFLOW_ID, found: undefined }
    ])
    error.mockRestore()
  })

  it('reads the version through the package public API, not a local copy', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const doc = mint({ nodes: [], links: [] }, { types: {} })
    expect(() => {
      assertReadableSchema(doc)
    }).not.toThrow()

    doc.getMap('meta').set('schema_version', 99)
    expect(() => {
      assertReadableSchema(doc)
    }).toThrow(FollowerSchemaError)
    expect(() => {
      assertReadableSchema(doc)
    }).toThrow(/KA-11/)
    error.mockRestore()
  })
})

describe('FEB-5 — switching workflows is a lineage break, never a fold', () => {
  it('replaces the doc and subscribes from an EMPTY state vector on switch', () => {
    const { transport, bridge } = wire()
    const replaced: unknown[] = []
    const switchEvents: string[] = []
    const send = transport.send.bind(transport)
    vi.spyOn(transport, 'send').mockImplementation((frame) => {
      const { type, data } = JSON.parse(frame) as {
        type: string
        data?: { workflow_id?: string }
      }
      if (type === 'doc_subscribe' && data?.workflow_id === 'wf-2')
        switchEvents.push('subscribe')
      return send(frame)
    })
    bridge.addEventListener('follower_replaced', (event) => {
      if (event instanceof CustomEvent) {
        replaced.push(event.detail)
        switchEvents.push('replaced')
      }
    })
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)
    transport.deliver('doc_update', docUpdateFrame(hostDocUpdate()))
    const oldDoc = bridge.follower
    expect(oldDoc.updatesApplied).toBe(1)

    bridge.subscribe('wf-2')

    // The old lineage is dropped wholesale — wf-2's history is never folded
    // into wf-1's doc, which would put both workflows' nodes on one canvas.
    expect(bridge.follower).not.toBe(oldDoc)
    expect(bridge.follower.updatesApplied).toBe(0)
    expect(bridge.follower.doc.getMap('nodes').size).toBe(0)
    expect(replaced).toEqual([{ workflowId: 'wf-2' }])
    expect(switchEvents).toEqual(['replaced', 'subscribe'])

    // The old subscription is released, and the new subscribe carries the
    // FRESH doc's state vector — the empty one — never wf-1's, which the host
    // would use to compute a nonsense delta against wf-2's history.
    expect(transport.framesOfType('doc_unsubscribe')).toHaveLength(1)
    const subscribes = transport.framesOfType('doc_subscribe') as {
      data: { workflow_id: string; state_vector_b64: string }
    }[]
    expect(subscribes).toHaveLength(2)
    expect(subscribes[1].data.workflow_id).toBe('wf-2')
    expect(subscribes[1].data.state_vector_b64).toBe(
      encodeBase64(Y.encodeStateVector(new Y.Doc()))
    )

    // The next wf-2 update lands on the fresh lineage.
    transport.deliver('doc_update', docUpdateFrame(hostDocUpdate(), 'wf-2'))
    expect(bridge.follower.updatesApplied).toBe(1)
  })

  it('re-subscribing to the SAME workflow keeps the doc (same-lineage catch-up)', () => {
    const { transport, bridge } = wire()
    const replaced: unknown[] = []
    bridge.addEventListener('follower_replaced', (event) => {
      replaced.push(event)
    })
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)
    transport.deliver('doc_update', docUpdateFrame(hostDocUpdate()))
    const oldDoc = bridge.follower

    bridge.subscribe(WORKFLOW_ID)
    bridge.resubscribe()

    expect(bridge.follower).toBe(oldDoc)
    expect(bridge.follower.updatesApplied).toBe(1)
    expect(replaced).toEqual([])
  })

  it('a detach then a switch still breaks lineage: unsubscribe does not empty the doc', () => {
    const { transport, bridge } = wire()
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)
    transport.deliver('doc_update', docUpdateFrame(hostDocUpdate()))
    const oldDoc = bridge.follower

    bridge.unsubscribe()
    bridge.subscribe('wf-2')

    expect(bridge.follower).not.toBe(oldDoc)
    expect(bridge.follower.updatesApplied).toBe(0)
  })

  it('a switch on a dead socket still replaces the doc and announces it', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { transport, bridge } = wire()
    const replaced: unknown[] = []
    bridge.addEventListener('follower_replaced', (event) => {
      if (event instanceof CustomEvent) replaced.push(event.detail)
    })
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)
    transport.deliver('doc_update', docUpdateFrame(hostDocUpdate()))

    transport.open = false
    bridge.subscribe('wf-2')

    // The lineage break is honoured even though the subscribe cannot leave,
    // and consumers are told to rebind — the old doc is destroyed.
    expect(bridge.follower.updatesApplied).toBe(0)
    expect(replaced).toEqual([{ workflowId: 'wf-2' }])
    expect(bridge.subscribedWorkflowId).toBeNull()
    expect(bridge.hasPendingSubscribe).toBe(true)

    transport.open = true
    bridge.reconcile()
    expect(bridge.subscribedWorkflowId).toBe('wf-2')
  })
})
