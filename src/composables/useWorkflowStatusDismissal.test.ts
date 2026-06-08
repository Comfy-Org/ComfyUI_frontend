import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import type { WorkflowExecutionStatus } from '@/stores/executionStore'

const { mockActiveWorkflow, statusMap } = await vi.hoisted(async () => {
  const { shallowRef } = await import('vue')
  return {
    mockActiveWorkflow: shallowRef<object | null>(null),
    statusMap: shallowRef<Map<object, WorkflowExecutionStatus>>(new Map())
  }
})

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    get activeWorkflow() {
      return mockActiveWorkflow.value
    }
  })
}))

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: () => ({
    getWorkflowStatus: (workflow: object | null | undefined) =>
      workflow ? statusMap.value.get(workflow) : undefined,
    clearWorkflowStatus: (workflow: object) => {
      const next = new Map(statusMap.value)
      next.delete(workflow)
      statusMap.value = next
    }
  })
}))

import { useWorkflowStatusDismissal } from './useWorkflowStatusDismissal'

const workflowA = { path: '/a.json' }
const workflowB = { path: '/b.json' }

function mount() {
  const scope = effectScope()
  scope.run(() => useWorkflowStatusDismissal())
  return () => scope.stop()
}

describe('useWorkflowStatusDismissal', () => {
  beforeEach(() => {
    mockActiveWorkflow.value = null
    statusMap.value = new Map()
  })

  it('clears a terminal status when its workflow becomes active', async () => {
    statusMap.value = new Map([[workflowA, 'completed']])
    const stop = mount()

    mockActiveWorkflow.value = workflowA
    await nextTick()

    expect(statusMap.value.has(workflowA)).toBe(false)
    stop()
  })

  it('clears a terminal status that arrives while the workflow is active', async () => {
    mockActiveWorkflow.value = workflowA
    const stop = mount()

    statusMap.value = new Map([[workflowA, 'failed']])
    await nextTick()

    expect(statusMap.value.has(workflowA)).toBe(false)
    stop()
  })

  it('keeps a running status on the active workflow', async () => {
    mockActiveWorkflow.value = workflowA
    const stop = mount()

    statusMap.value = new Map([[workflowA, 'running']])
    await nextTick()

    expect(statusMap.value.get(workflowA)).toBe('running')
    stop()
  })

  it('leaves other workflows untouched', async () => {
    statusMap.value = new Map([
      [workflowA, 'completed'],
      [workflowB, 'completed']
    ])
    const stop = mount()

    mockActiveWorkflow.value = workflowA
    await nextTick()

    expect(statusMap.value.has(workflowA)).toBe(false)
    expect(statusMap.value.get(workflowB)).toBe('completed')
    stop()
  })
})
