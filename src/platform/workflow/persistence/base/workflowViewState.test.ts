import { describe, expect, it } from 'vitest'

import { defaultGraph } from '@/scripts/defaultGraph'
import {
  getValidWorkflowViewState,
  withWorkflowViewState,
  workflowViewStateEqual
} from './workflowViewState'

describe('workflowViewState', () => {
  it('accepts valid viewport data and rejects malformed saved data', () => {
    expect(
      getValidWorkflowViewState({ scale: 0.75, offset: [12, -4] })
    ).toEqual({ scale: 0.75, offset: [12, -4] })
    expect(getValidWorkflowViewState({ scale: 1 })).toBeNull()
    expect(getValidWorkflowViewState({ scale: 0, offset: [0, 0] })).toBeNull()
    expect(getValidWorkflowViewState({ scale: -1, offset: [0, 0] })).toBeNull()
    expect(
      getValidWorkflowViewState({
        scale: Number.POSITIVE_INFINITY,
        offset: [0, 0]
      })
    ).toBeNull()
    expect(
      getValidWorkflowViewState({ scale: 1, offset: [0, Number.NaN] })
    ).toBeNull()
  })

  it('adds the current viewport without mutating the serialized workflow', () => {
    const workflow = structuredClone(defaultGraph)
    const result = withWorkflowViewState(
      workflow,
      { scale: 0.8, offset: [23, -17] },
      true
    )

    expect(result).not.toBe(workflow)
    expect(result.extra?.ds).toEqual({ scale: 0.8, offset: [23, -17] })
    expect(workflow.extra?.ds).not.toEqual(result.extra?.ds)
  })

  it('returns the original workflow when view restore is disabled or unavailable', () => {
    const workflow = structuredClone(defaultGraph)
    const viewState = { scale: 0.8, offset: [23, -17] } as const

    expect(withWorkflowViewState(workflow, viewState, false)).toBe(workflow)
    expect(withWorkflowViewState(workflow, undefined, true)).toBe(workflow)
    expect(workflow.extra?.ds).toEqual(defaultGraph.extra?.ds)
  })

  it('compares only validated viewport values', () => {
    expect(
      workflowViewStateEqual(
        { scale: 0.8, offset: [23, -17] },
        { scale: 0.8, offset: [23, -17] }
      )
    ).toBe(true)
    expect(
      workflowViewStateEqual(
        { scale: 0.8, offset: [23, -17] },
        { scale: 0.8, offset: [23, -18] }
      )
    ).toBe(false)
    expect(workflowViewStateEqual({ scale: 1 }, undefined)).toBe(true)
    expect(
      workflowViewStateEqual({ scale: 0.8, offset: [23, -17] }, { scale: 1 })
    ).toBe(false)
    expect(
      workflowViewStateEqual({ scale: 1 }, { scale: 0.8, offset: [23, -17] })
    ).toBe(false)
  })
})
