/**
 * Op-outcome surfacing (FEB-6 / s1-D). The behaviour under test: a host
 * `doc_ops_result` with `ok:false` classifies into a visible nack summary
 * (never a rollback — the applied prefix stays applied), and a projection
 * throw is reported instead of vanishing inside the EventTarget dispatch.
 */
import { describe, expect, it, vi } from 'vitest'

import { classifyOpsResult, runProjection } from './opOutcome'

describe('classifyOpsResult', () => {
  it('returns null for a clean result', () => {
    expect(
      classifyOpsResult({
        workflowId: 'wf-1',
        ok: true,
        applied: ['op-1'],
        skipped: []
      })
    ).toBeNull()
  })

  it('returns null for malformed payloads', () => {
    expect(classifyOpsResult(null)).toBeNull()
    expect(classifyOpsResult(undefined)).toBeNull()
    expect(classifyOpsResult('ok')).toBeNull()
    expect(classifyOpsResult(42)).toBeNull()
    // ok missing entirely → not a nack (only an explicit ok:false is)
    expect(classifyOpsResult({ workflowId: 'wf-1' })).toBeNull()
  })

  it('summarizes an ok:false result, counting the applied prefix and skips', () => {
    const nack = classifyOpsResult({
      workflowId: 'wf-1',
      ok: false,
      applied: ['op-1', 'op-2'],
      skipped: ['op-3'],
      code: 'invalid_node_payload',
      message: 'node payload failed schema check',
      failed: { op_id: 'op-4', code: 'invalid_node_payload' }
    })
    expect(nack).toEqual({
      workflowId: 'wf-1',
      code: 'invalid_node_payload',
      message: 'node payload failed schema check',
      failed: { op_id: 'op-4', code: 'invalid_node_payload' },
      applied: 2,
      skipped: 1
    })
  })

  it('tolerates missing optional fields on a nack', () => {
    expect(classifyOpsResult({ ok: false })).toEqual({
      workflowId: null,
      code: null,
      message: null,
      failed: null,
      applied: 0,
      skipped: 0
    })
  })
})

describe('runProjection', () => {
  it('passes the mutation count through on success without reporting', () => {
    const report = vi.fn()
    expect(runProjection(() => 3, report)).toBe(3)
    expect(report).not.toHaveBeenCalled()
  })

  it('reports an Error throw with its message and returns 0', () => {
    const report = vi.fn()
    const boom = new Error('mutator exploded')
    expect(
      runProjection(() => {
        throw boom
      }, report)
    ).toBe(0)
    expect(report).toHaveBeenCalledOnce()
    expect(report).toHaveBeenCalledWith({ message: 'mutator exploded' }, boom)
  })

  it('reports a non-Error throw stringified', () => {
    const report = vi.fn()
    expect(
      runProjection(() => {
        throw 'string failure'
      }, report)
    ).toBe(0)
    expect(report).toHaveBeenCalledWith(
      { message: 'string failure' },
      'string failure'
    )
  })
})
