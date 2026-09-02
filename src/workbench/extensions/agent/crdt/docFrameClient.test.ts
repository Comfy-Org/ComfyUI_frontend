import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { reportError } from '@/platform/telemetry/reportError'

import type { DocFrameTransport } from './docFrameClient'
import {
  DocFrameClient,
  encodeBase64,
  parseServerDocFrame
} from './docFrameClient'
import { FollowerDoc } from './followerDoc'
import { LayoutFollowerBridge } from './layoutFollowerBridge'

vi.mock('@/platform/telemetry/reportError', () => ({ reportError: vi.fn() }))

class TestTransport extends EventTarget implements DocFrameTransport {
  readonly sent: string[] = []

  send(frame: string): boolean {
    this.sent.push(frame)
    return true
  }

  receive(type: string, data: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail: data }))
  }
}

function updateAfter(doc: Y.Doc, mutate: () => void): Uint8Array {
  const before = Y.encodeStateVector(doc)
  mutate()
  return Y.encodeStateAsUpdate(doc, before)
}

describe('doc frame client', () => {
  it('decodes a base64 doc_update that converges through Y.applyUpdate', () => {
    const source = new Y.Doc()
    source.getMap('nodes').set('one', { x: 10 })
    const encoded = Y.encodeStateAsUpdate(source)

    const frame = parseServerDocFrame({
      type: 'doc_update',
      data: {
        v: 1,
        workflow_id: 'wf-1',
        seq: 1,
        update_b64: encodeBase64(encoded),
        actor: 'agent:thread-1:turn-1',
        op_ids: ['op-1', 'op-2']
      }
    })
    expect(frame?.type).toBe('doc_update')
    if (frame?.type !== 'doc_update') throw new Error('Expected doc_update')
    expect(frame.data.actor).toBe('agent:thread-1:turn-1')
    expect(frame.data.opIds).toEqual(['op-1', 'op-2'])

    const follower = new FollowerDoc()
    follower.applyRemoteUpdate(frame.data.update)
    expect(follower.doc.getMap('nodes').toJSON()).toEqual({ one: { x: 10 } })
    expect(Y.encodeStateVector(follower.doc)).toEqual(
      Y.encodeStateVector(source)
    )
  })

  it('replaying an update is idempotent', () => {
    const source = new Y.Doc()
    source.getArray('items').push(['a'])
    const update = Y.encodeStateAsUpdate(source)
    const follower = new FollowerDoc()

    follower.applyRemoteUpdate(update)
    const once = Y.encodeStateAsUpdate(follower.doc)
    follower.applyRemoteUpdate(update)

    expect(Y.encodeStateAsUpdate(follower.doc)).toEqual(once)
    expect(follower.doc.getArray('items').toJSON()).toEqual(['a'])
  })

  it('converges with out-of-order and duplicate updates', () => {
    const source = new Y.Doc()
    const values = source.getMap('values')
    const first = updateAfter(source, () => values.set('a', 1))
    const second = updateAfter(source, () => values.set('b', 2))
    const follower = new FollowerDoc()

    follower.applyRemoteUpdate(second)
    follower.applyRemoteUpdate(second)
    follower.applyRemoteUpdate(first)

    expect(follower.doc.getMap('values').toJSON()).toEqual({ a: 1, b: 2 })
    expect(Y.encodeStateVector(follower.doc)).toEqual(
      Y.encodeStateVector(source)
    )
  })

  it('encodes subscribe, unsubscribe and doc_ops protocol frames', () => {
    const transport = new TestTransport()
    const client = new DocFrameClient(transport)
    const stateVector = Uint8Array.from([1, 2, 3])

    client.subscribe('wf-1', stateVector)
    client.sendOps('wf-1', 'tab-a', [
      { op_id: 'op-1', actor: 'human:user:tab-a', type: 'node.move' }
    ])
    client.unsubscribe('wf-1')

    expect(transport.sent.map((frame) => JSON.parse(frame))).toEqual([
      {
        type: 'doc_subscribe',
        data: {
          v: 1,
          workflow_id: 'wf-1',
          state_vector_b64: encodeBase64(stateVector)
        }
      },
      {
        type: 'doc_ops',
        data: {
          v: 1,
          workflow_id: 'wf-1',
          tab: 'tab-a',
          ops: [{ op_id: 'op-1', actor: 'human:user:tab-a', type: 'node.move' }]
        }
      },
      {
        type: 'doc_unsubscribe',
        data: { v: 1, workflow_id: 'wf-1' }
      }
    ])
  })

  it('resubscribes from its state vector without echoing remote updates', () => {
    const transport = new TestTransport()
    const client = new DocFrameClient(transport)
    const bridge = new LayoutFollowerBridge(client)
    bridge.subscribe('wf-1')
    const source = new Y.Doc()
    source.getMap('nodes').set('one', 1)
    const update = Y.encodeStateAsUpdate(source)

    transport.receive('doc_update', {
      v: 1,
      workflow_id: 'wf-1',
      seq: 1,
      update_b64: encodeBase64(update)
    })
    bridge.resubscribe()
    bridge.unsubscribe()
    bridge.subscribe('wf-1')
    transport.receive('doc_update', {
      v: 1,
      workflow_id: 'wf-1',
      seq: 1,
      update_b64: encodeBase64(update)
    })

    const frames = transport.sent.map((frame) => JSON.parse(frame))
    expect(frames.filter((frame) => frame.type === 'doc_ops')).toHaveLength(0)
    expect(
      frames.filter((frame) => frame.type === 'doc_subscribe')
    ).toHaveLength(3)
    // The bridge holds semantic state in its FollowerDoc; the ECS adapter
    // applies observed effects to domain stores, never into layoutStore's doc.
    expect(bridge.follower.doc.getMap('nodes').toJSON()).toEqual({ one: 1 })
  })

  it('parses subscription and operation result envelopes', () => {
    expect(
      parseServerDocFrame({
        type: 'doc_subscribed',
        data: { v: 1, workflow_id: 'wf-1', ok: true, seq: 2 }
      })
    ).toEqual({
      type: 'doc_subscribed',
      data: { workflowId: 'wf-1', ok: true, seq: 2 }
    })
    expect(
      parseServerDocFrame({
        type: 'doc_ops_result',
        data: {
          v: 1,
          workflow_id: 'wf-1',
          ok: true,
          seq: 3,
          applied: ['op-1'],
          skipped: []
        }
      })
    ).toEqual({
      type: 'doc_ops_result',
      data: {
        workflowId: 'wf-1',
        ok: true,
        seq: 3,
        applied: ['op-1'],
        skipped: []
      }
    })
    expect(
      parseServerDocFrame({
        type: 'doc_reset',
        data: { v: 1, workflow_id: 'wf-1', seq: 43, actor: 'agent:th-1:turn-2' }
      })
    ).toEqual({
      type: 'doc_reset',
      data: { workflowId: 'wf-1', seq: 43, actor: 'agent:th-1:turn-2' }
    })
    expect(
      parseServerDocFrame({
        type: 'awareness',
        data: {
          v: 1,
          workflow_id: 'wf-1',
          actor: 'human:user:tab-a',
          state: { cursor: [10, 20] },
          expires_at: 123
        }
      })
    ).toEqual({
      type: 'awareness',
      data: {
        workflowId: 'wf-1',
        actor: 'human:user:tab-a',
        state: { cursor: [10, 20] },
        expiresAt: 123
      }
    })
  })

  it('keeps optional acknowledgement fields optional', () => {
    expect(
      parseServerDocFrame({
        type: 'doc_subscribed',
        data: { v: 1, workflow_id: 'wf-1', ok: false, code: 'forbidden' }
      })
    ).toEqual({
      type: 'doc_subscribed',
      data: { workflowId: 'wf-1', ok: false, code: 'forbidden' }
    })
    expect(
      parseServerDocFrame({
        type: 'doc_subscribed',
        data: { v: 1, workflow_id: 'wf-1', ok: true }
      })
    ).toEqual({
      type: 'doc_subscribed',
      data: { workflowId: 'wf-1', ok: true }
    })
    expect(
      parseServerDocFrame({
        type: 'doc_ops_result',
        data: { v: 1, workflow_id: 'wf-1', ok: false, message: 'rejected' }
      })
    ).toEqual({
      type: 'doc_ops_result',
      data: {
        workflowId: 'wf-1',
        ok: false,
        applied: [],
        skipped: [],
        message: 'rejected'
      }
    })
  })

  it('drops malformed advisory actors without dropping effect frames', () => {
    expect(
      parseServerDocFrame({
        type: 'doc_update',
        data: {
          v: 1,
          workflow_id: 'wf-1',
          seq: 1,
          update_b64: 'AQ==',
          actor: 'unknown:value'
        }
      })
    ).toEqual({
      type: 'doc_update',
      data: { workflowId: 'wf-1', seq: 1, update: Uint8Array.from([1]) }
    })
    expect(
      parseServerDocFrame({
        type: 'doc_reset',
        data: {
          v: 1,
          workflow_id: 'wf-1',
          seq: 2,
          actor: 'unknown:value'
        }
      })
    ).toEqual({
      type: 'doc_reset',
      data: { workflowId: 'wf-1', seq: 2 }
    })
  })

  it('treats null optional values as absent', () => {
    expect(
      parseServerDocFrame({
        type: 'doc_ops_result',
        data: {
          v: 1,
          workflow_id: 'wf-1',
          ok: false,
          failed: null,
          code: null,
          message: null
        }
      })
    ).toEqual({
      type: 'doc_ops_result',
      data: { workflowId: 'wf-1', ok: false, applied: [], skipped: [] }
    })
    expect(
      parseServerDocFrame({
        type: 'awareness',
        data: {
          v: 1,
          workflow_id: 'wf-1',
          actor: 'human:user:tab',
          state: null,
          expires_at: null
        }
      })
    ).toEqual({
      type: 'awareness',
      data: { workflowId: 'wf-1', actor: 'human:user:tab' }
    })
  })

  it('reports malformed inbound frames without forwarding them', () => {
    const transport = new TestTransport()
    const client = new DocFrameClient(transport)
    const listener = vi.fn()
    client.addEventListener('doc_update', listener)

    transport.receive('doc_update', {
      v: 1,
      workflow_id: 'wf-1',
      seq: 1,
      update_b64: 'not-base64'
    })

    expect(listener).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      errorType: 'agent_crdt_invalid_server_frame',
      tags: { frame_type: 'doc_update' },
      level: 'warning'
    })
  })

  const invalidDocUpdateCases: [string, Record<string, unknown>][] = [
    ['invalid base64 characters', { seq: 1, update_b64: '!!!=' }],
    ['partial base64', { seq: 1, update_b64: 'AQ' }],
    ['empty base64', { seq: 1, update_b64: '' }],
    ['negative sequence', { seq: -1, update_b64: 'AQ==' }],
    ['fractional sequence', { seq: 1.5, update_b64: 'AQ==' }],
    ['mixed op ids', { seq: 1, update_b64: 'AQ==', op_ids: ['ok', 1] }]
  ]
  it.for(invalidDocUpdateCases)(
    'rejects %s in doc_update without throwing',
    ([_name, fields]) => {
      expect(() =>
        parseServerDocFrame({
          type: 'doc_update',
          data: { v: 1, workflow_id: 'wf-1', ...fields }
        })
      ).not.toThrow()
      expect(
        parseServerDocFrame({
          type: 'doc_update',
          data: { v: 1, workflow_id: 'wf-1', ...fields }
        })
      ).toBeNull()
    }
  )

  it('rejects an oversized decoded update before decoding', () => {
    expect(
      parseServerDocFrame({
        type: 'doc_update',
        data: {
          v: 1,
          workflow_id: 'wf-1',
          seq: 1,
          update_b64: 'AAAA'.repeat(((8 << 20) + 1) / 3)
        }
      })
    ).toBeNull()
  })

  it.for(['', 'wf bad', 'wf:bad', 'x'.repeat(129)])(
    'rejects invalid workflow id %j',
    (workflowId) => {
      expect(
        parseServerDocFrame({
          type: 'doc_subscribed',
          data: { v: 1, workflow_id: workflowId, ok: true, seq: 1 }
        })
      ).toBeNull()
    }
  )

  it('rejects malformed result arrays, failures, and acknowledgements', () => {
    const result = (data: Record<string, unknown>) =>
      parseServerDocFrame({
        type: 'doc_ops_result',
        data: { v: 1, workflow_id: 'wf-1', applied: [], skipped: [], ...data }
      })

    expect(result({ ok: true, applied: ['op-1', 2], seq: 1 })).toBeNull()
    expect(
      result({
        ok: true,
        seq: 1,
        failed: { op_id: 'op-1', code: 'x', message: 'x' }
      })
    ).toBeNull()
    expect(result({ ok: false, code: 1 })).toBeNull()
    expect(
      result({
        ok: false,
        code: 'rejected',
        message: 'bad op',
        failed: { index: 0, op_id: 'op-1', code: 'bad', message: 'bad op' }
      })
    ).toMatchObject({ type: 'doc_ops_result' })
    expect(result({ ok: true, seq: '1' })).toBeNull()
  })

  it('rejects malformed or oversized awareness state', () => {
    const awareness = (state: unknown, expiresAt: unknown = 1) =>
      parseServerDocFrame({
        type: 'awareness',
        data: {
          v: 1,
          workflow_id: 'wf-1',
          actor: 'human:user:tab',
          state,
          expires_at: expiresAt
        }
      })

    expect(awareness([])).toBeNull()
    expect(awareness({ value: 'x'.repeat((8 << 10) + 1) })).toBeNull()
    expect(awareness({}, -1)).toBeNull()
    expect(awareness({}, Number.POSITIVE_INFINITY)).toBeNull()
    expect(awareness({ value: 1n })).toBeNull()
    expect(awareness({ cursor: [1, 2] })).toMatchObject({ type: 'awareness' })
  })
})
