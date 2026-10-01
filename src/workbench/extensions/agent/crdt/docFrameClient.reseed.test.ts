/**
 * Stale-schema reseed on subscribe, the client and bridge half.
 *
 * A stored document the server can no longer read (an older document schema)
 * is re-minted from the canvas this tab shows: the subscribe advertises that
 * it can do that, the server refuses it with `stale_schema_reseed_required`,
 * the follower sends `doc_reseed` with its canvas, and the answer is a
 * `doc_reseed_result`. The bridge treats a successful (or lost-race) answer
 * as a lineage reset: the replaced document is a new lineage, and this tab was
 * refused, so it never saw the server's `doc_reset`.
 */
import { describe, expect, it, vi } from 'vitest'

import type { DocFrameTransport } from './docFrameClient'
import { DocFrameClient, parseServerDocFrame } from './docFrameClient'
import { STALE_SCHEMA_RESEED_REQUIRED } from './docFrameCodes'
import { LayoutFollowerBridge } from './layoutFollowerBridge'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

class TestTransport extends EventTarget implements DocFrameTransport {
  readonly sent: string[] = []

  send(frame: string): boolean {
    this.sent.push(frame)
    return true
  }

  receive(type: string, data: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail: data }))
  }

  frames(type: string): Record<string, unknown>[] {
    return this.sent
      .map((frame) => JSON.parse(frame) as { type: string; data: unknown })
      .filter((frame) => frame.type === type)
      .map((frame) => frame.data as Record<string, unknown>)
  }
}

const canvas = {
  last_node_id: 1,
  nodes: [{ id: 1, type: 'CheckpointLoaderSimple' }],
  links: []
}

describe('doc frame client: stale-schema reseed', () => {
  it('encodes a doc_reseed carrying the canvas', () => {
    const transport = new TestTransport()
    const client = new DocFrameClient(transport)
    expect(client.reseed('wf-1', 7, canvas)).toBe(true)
    expect(transport.frames('doc_reseed')).toEqual([
      { v: 1, workflow_id: 'wf-1', expected_seq: 7, workflow: canvas }
    ])
  })

  // Inbound frames are bounded by the relay's own 8 MiB field cap, and the
  // whole canvas is the one outbound frame a user can grow past it (base64
  // widget values). Sending it anyway gets the socket closed, and the
  // reconnect releases the reseed block — so the identical payload would be
  // re-uploaded on a loop rather than failing once.
  it('declines a reseed whose frame exceeds the relay bound', () => {
    const transport = new TestTransport()
    const client = new DocFrameClient(transport)
    const oversized = { ...canvas, blob: 'x'.repeat(8 << 20) }
    expect(client.reseed('wf-1', 7, oversized)).toBe(false)
    expect(transport.frames('doc_reseed')).toEqual([])
  })

  it('parses doc_reseed_result answers', () => {
    expect(
      parseServerDocFrame({
        type: 'doc_reseed_result',
        data: {
          v: 1,
          workflow_id: 'wf-1',
          ok: true,
          seq: 8,
          outcome: 'reseeded'
        }
      })
    ).toEqual({
      type: 'doc_reseed_result',
      data: { workflowId: 'wf-1', ok: true, seq: 8, outcome: 'reseeded' }
    })
    expect(
      parseServerDocFrame({
        type: 'doc_reseed_result',
        data: {
          v: 1,
          workflow_id: 'wf-1',
          ok: false,
          code: 'conflict',
          message: 'lost'
        }
      })
    ).toEqual({
      type: 'doc_reseed_result',
      data: { workflowId: 'wf-1', ok: false, code: 'conflict', message: 'lost' }
    })
    expect(
      parseServerDocFrame({
        type: 'doc_reseed_result',
        data: { v: 1, workflow_id: 'wf-1' }
      })
    ).toBeNull()
  })
})

describe('layout follower bridge: stale-schema reseed', () => {
  function refusedBridge() {
    const transport = new TestTransport()
    const client = new DocFrameClient(transport)
    const bridge = new LayoutFollowerBridge(client)
    bridge.subscribe('wf-1')
    transport.receive('doc_subscribed', {
      v: 1,
      workflow_id: 'wf-1',
      ok: false,
      code: STALE_SCHEMA_RESEED_REQUIRED,
      expected_seq: 7
    })
    return { transport, bridge }
  }

  it('sends the reseed only for the workflow the host refused as stale', () => {
    const { transport, bridge } = refusedBridge()
    expect(() => bridge.reseed('wf-other', canvas)).toThrow(
      /ADR-CRDT-FOLLOWER-0025/
    )
    expect(bridge.reseed('wf-1', canvas)).toBe(true)
    expect(transport.frames('doc_reseed')).toHaveLength(1)
  })

  // ADR-CRDT-FOLLOWER-0025: a follower never sends a whole graph as a
  // mutation. The one exception is answering the host's own
  // stale_schema_reseed_required refusal, once; the bridge enforces it.
  it('refuses a whole-canvas send the host did not ask for', () => {
    const transport = new TestTransport()
    const bridge = new LayoutFollowerBridge(new DocFrameClient(transport))
    bridge.subscribe('wf-1')
    expect(() => bridge.reseed('wf-1', canvas)).toThrow(
      /ADR-CRDT-FOLLOWER-0025/
    )
    transport.receive('doc_subscribed', {
      v: 1,
      workflow_id: 'wf-1',
      ok: false,
      code: 'schema_version_mismatch'
    })
    expect(() => bridge.reseed('wf-1', canvas)).toThrow(
      /ADR-CRDT-FOLLOWER-0025/
    )
    expect(transport.frames('doc_reseed')).toEqual([])
  })

  it('allows one reseed per refusal', () => {
    const { transport, bridge } = refusedBridge()
    expect(bridge.reseed('wf-1', canvas)).toBe(true)
    expect(() => bridge.reseed('wf-1', canvas)).toThrow(
      /ADR-CRDT-FOLLOWER-0025/
    )
    expect(transport.frames('doc_reseed')).toHaveLength(1)
  })

  it.for<[string, number | undefined]>([
    ['a missing sequence', undefined],
    ['sequence zero', 0]
  ])('does not arm reseed eligibility for %s', ([, expectedSeq]) => {
    const transport = new TestTransport()
    const bridge = new LayoutFollowerBridge(new DocFrameClient(transport))
    bridge.subscribe('wf-1')
    transport.receive('doc_subscribed', {
      v: 1,
      workflow_id: 'wf-1',
      ok: false,
      code: STALE_SCHEMA_RESEED_REQUIRED,
      expected_seq: expectedSeq
    })

    expect(bridge.canReseed('wf-1')).toBe(false)
  })

  it('does not re-arm after a successful reseed until subscribe confirmation', () => {
    const { transport, bridge } = refusedBridge()
    expect(bridge.canReseed('wf-1')).toBe(true)
    bridge.reseed('wf-1', canvas)
    transport.receive('doc_reseed_result', {
      v: 1,
      workflow_id: 'wf-1',
      ok: true,
      seq: 8,
      outcome: 'reseeded'
    })
    expect(bridge.canReseed('wf-1')).toBe(false)
    transport.receive('doc_subscribed', {
      v: 1,
      workflow_id: 'wf-1',
      ok: true,
      seq: 8
    })
    bridge.resubscribe()
    transport.receive('doc_subscribed', {
      v: 1,
      workflow_id: 'wf-1',
      ok: false,
      code: STALE_SCHEMA_RESEED_REQUIRED,
      expected_seq: 8
    })
    expect(bridge.canReseed('wf-1')).toBe(true)
  })

  // The live path, and it needs no 15 s timer: the refusal nulls send
  // REALITY, so the very next `reconcile()` — any `status` frame — re-sends
  // the subscribe and the host refuses it again while the first `doc_reseed`
  // is still unanswered. Re-arming on that second refusal put a second whole
  // canvas on the wire, CAS-ing against a different `expected_seq`.
  it('refuses a second whole canvas while the first reseed is unanswered', () => {
    const { transport, bridge } = refusedBridge()
    expect(bridge.reseed('wf-1', canvas)).toBe(true)
    expect(bridge.reseedInFlight).toBe(true)

    bridge.reconcile()
    transport.receive('doc_subscribed', {
      v: 1,
      workflow_id: 'wf-1',
      ok: false,
      code: STALE_SCHEMA_RESEED_REQUIRED,
      expected_seq: 9
    })

    expect(bridge.canReseed('wf-1')).toBe(false)
    expect(() => bridge.reseed('wf-1', canvas)).toThrow(
      /ADR-CRDT-FOLLOWER-0025/
    )
    expect(transport.frames('doc_reseed')).toHaveLength(1)
  })

  // The bound above must cost one ack timeout when an answer is lost, not the
  // tab's whole reseed capability.
  it('releases the in-flight bound when the ack timeout resubscribes', () => {
    const { transport, bridge } = refusedBridge()
    bridge.reseed('wf-1', canvas)

    bridge.resubscribe()
    expect(bridge.reseedInFlight).toBe(false)
    transport.receive('doc_subscribed', {
      v: 1,
      workflow_id: 'wf-1',
      ok: false,
      code: STALE_SCHEMA_RESEED_REQUIRED,
      expected_seq: 9
    })

    expect(bridge.canReseed('wf-1')).toBe(true)
  })

  // Nothing in `doc_reseed_result` says which reseed it answers, so an answer
  // is only attributable while its own subscription is still the live one.
  it('ignores an answer that arrives after the client re-synced without it', () => {
    const { transport, bridge } = refusedBridge()
    const resets: unknown[] = []
    bridge.addEventListener('doc_reset', (event) =>
      resets.push((event as CustomEvent).detail)
    )
    bridge.reseed('wf-1', canvas)
    bridge.resubscribe()
    transport.receive('doc_subscribed', {
      v: 1,
      workflow_id: 'wf-1',
      ok: true,
      seq: 12
    })
    const healthyDoc = bridge.follower

    transport.receive('doc_reseed_result', {
      v: 1,
      workflow_id: 'wf-1',
      ok: true,
      seq: 8,
      outcome: 'reseeded'
    })

    expect(resets).toEqual([])
    expect(bridge.follower).toBe(healthyDoc)
  })

  // `reseedRefusalState` reports `workflowId: null` for every non-stale
  // answer, so the re-arming guard compares `null !== null` and skipped the
  // clear whenever nothing was blocked.
  it('a confirmed subscribe clears an eligibility token nothing answered', () => {
    const { transport, bridge } = refusedBridge()
    expect(bridge.canReseed('wf-1')).toBe(true)

    bridge.resubscribe()
    transport.receive('doc_subscribed', {
      v: 1,
      workflow_id: 'wf-1',
      ok: true,
      seq: 12
    })

    expect(bridge.canReseed('wf-1')).toBe(false)
  })

  it('invalidates a refusal token when the desired workflow changes', () => {
    const { transport, bridge } = refusedBridge()
    bridge.subscribe('wf-2')

    expect(() => bridge.reseed('wf-1', canvas)).toThrow(
      /ADR-CRDT-FOLLOWER-0025/
    )
    expect(transport.frames('doc_reseed')).toEqual([])
  })

  it.for<[string, Record<string, unknown>]>([
    ['a won reseed', { ok: true, seq: 8, outcome: 'reseeded' }],
    [
      'an already-current document',
      { ok: true, seq: 8, outcome: 'already_current' }
    ],
    ['a lost race', { ok: false, code: 'conflict' }]
  ])('resets the lineage and resubscribes after %s', ([, answer]) => {
    const { transport, bridge } = refusedBridge()
    const resets: unknown[] = []
    const replaced: unknown[] = []
    const results: unknown[] = []
    bridge.addEventListener('doc_reset', (event) =>
      resets.push((event as CustomEvent).detail)
    )
    bridge.addEventListener('follower_replaced', (event) =>
      replaced.push((event as CustomEvent).detail)
    )
    bridge.addEventListener('doc_reseed_result', (event) =>
      results.push((event as CustomEvent).detail)
    )
    bridge.reseed('wf-1', canvas)
    const docBefore = bridge.follower

    transport.receive('doc_reseed_result', {
      v: 1,
      workflow_id: 'wf-1',
      ...answer
    })

    expect(results).toHaveLength(1)
    expect(resets).toEqual([
      expect.objectContaining({
        workflowId: 'wf-1',
        actor: 'system:client-seed'
      })
    ])
    expect(replaced).toHaveLength(1)
    expect(bridge.follower).not.toBe(docBefore)
    const subscribes = transport.frames('doc_subscribe')
    expect(subscribes).toHaveLength(2)
    expect(subscribes[1]).toMatchObject({ workflow_id: 'wf-1' })
    expect(bridge.subscribedWorkflowId).toBe('wf-1')
  })

  it('forwards a final refusal without resubscribing', () => {
    const { transport, bridge } = refusedBridge()
    const results: unknown[] = []
    bridge.addEventListener('doc_reseed_result', (event) =>
      results.push((event as CustomEvent).detail)
    )
    bridge.reseed('wf-1', canvas)
    transport.receive('doc_reseed_result', {
      v: 1,
      workflow_id: 'wf-1',
      ok: false,
      code: 'stale_schema_reseed_refused'
    })
    expect(results).toEqual([
      expect.objectContaining({
        ok: false,
        code: 'stale_schema_reseed_refused'
      })
    ])
    expect(transport.frames('doc_subscribe')).toHaveLength(1)
  })

  it('ignores a result it did not ask for', () => {
    const { transport, bridge } = refusedBridge()
    const results: unknown[] = []
    bridge.addEventListener('doc_reseed_result', (event) =>
      results.push((event as CustomEvent).detail)
    )
    transport.receive('doc_reseed_result', {
      v: 1,
      workflow_id: 'wf-1',
      ok: true,
      seq: 8
    })
    expect(results).toEqual([])
    expect(transport.frames('doc_subscribe')).toHaveLength(1)
  })
})
