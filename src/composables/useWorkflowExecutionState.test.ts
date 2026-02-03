import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { WorkflowExecutionResult } from '@/stores/executionStore'

import { useWorkflowExecutionState } from './useWorkflowExecutionState'

const _runningPromptIds = ref<string[]>([])
const _promptIdToWorkflowId = ref(new Map<string, string>())
const _lastExecutionResultByWorkflowId = ref(
  new Map<string, WorkflowExecutionResult>()
)
const _clearWorkflowExecutionResult = vi.fn((wid: string) => {
  const next = new Map(_lastExecutionResultByWorkflowId.value)
  next.delete(wid)
  _lastExecutionResultByWorkflowId.value = next
})

vi.mock('@/stores/executionStore', () => {
  return {
    useExecutionStore: () => ({
      get runningPromptIds() {
        return _runningPromptIds.value
      },
      get promptIdToWorkflowId() {
        return _promptIdToWorkflowId.value
      },
      get lastExecutionResultByWorkflowId() {
        return _lastExecutionResultByWorkflowId.value
      },
      clearWorkflowExecutionResult: _clearWorkflowExecutionResult
    })
  }
})

describe('useWorkflowExecutionState', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    _runningPromptIds.value = []
    _promptIdToWorkflowId.value.clear()
    _lastExecutionResultByWorkflowId.value.clear()
  })

  it('returns idle when workflowId is undefined', () => {
    const { state } = useWorkflowExecutionState(undefined)
    expect(state.value).toBe('idle')
  })

  it('returns idle when no execution data exists', () => {
    const { state } = useWorkflowExecutionState('workflow-1')
    expect(state.value).toBe('idle')
  })

  it('returns running when workflow has an active prompt', () => {
    _promptIdToWorkflowId.value.set('prompt-1', 'workflow-1')
    _runningPromptIds.value = ['prompt-1']

    const { state } = useWorkflowExecutionState('workflow-1')
    expect(state.value).toBe('running')
  })

  it('returns completed when last result was success', () => {
    _lastExecutionResultByWorkflowId.value.set('workflow-1', {
      state: 'completed',
      timestamp: Date.now(),
      promptId: 'prompt-1'
    })

    const { state } = useWorkflowExecutionState('workflow-1')
    expect(state.value).toBe('completed')
  })

  it('returns error when last result was error', () => {
    _lastExecutionResultByWorkflowId.value.set('workflow-1', {
      state: 'error',
      timestamp: Date.now(),
      promptId: 'prompt-1'
    })

    const { state } = useWorkflowExecutionState('workflow-1')
    expect(state.value).toBe('error')
  })

  it('prioritizes running over completed/error', () => {
    _promptIdToWorkflowId.value.set('prompt-2', 'workflow-1')
    _runningPromptIds.value = ['prompt-2']
    _lastExecutionResultByWorkflowId.value.set('workflow-1', {
      state: 'completed',
      timestamp: Date.now(),
      promptId: 'prompt-1'
    })

    const { state } = useWorkflowExecutionState('workflow-1')
    expect(state.value).toBe('running')
  })

  it('clearResult removes the execution result', () => {
    _lastExecutionResultByWorkflowId.value.set('workflow-1', {
      state: 'completed',
      timestamp: Date.now(),
      promptId: 'prompt-1'
    })

    const { state, clearResult } = useWorkflowExecutionState('workflow-1')
    expect(state.value).toBe('completed')

    clearResult()

    expect(state.value).toBe('idle')
  })
})
