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

import type { DocFrameTransport, DocUpdate } from './docFrameClient'
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
    bridge.addEventListener('doc_reset', (event) => {
      if (event instanceof CustomEvent) resets.push(event.detail)
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

  it('does not apply the gapped frame, retains the doc, and replays via its state vector', () => {
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
    const docBeforeGap = bridge.follower
    expect(docBeforeGap.updatesApplied).toBe(1)

    transport.deliver(
      'doc_update',
      docUpdateFrame(hostDocUpdate(), WORKFLOW_ID, 4)
    )

    // The gapped frame is not applied - Yjs would only buffer it against its
    // missing dependencies - but an ordinary gap is NOT lineage evidence:
    // the doc is RETAINED and the resubscribe carries its real state vector,
    // so the server returns a delta instead of the full state.
    expect(projected).toHaveLength(1)
    expect(bridge.follower).toBe(docBeforeGap)
    const gapSubscribes = transport.framesOfType('doc_subscribe') as {
      data: { state_vector_b64: string }
    }[]
    expect(gapSubscribes).toHaveLength(2)
    expect(gapSubscribes[1].data.state_vector_b64).toBe(
      encodeBase64(docBeforeGap.stateVector())
    )
    expect(gapSubscribes[1].data.state_vector_b64).not.toBe(
      encodeBase64(Y.encodeStateVector(new Y.Doc()))
    )
    expect(bridge.subscribedWorkflowId).toBe(WORKFLOW_ID)

    // Same-lineage confirmation (seq did not regress): the catch-up lands on
    // the retained doc.
    transport.deliver('doc_subscribed', {
      v: 1,
      workflow_id: WORKFLOW_ID,
      ok: true,
      seq: 4
    })
    transport.deliver(
      'doc_update',
      docUpdateFrame(hostDocUpdate(), WORKFLOW_ID, 5)
    )
    expect(bridge.follower).toBe(docBeforeGap)
    expect(projected).toHaveLength(2)
    expect(transport.framesOfType('doc_subscribe')).toHaveLength(2)
  })

  it('a missed doc_reset is caught as a seq regression and refetched from zero', () => {
    const { transport, bridge } = wire()
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)
    transport.deliver('doc_subscribed', {
      v: 1,
      workflow_id: WORKFLOW_ID,
      ok: true,
      seq: 41
    })
    transport.deliver(
      'doc_update',
      docUpdateFrame(hostDocUpdate(), WORKFLOW_ID, 42)
    )
    const oldLineage = bridge.follower

    // A gap provokes the retained-doc replay...
    transport.deliver(
      'doc_update',
      docUpdateFrame(hostDocUpdate(), WORKFLOW_ID, 44)
    )
    expect(bridge.follower).toBe(oldLineage)

    // ...but the catch-up's snapshot seq is BELOW the lineage floor: the doc
    // was re-minted behind the missed reset. It is dropped BEFORE any folded
    // catch-up update can apply, and the refetch starts from the empty vector.
    transport.deliver('doc_subscribed', {
      v: 1,
      workflow_id: WORKFLOW_ID,
      ok: true,
      seq: 2
    })
    expect(bridge.follower).not.toBe(oldLineage)
    expect(bridge.follower.updatesApplied).toBe(0)
    const subscribes = transport.framesOfType('doc_subscribe') as {
      data: { state_vector_b64: string }
    }[]
    expect(subscribes).toHaveLength(3)
    expect(subscribes[2].data.state_vector_b64).toBe(
      encodeBase64(Y.encodeStateVector(new Y.Doc()))
    )
  })

  it('a duplicate or stale seq is still applied and provokes no resubscribe', () => {
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

    expect(projected).toHaveLength(2)
    expect(transport.framesOfType('doc_subscribe')).toHaveLength(1)
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
})

describe('workflow switch and lost-frame recovery', () => {
  it('a workflow switch replaces the follower doc and subscribes from the new baseline', () => {
    const { transport, bridge } = wire()
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)
    transport.deliver('doc_update', docUpdateFrame(hostDocUpdate()))
    const oldDoc = bridge.follower
    expect(oldDoc.updatesApplied).toBe(1)

    bridge.subscribe('wf-2')

    // Workflow B's updates must never merge into workflow A's document: the
    // doc is replaced with the projection reset owned by the same watch, and
    // the new subscribe starts from B's own (empty) baseline.
    expect(bridge.follower).not.toBe(oldDoc)
    expect(bridge.follower.updatesApplied).toBe(0)
    expect(transport.framesOfType('doc_unsubscribe')).toHaveLength(1)
    const subscribes = transport.framesOfType('doc_subscribe') as {
      data: { workflow_id: string; state_vector_b64: string }
    }[]
    expect(subscribes).toHaveLength(2)
    expect(subscribes[1].data.workflow_id).toBe('wf-2')
    expect(subscribes[1].data.state_vector_b64).toBe(
      encodeBase64(Y.encodeStateVector(new Y.Doc()))
    )
  })

  it('an undecodable doc_update reports frame_error and replays the same lineage', () => {
    const { transport, bridge } = wire()
    const failures: unknown[] = []
    bridge.addEventListener('frame_error', (event) => {
      if (event instanceof CustomEvent) failures.push(event.detail)
    })
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)
    transport.deliver('doc_update', docUpdateFrame(hostDocUpdate()))
    const doc = bridge.follower

    transport.deliver('doc_update', {
      v: 1,
      workflow_id: WORKFLOW_ID,
      seq: 2,
      update_b64: '@@@not-base64@@@'
    })

    // The frame's bytes are lost, so the doc has a hole only a same-lineage
    // state-vector replay can fill. The document itself is never replaced.
    expect(failures).toEqual([
      { workflowId: WORKFLOW_ID, reason: 'decode_failed' }
    ])
    expect(bridge.follower).toBe(doc)
    expect(doc.updatesApplied).toBe(1)
    const subscribes = transport.framesOfType('doc_subscribe') as {
      data: { state_vector_b64: string }
    }[]
    expect(subscribes).toHaveLength(2)
    expect(subscribes[1].data.state_vector_b64).toBe(
      encodeBase64(doc.stateVector())
    )
  })

  it('a doc_update whose bytes fail to apply reports frame_error and replays', () => {
    const { transport, bridge } = wire()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const failures: unknown[] = []
    bridge.addEventListener('frame_error', (event) => {
      if (event instanceof CustomEvent) failures.push(event.detail)
    })
    transport.open = true
    bridge.subscribe(WORKFLOW_ID)
    transport.deliver('doc_update', docUpdateFrame(hostDocUpdate()))
    const doc = bridge.follower

    transport.deliver(
      'doc_update',
      docUpdateFrame(new Uint8Array([7, 7, 7]), WORKFLOW_ID, 2)
    )

    expect(failures).toEqual([
      { workflowId: WORKFLOW_ID, reason: 'apply_failed' }
    ])
    expect(bridge.follower).toBe(doc)
    expect(transport.framesOfType('doc_subscribe')).toHaveLength(2)
    warn.mockRestore()
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
