import { describe, expect, it } from 'vitest'

import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'

import { workflowTelemetryId } from './workflowTelemetryId'

function fakeWorkflow(
  activeId: string | null,
  initialId: string | null
): ComfyWorkflow {
  return {
    activeState: activeId === null ? null : { id: activeId },
    initialState: initialId === null ? null : { id: initialId }
  } as unknown as ComfyWorkflow
}

describe('workflowTelemetryId', () => {
  it('prefers the active state id', () => {
    expect(workflowTelemetryId(fakeWorkflow('active-1', 'initial-1'))).toBe(
      'active-1'
    )
  })

  it('falls back to the initial state id when the active state has no id', () => {
    expect(workflowTelemetryId(fakeWorkflow(null, 'initial-1'))).toBe(
      'initial-1'
    )
  })

  it('returns undefined when no id is available', () => {
    expect(workflowTelemetryId(fakeWorkflow(null, null))).toBeUndefined()
    expect(workflowTelemetryId(null)).toBeUndefined()
    expect(workflowTelemetryId(undefined)).toBeUndefined()
  })
})
