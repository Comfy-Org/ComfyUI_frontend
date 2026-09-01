import { describe, expect, it } from 'vitest'

import { parseServerDocFrame } from './docFrameClient'

const resultFrame = (data: Record<string, unknown>) =>
  parseServerDocFrame({
    type: 'doc_ops_result',
    data: {
      v: 1,
      workflow_id: 'wf-1',
      applied: [],
      skipped: [],
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

  it('rejects a successful acknowledgement without a sequence', () => {
    expect(resultFrame({ ok: true })).toBeNull()
  })

  it('rejects a failed acknowledgement without a code', () => {
    expect(resultFrame({ ok: false, message: 'batch rejected' })).toBeNull()
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
})
