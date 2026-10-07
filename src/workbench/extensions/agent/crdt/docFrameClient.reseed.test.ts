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

const canvas = { nodes: [{ id: 1, type: 'CheckpointLoaderSimple' }] }

function refusedBridge() {
  const transport = new TestTransport()
  const bridge = new LayoutFollowerBridge(new DocFrameClient(transport))
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

describe('stale-schema reseed wire protocol', () => {
  it('advertises support and parses the refusal sequence and result', () => {
    const transport = new TestTransport()
    const client = new DocFrameClient(transport)

    client.subscribe('wf-1', new Uint8Array())

    expect(transport.frames('doc_subscribe')).toEqual([
      expect.objectContaining({ supports_reseed: true })
    ])
    expect(
      parseServerDocFrame({
        type: 'doc_subscribed',
        data: {
          v: 1,
          workflow_id: 'wf-1',
          ok: false,
          expected_seq: 7
        }
      })
    ).toEqual({
      type: 'doc_subscribed',
      data: { workflowId: 'wf-1', ok: false, expectedSeq: 7 }
    })
    expect(
      parseServerDocFrame({
        type: 'doc_reseed_result',
        data: { v: 1, workflow_id: 'wf-1', ok: true, seq: 8 }
      })
    ).toEqual({
      type: 'doc_reseed_result',
      data: { workflowId: 'wf-1', ok: true, seq: 8 }
    })
  })

  it('sends one canvas with the exact sequence authorized by the refusal', () => {
    const { transport, bridge } = refusedBridge()

    expect(bridge.reseed('wf-1', canvas)).toBe('sent')
    expect(bridge.reseed('wf-1', canvas)).toBe('unavailable')
    expect(transport.frames('doc_reseed')).toEqual([
      {
        v: 1,
        workflow_id: 'wf-1',
        expected_seq: 7,
        workflow: canvas
      }
    ])
  })

  it('accepts an empty canvas and rejects an oversized one', () => {
    const empty = refusedBridge()
    expect(empty.bridge.reseed('wf-1', { nodes: [] })).toBe('sent')

    const oversized = refusedBridge()
    expect(
      oversized.bridge.reseed('wf-1', { value: 'x'.repeat((8 << 20) + 1) })
    ).toBe('too_large')
    expect(oversized.transport.frames('doc_reseed')).toHaveLength(0)
  })

  it('counts the complete UTF-8 frame against the transport limit', () => {
    const multibyte = refusedBridge()

    expect(
      multibyte.bridge.reseed('wf-1', { value: '界'.repeat(3_000_000) })
    ).toBe('too_large')
    expect(multibyte.transport.frames('doc_reseed')).toHaveLength(0)
  })

  it('reports serialization failures separately from oversized frames', () => {
    const circular = refusedBridge()
    const workflow: Record<string, unknown> = {}
    workflow.self = workflow

    expect(circular.bridge.reseed('wf-1', workflow)).toBe(
      'serialization_failed'
    )
    expect(circular.transport.frames('doc_reseed')).toHaveLength(0)
  })

  it('replaces the old lineage without emitting a destructive reset after success', () => {
    const { transport, bridge } = refusedBridge()
    const resets = vi.fn()
    const replacements = vi.fn()
    bridge.addEventListener('doc_reset', resets)
    bridge.addEventListener('follower_replaced', replacements)
    bridge.reseed('wf-1', canvas)
    const oldFollower = bridge.follower

    bridge.reconcile()
    expect(transport.frames('doc_subscribe')).toHaveLength(1)

    transport.receive('doc_reseed_result', {
      v: 1,
      workflow_id: 'wf-1',
      ok: true,
      seq: 8
    })

    expect(bridge.follower).not.toBe(oldFollower)
    expect(resets).not.toHaveBeenCalled()
    expect(replacements).toHaveBeenCalledOnce()
    expect(transport.frames('doc_subscribe').at(-1)).toEqual(
      expect.objectContaining({ state_vector_b64: 'AA==' })
    )
  })

  it('abandons the ambiguous lineage and requests a fresh refusal after conflict', () => {
    const { transport, bridge } = refusedBridge()
    const replacements = vi.fn()
    bridge.addEventListener('follower_replaced', replacements)
    bridge.reseed('wf-1', canvas)
    const oldFollower = bridge.follower

    transport.receive('doc_reseed_result', {
      v: 1,
      workflow_id: 'wf-1',
      ok: false,
      code: 'conflict'
    })

    expect(bridge.follower).not.toBe(oldFollower)
    expect(replacements).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { workflowId: 'wf-1', preserveCanvas: false }
      })
    )
    expect(transport.frames('doc_subscribe')).toHaveLength(2)
  })

  it('ignores a late result after retargeting', () => {
    const { transport, bridge } = refusedBridge()
    bridge.reseed('wf-1', canvas)
    bridge.subscribe('wf-2')
    const follower = bridge.follower

    transport.receive('doc_reseed_result', {
      v: 1,
      workflow_id: 'wf-1',
      ok: true,
      seq: 8
    })

    expect(bridge.follower).toBe(follower)
  })

  it('ignores an abandoned result after retargeting away and back', () => {
    const { transport, bridge } = refusedBridge()
    bridge.reseed('wf-1', canvas)
    bridge.subscribe('wf-2')
    bridge.subscribe('wf-1')
    const follower = bridge.follower

    transport.receive('doc_reseed_result', {
      v: 1,
      workflow_id: 'wf-1',
      ok: true,
      seq: 8
    })

    expect(bridge.follower).toBe(follower)
  })
})
