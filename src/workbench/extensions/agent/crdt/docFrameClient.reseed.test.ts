import { SCHEMA_VERSION, mint } from '@comfyorg/comfy-multi-player'
import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import type { DocFrameTransport } from './docFrameClient'
import {
  DocFrameClient,
  encodeBase64,
  parseServerDocFrame
} from './docFrameClient'
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

function staleRefusal(expectedSeq: number) {
  return {
    v: 1,
    workflow_id: 'wf-1',
    ok: false,
    code: STALE_SCHEMA_RESEED_REQUIRED,
    expected_seq: expectedSeq
  }
}

function refusedBridge() {
  const transport = new TestTransport()
  const bridge = new LayoutFollowerBridge(new DocFrameClient(transport))
  bridge.subscribe('wf-1')
  transport.receive('doc_subscribed', staleRefusal(7))
  return { transport, bridge }
}

function collect(target: EventTarget, type: string): unknown[] {
  const details: unknown[] = []
  target.addEventListener(type, (event) => {
    if (event instanceof CustomEvent) details.push(event.detail)
  })
  return details
}

function answerReseed(transport: TestTransport, answer: object): void {
  transport.receive('doc_reseed_result', {
    v: 1,
    workflow_id: 'wf-1',
    ...answer
  })
}

describe('doc frame client: stale-schema reseed', () => {
  it.for<[string, Record<string, unknown>, unknown]>([
    [
      'a success',
      { ok: true, seq: 8, outcome: 'reseeded' },
      {
        type: 'doc_reseed_result',
        data: { workflowId: 'wf-1', ok: true, seq: 8, outcome: 'reseeded' }
      }
    ],
    [
      'a failure',
      { ok: false, code: 'conflict', message: 'lost' },
      {
        type: 'doc_reseed_result',
        data: {
          workflowId: 'wf-1',
          ok: false,
          code: 'conflict',
          message: 'lost'
        }
      }
    ],
    ['a result without ok', {}, null]
  ])('parses doc_reseed_result for %s', ([, answer, expected]) => {
    expect(
      parseServerDocFrame({
        type: 'doc_reseed_result',
        data: { v: 1, workflow_id: 'wf-1', ...answer }
      })
    ).toEqual(expected)
  })
})

describe('layout follower bridge: stale-schema reseed', () => {
  it('sends the canvas with the sequence the refusal authorized', () => {
    const { transport, bridge } = refusedBridge()

    expect(bridge.reseed('wf-1', canvas)).toBe(true)

    expect(transport.frames('doc_reseed')).toEqual([
      { v: 1, workflow_id: 'wf-1', expected_seq: 7, workflow: canvas }
    ])
  })

  it.for<
    [
      string,
      () => {
        transport: TestTransport
        bridge: LayoutFollowerBridge
        target: string
      }
    ]
  >([
    [
      'before any refusal',
      () => {
        const transport = new TestTransport()
        const bridge = new LayoutFollowerBridge(new DocFrameClient(transport))
        bridge.subscribe('wf-1')
        return { transport, bridge, target: 'wf-1' }
      }
    ],
    [
      'after a non-stale refusal',
      () => {
        const transport = new TestTransport()
        const bridge = new LayoutFollowerBridge(new DocFrameClient(transport))
        bridge.subscribe('wf-1')
        transport.receive('doc_subscribed', {
          v: 1,
          workflow_id: 'wf-1',
          ok: false,
          code: 'schema_version_mismatch'
        })
        return { transport, bridge, target: 'wf-1' }
      }
    ],
    [
      'for a workflow the host did not refuse',
      () => ({ ...refusedBridge(), target: 'wf-other' })
    ],
    [
      'after the desired workflow changed',
      () => {
        const refused = refusedBridge()
        refused.bridge.subscribe('wf-2')
        return { ...refused, target: 'wf-1' }
      }
    ],
    [
      'after unsubscribe()',
      () => {
        const refused = refusedBridge()
        refused.bridge.unsubscribe()
        return { ...refused, target: 'wf-1' }
      }
    ],
    [
      'a second time for one refusal',
      () => {
        const refused = refusedBridge()
        refused.bridge.reseed('wf-1', canvas)
        return { ...refused, target: 'wf-1' }
      }
    ],
    [
      'after a lineage reset, before the subscribe confirms',
      () => {
        const refused = refusedBridge()
        refused.bridge.reseed('wf-1', canvas)
        answerReseed(refused.transport, { ok: true, seq: 8 })
        refused.transport.receive('doc_subscribed', staleRefusal(8))
        return { ...refused, target: 'wf-1' }
      }
    ]
  ])('refuses a whole-canvas send %s', ([, arrange]) => {
    const { transport, bridge, target } = arrange()
    const sentBefore = transport.frames('doc_reseed').length

    expect(bridge.canReseed(target)).toBe(false)
    expect(() => bridge.reseed(target, canvas)).toThrow(
      /ADR-CRDT-FOLLOWER-0025/
    )
    expect(transport.frames('doc_reseed')).toHaveLength(sentBefore)
  })

  it.for<
    [string, (bridge: LayoutFollowerBridge, transport: TestTransport) => void]
  >([
    [
      'subscribe confirmation',
      (bridge, transport) => {
        transport.receive('doc_subscribed', {
          v: 1,
          workflow_id: 'wf-1',
          ok: true,
          seq: 8
        })
        bridge.resubscribe()
      }
    ],
    ['reconnect', (bridge) => bridge.reconnect()],
    [
      'retarget',
      (bridge) => {
        bridge.subscribe('wf-2')
        bridge.subscribe('wf-1')
      }
    ]
  ])('releases the post-reset block after %s', ([, release]) => {
    const { transport, bridge } = refusedBridge()
    bridge.reseed('wf-1', canvas)
    answerReseed(transport, { ok: true, seq: 8 })

    release(bridge, transport)
    transport.receive('doc_subscribed', staleRefusal(9))

    expect(bridge.canReseed('wf-1')).toBe(true)
  })

  it.for([undefined, 0, -1, 1.5])(
    'does not arm reseed for an invalid expected sequence: %s',
    (expectedSeq) => {
      const transport = new TestTransport()
      const bridge = new LayoutFollowerBridge(new DocFrameClient(transport))
      bridge.subscribe('wf-1')
      transport.receive('doc_subscribed', {
        v: 1,
        workflow_id: 'wf-1',
        ok: false,
        code: STALE_SCHEMA_RESEED_REQUIRED,
        ...(expectedSeq !== undefined && { expected_seq: expectedSeq })
      })

      expect(bridge.canReseed('wf-1')).toBe(false)
    }
  )

  it.for<[string, Record<string, unknown>]>([
    ['a won reseed', { ok: true, seq: 8, outcome: 'reseeded' }],
    ['a lost race', { ok: false, code: 'conflict' }]
  ])('drops the old lineage before resubscribing after %s', ([, answer]) => {
    const transport = new TestTransport()
    const bridge = new LayoutFollowerBridge(new DocFrameClient(transport))
    bridge.subscribe('wf-1')
    transport.receive('doc_subscribed', {
      v: 1,
      workflow_id: 'wf-1',
      ok: true,
      seq: 1
    })
    transport.receive('doc_update', {
      v: 1,
      workflow_id: 'wf-1',
      seq: 1,
      update_b64: encodeBase64(
        Y.encodeStateAsUpdate(mint({ nodes: [], links: [] }, { types: {} }))
      )
    })
    bridge.resubscribe()
    transport.receive('doc_subscribed', staleRefusal(7))
    const resets = collect(bridge, 'doc_reset')
    bridge.reseed('wf-1', canvas)
    const docBefore = bridge.follower

    answerReseed(transport, answer)

    expect(resets).toEqual([
      expect.objectContaining({
        workflowId: 'wf-1',
        actor: 'system:client-seed'
      })
    ])
    expect(bridge.follower).not.toBe(docBefore)
    expect(transport.frames('doc_subscribe').at(-1)).toEqual({
      v: 1,
      workflow_id: 'wf-1',
      state_vector_b64: 'AA==',
      supports_reseed: true,
      schema_version: SCHEMA_VERSION
    })
  })

  it('ignores a late result for a workflow the bridge no longer follows', () => {
    const { transport, bridge } = refusedBridge()
    bridge.reseed('wf-1', canvas)
    bridge.subscribe('wf-2')
    const resets = collect(bridge, 'doc_reset')
    const followerForWf2 = bridge.follower

    answerReseed(transport, { ok: true, seq: 8 })

    expect(resets).toEqual([])
    expect(bridge.follower).toBe(followerForWf2)
  })

  it('forwards a final refusal without resubscribing', () => {
    const { transport, bridge } = refusedBridge()
    const results = collect(bridge, 'doc_reseed_result')
    bridge.reseed('wf-1', canvas)

    answerReseed(transport, { ok: false, code: 'stale_schema_reseed_refused' })

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
    const results = collect(bridge, 'doc_reseed_result')

    answerReseed(transport, { ok: true, seq: 8 })

    expect(results).toEqual([])
    expect(transport.frames('doc_subscribe')).toHaveLength(1)
  })
})
