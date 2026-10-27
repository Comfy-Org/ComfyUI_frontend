import { SCHEMA_VERSION } from '@comfyorg/comfy-multi-player'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import * as Y from 'yjs'

import { reportError } from '@/platform/telemetry/reportError'

import type { DocFrameTransport, ServerDocFrame } from './docFrameClient'
import {
  DocFrameClient,
  encodeBase64,
  parseServerDocFrame
} from './docFrameClient'
import type { ServerDocFrameType } from './docFrameCodes'
import { FollowerDoc } from './followerDoc'
import { LayoutFollowerBridge } from './layoutFollowerBridge'

vi.mock(import('@/platform/telemetry/reportError'))

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
  it('names every server frame type in SERVER_DOC_FRAME_TYPES', () => {
    expectTypeOf<ServerDocFrame['type']>().toEqualTypeOf<ServerDocFrameType>()
  })

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
        lineage_seq: 1,
        update_b64: encodeBase64(encoded),
        actor: 'agent:thread-1:turn-1',
        op_ids: ['op-1', 'op-2']
      }
    })
    expect(frame?.type).toBe('doc_update')
    if (frame?.type !== 'doc_update') throw new Error('Expected doc_update')
    expect(frame.data.actor).toBe('agent:thread-1:turn-1')
    expect(frame.data.lineageSeq).toBe(1)
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
          state_vector_b64: encodeBase64(stateVector),
          known_lineage_seq: 0,
          supports_reseed: true,
          schema_version: SCHEMA_VERSION
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
      lineage_seq: 1,
      update_b64: encodeBase64(update)
    })
    bridge.resubscribe()
    bridge.unsubscribe()
    bridge.subscribe('wf-1')
    transport.receive('doc_update', {
      v: 1,
      workflow_id: 'wf-1',
      seq: 1,
      lineage_seq: 1,
      update_b64: encodeBase64(update)
    })

    const frames = transport.sent.map((frame) => JSON.parse(frame))
    expect(frames.filter((frame) => frame.type === 'doc_ops')).toHaveLength(0)
    expect(
      frames.filter((frame) => frame.type === 'doc_subscribe')
    ).toHaveLength(3)
    expect(bridge.follower.doc.getMap('nodes').toJSON()).toEqual({ one: 1 })
  })

  it('parses subscription and operation result envelopes', () => {
    expect(
      parseServerDocFrame({
        type: 'doc_subscribed',
        data: {
          v: 1,
          workflow_id: 'wf-1',
          ok: true,
          seq: 2,
          lineage_seq: 7
        }
      })
    ).toEqual({
      type: 'doc_subscribed',
      data: { workflowId: 'wf-1', ok: true, seq: 2, lineageSeq: 7 }
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
        data: {
          v: 1,
          workflow_id: 'wf-1',
          seq: 43,
          lineage_seq: 7,
          actor: 'agent:th-1:turn-2'
        }
      })
    ).toEqual({
      type: 'doc_reset',
      data: {
        workflowId: 'wf-1',
        seq: 43,
        lineageSeq: 7,
        actor: 'agent:th-1:turn-2'
      }
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

  it('replaces a restored follower when the subscribed lineage differs', () => {
    const transport = new TestTransport()
    const client = new DocFrameClient(transport)
    const bridge = new LayoutFollowerBridge(client)
    const resets: unknown[] = []
    bridge.addEventListener('doc_reset', (event) => {
      if (event instanceof CustomEvent) resets.push(event.detail)
    })

    bridge.subscribe('wf-1', 4)
    transport.receive('doc_subscribed', {
      v: 1,
      workflow_id: 'wf-1',
      ok: true,
      seq: 9,
      lineage_seq: 8
    })

    expect(JSON.parse(transport.sent[0]).data.known_lineage_seq).toBe(4)
    expect(resets).toEqual([{ workflowId: 'wf-1', seq: 9, lineageSeq: 8 }])
  })

  it('replaces a restored follower when an accepted ack omits lineage 0', () => {
    const transport = new TestTransport()
    const client = new DocFrameClient(transport)
    const bridge = new LayoutFollowerBridge(client)
    const resets: unknown[] = []
    bridge.addEventListener('doc_reset', (event) => {
      if (event instanceof CustomEvent) resets.push(event.detail)
    })

    bridge.subscribe('wf-1', 4)
    transport.receive('doc_subscribed', {
      v: 1,
      workflow_id: 'wf-1',
      ok: true,
      seq: 9
    })

    expect(resets).toEqual([{ workflowId: 'wf-1', seq: 9, lineageSeq: 0 }])
  })

  it('rejects an accepted doc_subscribed whose lineage_seq is malformed', () => {
    expect(
      parseServerDocFrame({
        type: 'doc_subscribed',
        data: { v: 1, workflow_id: 'wf-1', ok: true, lineage_seq: 'retired' }
      })
    ).toBeNull()
    expect(
      parseServerDocFrame({
        type: 'doc_subscribed',
        data: { v: 1, workflow_id: 'wf-1', ok: false, code: 'forbidden' }
      })
    ).toEqual({
      type: 'doc_subscribed',
      data: { workflowId: 'wf-1', ok: false, code: 'forbidden' }
    })
  })

  it('keeps a seq-0 or absent-seq doc_subscribed ok ack as a valid baseline', () => {
    // The relay's DocSubscribedFrame uses `json:"seq,omitempty"`, so a fresh
    // (unminted) doc acked at seq 0 arrives with `seq` absent. Both shapes are
    // valid baseline-0 acks and must not be treated as malformed.
    expect(
      parseServerDocFrame({
        type: 'doc_subscribed',
        data: { v: 1, workflow_id: 'wf-1', ok: true, seq: 0 }
      })
    ).toEqual({
      type: 'doc_subscribed',
      data: { workflowId: 'wf-1', ok: true, seq: 0, lineageSeq: 0 }
    })
    const absent = parseServerDocFrame({
      type: 'doc_subscribed',
      data: { v: 1, workflow_id: 'wf-1', ok: true }
    })
    expect(absent).toEqual({
      type: 'doc_subscribed',
      data: { workflowId: 'wf-1', ok: true, lineageSeq: 0 }
    })
    expect(absent?.data).not.toHaveProperty('seq')
  })

  it('reports the first malformed inbound frame per type', () => {
    const transport = new TestTransport()
    const client = new DocFrameClient(transport)
    const listener = vi.fn()
    client.addEventListener('doc_update', listener)

    const malformed = {
      v: 1,
      workflow_id: 'wf-1',
      seq: 1,
      update_b64: 'not-base64'
    }
    transport.receive('doc_update', malformed)
    transport.receive('doc_update', malformed)
    transport.receive('awareness', {})

    expect(listener).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledTimes(2)
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      surface: 'agent',
      errorType: 'agent_crdt_invalid_server_frame',
      tags: { frame_type: 'doc_update' },
      level: 'warning'
    })
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      surface: 'agent',
      errorType: 'agent_crdt_invalid_server_frame',
      tags: { frame_type: 'awareness' },
      level: 'warning'
    })
  })

  it('rejects and reports a doc update without its generated lineage field', () => {
    const transport = new TestTransport()
    const client = new DocFrameClient(transport)
    const listener = vi.fn()
    client.addEventListener('doc_update', listener)

    transport.receive('doc_update', {
      v: 1,
      workflow_id: 'wf-1',
      seq: 1,
      update_b64: encodeBase64(new Uint8Array([1]))
    })

    expect(listener).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      surface: 'agent',
      errorType: 'agent_crdt_invalid_server_frame',
      tags: { frame_type: 'doc_update' },
      level: 'warning'
    })
  })

  it('keeps seq zero on a doc update', () => {
    expect(
      parseServerDocFrame({
        type: 'doc_update',
        data: {
          v: 1,
          workflow_id: 'wf-1',
          seq: 0,
          lineage_seq: 1,
          update_b64: encodeBase64(new Uint8Array([1]))
        }
      })
    ).toEqual({
      type: 'doc_update',
      data: {
        workflowId: 'wf-1',
        seq: 0,
        lineageSeq: 1,
        update: new Uint8Array([1])
      }
    })
  })

  it('rejects inherited object keys as frame types', () => {
    expect(
      parseServerDocFrame({
        type: 'constructor',
        data: { v: 1, workflow_id: 'wf-1' }
      })
    ).toBeNull()
  })
})
