import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { WorkflowExecutionState } from '@/stores/executionStore'

import { useWorkflowExecutionState } from './useWorkflowExecutionState'

const _workflowExecutionStates = ref(new Map<string, WorkflowExecutionState>())
const _clearWorkflowExecutionResult = vi.fn()

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: () => ({
    getWorkflowExecutionState: (wid: string | undefined) => {
      if (!wid) return 'idle'
      return _workflowExecutionStates.value.get(wid) ?? 'idle'
    },
    clearWorkflowExecutionResult: _clearWorkflowExecutionResult
  })
}))

describe('useWorkflowExecutionState', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
    _workflowExecutionStates.value = new Map()
  })

  it('returns idle when workflowId is undefined', () => {
    const { state } = useWorkflowExecutionState(undefined)
    expect(state.value).toBe('idle')
  })

  it('returns idle when no execution data exists', () => {
    const { state } = useWorkflowExecutionState('workflow-1')
    expect(state.value).toBe('idle')
  })

  it('returns state from execution store map', () => {
    _workflowExecutionStates.value = new Map([['workflow-1', 'running']])
    const { state } = useWorkflowExecutionState('workflow-1')
    expect(state.value).toBe('running')
  })

  it('reacts to workflowId ref changes', () => {
    const wfId = ref<string | undefined>('workflow-1')
    _workflowExecutionStates.value = new Map([
      ['workflow-1', 'running'],
      ['workflow-2', 'error']
    ])

    const { state } = useWorkflowExecutionState(wfId)
    expect(state.value).toBe('running')

    wfId.value = 'workflow-2'
    expect(state.value).toBe('error')
  })

  it('clearResult delegates to executionStore', () => {
    const { clearResult } = useWorkflowExecutionState('workflow-1')
    clearResult()
    expect(_clearWorkflowExecutionResult).toHaveBeenCalledWith('workflow-1')
  })

  it('clearResult does nothing when workflowId is undefined', () => {
    const { clearResult } = useWorkflowExecutionState(undefined)
    clearResult()
    expect(_clearWorkflowExecutionResult).not.toHaveBeenCalled()
  })
})
