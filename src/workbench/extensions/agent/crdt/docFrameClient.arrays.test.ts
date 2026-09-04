import { describe, expect, it } from 'vitest'

import {
  docOpsResultFrame,
  docUpdateFrame
} from './__fixtures__/docFrameClient'
import { parseServerDocFrame } from './docFrameClient'

function resultFrame(data: Record<string, unknown>) {
  return parseServerDocFrame(docOpsResultFrame(data))
}

const invalidResultFrames: [string, Record<string, unknown>][] = [
  ['a non-string applied item', { ok: true, seq: 1, applied: ['op-1', 2] }],
  ['a non-string skipped item', { ok: true, seq: 1, skipped: ['op-1', 2] }],
  ['a non-array applied value', { ok: true, seq: 1, applied: 'op-1' }],
  ['an empty operation identity', { ok: true, applied: [''] }],
  ['an operation identity with controls', { ok: true, applied: ['op\n1'] }],
  ['an oversized operation identity', { ok: true, applied: ['x'.repeat(129)] }],
  [
    'too many operation identities',
    { ok: true, applied: Array.from({ length: 257 }, () => 'x') }
  ]
]

describe('document frame result arrays and acknowledgements', () => {
  it('rejects a doc_update with a non-string op id', () => {
    expect(
      parseServerDocFrame(docUpdateFrame({ op_ids: ['op-1', 2] }))
    ).toBeNull()
  })

  it('treats null doc_update op ids as absent', () => {
    expect(parseServerDocFrame(docUpdateFrame({ op_ids: null }))).toEqual({
      type: 'doc_update',
      data: {
        workflowId: 'wf-1',
        seq: 1,
        update: new Uint8Array([1])
      }
    })
  })

  it.for(invalidResultFrames)('rejects %s', ([_name, data]) => {
    expect(resultFrame(data)).toBeNull()
  })

  it('omits malformed advisory result fields', () => {
    expect(
      resultFrame({
        ok: false,
        seq: '1',
        applied: ['op-1'],
        code: 1,
        message: 'x'.repeat((8 << 10) + 1),
        failed: {
          op_id: 'op-2',
          code: 'invalid_op',
          message: 'invalid operation'
        }
      })
    ).toEqual({
      type: 'doc_ops_result',
      data: {
        workflowId: 'wf-1',
        ok: false,
        applied: ['op-1'],
        skipped: []
      }
    })
  })

  it('accepts a failure without an op_id (relay omits it when unmapped)', () => {
    expect(
      resultFrame({
        ok: false,
        code: 'invalid_op',
        message: 'invalid operation',
        failed: { index: 0, code: 'invalid_op', message: 'invalid operation' }
      })
    ).toEqual({
      type: 'doc_ops_result',
      data: {
        workflowId: 'wf-1',
        ok: false,
        applied: [],
        skipped: [],
        code: 'invalid_op',
        message: 'invalid operation',
        failed: { index: 0, code: 'invalid_op', message: 'invalid operation' }
      }
    })
  })

  it('accepts a successful acknowledgement without a sequence', () => {
    expect(resultFrame({ ok: true })).toEqual({
      type: 'doc_ops_result',
      data: {
        workflowId: 'wf-1',
        ok: true,
        applied: [],
        skipped: []
      }
    })
  })

  it('accepts a failed acknowledgement without a code', () => {
    expect(resultFrame({ ok: false, message: 'batch rejected' })).toEqual({
      type: 'doc_ops_result',
      data: {
        workflowId: 'wf-1',
        ok: false,
        applied: [],
        skipped: [],
        message: 'batch rejected'
      }
    })
  })

  // The relay serialises applied/skipped with `omitempty`: rejections carry
  // neither, a fully-applied batch carries no `skipped`, and an all-redelivery
  // no-op carries no `applied`. Absent must read as empty, not malformed.
  it('accepts a relay rejection that omits applied and skipped', () => {
    expect(
      resultFrame({ ok: false, code: 'invalid_frame', message: 'bad frame' })
    ).toEqual({
      type: 'doc_ops_result',
      data: {
        workflowId: 'wf-1',
        ok: false,
        applied: [],
        skipped: [],
        code: 'invalid_frame',
        message: 'bad frame'
      }
    })
  })

  it('accepts a fully applied acknowledgement that omits skipped', () => {
    expect(resultFrame({ ok: true, seq: 7, applied: ['op-1'] })).toEqual({
      type: 'doc_ops_result',
      data: {
        workflowId: 'wf-1',
        ok: true,
        seq: 7,
        applied: ['op-1'],
        skipped: []
      }
    })
  })

  it('accepts an all-redelivery acknowledgement that omits applied', () => {
    expect(resultFrame({ ok: true, seq: 7, skipped: ['op-1'] })).toEqual({
      type: 'doc_ops_result',
      data: {
        workflowId: 'wf-1',
        ok: true,
        seq: 7,
        applied: [],
        skipped: ['op-1']
      }
    })
  })

  it('treats null result arrays as absent', () => {
    expect(resultFrame({ ok: true, seq: 1, skipped: null })).toEqual({
      type: 'doc_ops_result',
      data: {
        workflowId: 'wf-1',
        ok: true,
        seq: 1,
        applied: [],
        skipped: []
      }
    })
  })

  it('accepts strictly typed result arrays and failure data', () => {
    expect(
      resultFrame({
        ok: false,
        applied: ['op-1'],
        skipped: ['op-2'],
        code: 'invalid_op',
        message: 'invalid operation',
        failed: {
          index: 2,
          op_id: 'op-3',
          code: 'invalid_op',
          message: 'invalid operation'
        }
      })
    ).toEqual({
      type: 'doc_ops_result',
      data: {
        workflowId: 'wf-1',
        ok: false,
        applied: ['op-1'],
        skipped: ['op-2'],
        code: 'invalid_op',
        message: 'invalid operation',
        failed: {
          index: 2,
          op_id: 'op-3',
          code: 'invalid_op',
          message: 'invalid operation'
        }
      }
    })
  })

  it('strips unrecognized failure properties', () => {
    expect(
      resultFrame({
        ok: false,
        failed: {
          index: 0,
          op_id: 'op-1',
          code: 'invalid_op',
          message: 'invalid operation',
          private_context: 'must not escape the parser'
        }
      })
    ).toMatchObject({
      data: {
        failed: {
          index: 0,
          op_id: 'op-1',
          code: 'invalid_op',
          message: 'invalid operation'
        }
      }
    })
    expect(
      resultFrame({
        ok: false,
        failed: {
          index: 0,
          op_id: 'op-1',
          code: 'invalid_op',
          message: 'invalid operation',
          private_context: 'must not escape the parser'
        }
      })?.data
    ).not.toHaveProperty('failed.private_context')
  })
})
