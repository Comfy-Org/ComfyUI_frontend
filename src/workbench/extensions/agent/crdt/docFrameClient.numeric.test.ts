import { describe, expect, it } from 'vitest'

import { encodeBase64, parseServerDocFrame } from './docFrameClient'

const updateFrame = (seq: unknown) => ({
  type: 'doc_update',
  data: {
    v: 1,
    workflow_id: 'wf-1',
    seq,
    update_b64: encodeBase64(new Uint8Array())
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

  it.for([
    ['doc_subscribed', { ok: true }],
    ['doc_reset', {}]
  ])('rejects an invalid %s seq', (type, data) => {
    expect(
      parseServerDocFrame({
        type,
        data: { v: 1, workflow_id: 'wf-1', seq: -1, ...data }
      })
    ).toBeNull()
  })

  it('accepts finite non-negative integer sequence and expiry values', () => {
    expect(parseServerDocFrame(updateFrame(0))?.data).toMatchObject({ seq: 0 })
    expect(parseServerDocFrame(awarenessFrame(0))?.data).toMatchObject({
      expiresAt: 0
    })
  })
})
