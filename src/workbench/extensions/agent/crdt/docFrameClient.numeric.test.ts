import { describe, expect, it } from 'vitest'

import { encodeBase64, parseServerDocFrame } from './docFrameClient'

const updateFrame = (seq: unknown) => ({
  type: 'doc_update',
  data: {
    v: 1,
    workflow_id: 'wf-1',
    seq,
    update_b64: encodeBase64(new Uint8Array([1]))
  }
})

const awarenessFrame = (expiresAt: unknown) => ({
  type: 'awareness',
  data: {
    v: 1,
    workflow_id: 'wf-1',
    actor: 'human:user:tab-a',
    expires_at: expiresAt
  }
})

const sequencedFrame = (
  type: 'doc_subscribed' | 'doc_reset',
  seq?: unknown
) => ({
  type,
  data: {
    v: 1,
    workflow_id: 'wf-1',
    ...(seq !== undefined && { seq }),
    ...(type === 'doc_subscribed' && { ok: true })
  }
})

const docOpsResultFrame = (seq?: unknown) => ({
  type: 'doc_ops_result',
  data: {
    v: 1,
    workflow_id: 'wf-1',
    ok: true,
    applied: [],
    skipped: [],
    ...(seq !== undefined && { seq })
  }
})

describe('doc frame numeric domains', () => {
  it.for([-1, 1.5, Number.POSITIVE_INFINITY, Number.NaN])(
    'rejects an invalid doc_update seq: %s',
    (seq) => {
      expect(parseServerDocFrame(updateFrame(seq))).toBeNull()
    }
  )

  it.for([-1, 1.5, Number.POSITIVE_INFINITY, Number.NaN])(
    'rejects an invalid awareness expiry: %s',
    (expiresAt) => {
      expect(parseServerDocFrame(awarenessFrame(expiresAt))).toBeNull()
    }
  )

  describe('doc_reset seq', () => {
    it.for([-1, 1.5, Number.POSITIVE_INFINITY, Number.NaN, '1'])(
      'rejects an invalid value: %s',
      (seq) => {
        expect(parseServerDocFrame(sequencedFrame('doc_reset', seq))).toBeNull()
      }
    )

    it('accepts zero', () => {
      expect(
        parseServerDocFrame(sequencedFrame('doc_reset', 0))?.data
      ).toMatchObject({ seq: 0 })
    })
  })

  it.for([-1, 1.5, Number.POSITIVE_INFINITY, Number.NaN, '1'])(
    'omits an invalid doc_subscribed seq while preserving the ack: %s',
    (seq) => {
      expect(
        parseServerDocFrame(sequencedFrame('doc_subscribed', seq))
      ).toEqual({
        type: 'doc_subscribed',
        data: { workflowId: 'wf-1', ok: true }
      })
    }
  )

  it('accepts doc_subscribed without seq', () => {
    expect(parseServerDocFrame(sequencedFrame('doc_subscribed'))).toEqual({
      type: 'doc_subscribed',
      data: { workflowId: 'wf-1', ok: true }
    })
  })

  it.for([-1, 1.5, Number.POSITIVE_INFINITY, Number.NaN, '1'])(
    'omits an invalid doc_ops_result seq while preserving the result: %s',
    (seq) => {
      expect(parseServerDocFrame(docOpsResultFrame(seq))).toEqual({
        type: 'doc_ops_result',
        data: {
          workflowId: 'wf-1',
          ok: true,
          applied: [],
          skipped: []
        }
      })
    }
  )

  it('accepts a valid doc_ops_result seq', () => {
    expect(parseServerDocFrame(docOpsResultFrame(0))?.data).toMatchObject({
      seq: 0
    })
  })

  it('accepts doc_ops_result without seq', () => {
    expect(parseServerDocFrame(docOpsResultFrame())?.data).not.toHaveProperty(
      'seq'
    )
  })

  it('accepts finite non-negative integer sequence and expiry values', () => {
    expect(parseServerDocFrame(updateFrame(0))?.data).toMatchObject({ seq: 0 })
    expect(parseServerDocFrame(awarenessFrame(0))?.data).toMatchObject({
      expiresAt: 0
    })
  })
})
