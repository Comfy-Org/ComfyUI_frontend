import { describe, expect, it } from 'vitest'

import { parseServerDocFrame } from './docFrameClient'

const resultFrame = (data: Record<string, unknown>) =>
  parseServerDocFrame({
    type: 'doc_ops_result',
    data: {
      v: 1,
      workflow_id: 'wf-1',
      ...data
    }
  })

describe('document frame result arrays and acknowledgements', () => {
  it('rejects a doc_update with a non-string op id', () => {
    expect(
      parseServerDocFrame({
        type: 'doc_update',
        data: {
          v: 1,
          workflow_id: 'wf-1',
          seq: 1,
          update_b64: 'AQ==',
          op_ids: ['op-1', 2]
        }
      })
    ).toBeNull()
  })

  it('treats null doc_update op ids as absent', () => {
    expect(
      parseServerDocFrame({
        type: 'doc_update',
        data: {
          v: 1,
          workflow_id: 'wf-1',
          seq: 1,
          update_b64: 'AQ==',
          op_ids: null
        }
      })
    ).toEqual({
      type: 'doc_update',
      data: {
        workflowId: 'wf-1',
        seq: 1,
        update: new Uint8Array([1])
      }
    })
  })

  it('rejects a non-string element in applied', () => {
    expect(resultFrame({ ok: true, seq: 1, applied: ['op-1', 2] })).toBeNull()
  })

  it('rejects a non-string element in skipped', () => {
    expect(resultFrame({ ok: true, seq: 1, skipped: ['op-1', 2] })).toBeNull()
  })

  it('rejects a failure with a missing index', () => {
    expect(
      resultFrame({
        ok: true,
        seq: 1,
        failed: {
          op_id: 'op-1',
          code: 'invalid_op',
          message: 'invalid operation'
        }
      })
    ).toBeNull()
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

  it('rejects a failure with a non-string op_id', () => {
    expect(
      resultFrame({
        ok: true,
        seq: 1,
        failed: {
          index: 0,
          op_id: 1,
          code: 'invalid_op',
          message: 'invalid operation'
        }
      })
    ).toBeNull()
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

  it('rejects present but malformed applied and skipped', () => {
    expect(resultFrame({ ok: true, seq: 1, applied: 'op-1' })).toBeNull()
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

  it('rejects oversized operation identities and diagnostics', () => {
    expect(resultFrame({ ok: true, applied: ['x'.repeat(129)] })).toBeNull()
    expect(resultFrame({ ok: false, code: 'x'.repeat(129) })).toBeNull()
    expect(
      resultFrame({ ok: false, message: 'x'.repeat((8 << 10) + 1) })
    ).toBeNull()
    expect(
      resultFrame({ ok: true, applied: Array.from({ length: 257 }, () => 'x') })
    ).toBeNull()
  })
})
