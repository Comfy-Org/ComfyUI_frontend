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

    expect(bridge.reseed('wf-1', canvas)).toBe(true)
    expect(bridge.reseed('wf-1', canvas)).toBe(false)
    expect(transport.frames('doc_reseed')).toEqual([
      {
        v: 1,
        workflow_id: 'wf-1',
        expected_seq: 7,
        workflow: canvas
      }
    ])
  })

  it.for<[string, Record<string, unknown>]>([
    ['success', { ok: true, seq: 8 }],
    ['conflict', { ok: false, code: 'conflict' }]
  ])('drops the old lineage and resubscribes after %s', ([, answer]) => {
    const { transport, bridge } = refusedBridge()
    bridge.reseed('wf-1', canvas)
    const oldFollower = bridge.follower

    transport.receive('doc_reseed_result', {
      v: 1,
      workflow_id: 'wf-1',
      ...answer
    })

    expect(bridge.follower).not.toBe(oldFollower)
    expect(transport.frames('doc_subscribe').at(-1)).toEqual(
      expect.objectContaining({ state_vector_b64: 'AA==' })
    )
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
})
