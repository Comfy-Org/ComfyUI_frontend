import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef, markRaw } from 'vue'
import { storeToRefs } from 'pinia'
import type { Ref } from 'vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useExecutionStore } from '@/stores/executionStore'

import type { WorkflowExecutionStatus } from '@/stores/executionStore'

let mockActiveWorkflow: Ref<ComfyWorkflow | null>
const statusMap = shallowRef(new Map<ComfyWorkflow, WorkflowExecutionStatus>())

import { useWorkflowStatusDismissal } from './useWorkflowStatusDismissal'

const workflowA = markRaw(fromPartial<ComfyWorkflow>({ path: '/a.json' }))
const workflowB = markRaw(fromPartial<ComfyWorkflow>({ path: '/b.json' }))

function mount() {
  const scope = effectScope()
  scope.run(() => useWorkflowStatusDismissal())
  return () => scope.stop()
}

describe('useWorkflowStatusDismissal', () => {
  beforeEach(() => {
    mockActiveWorkflow = storeToRefs(useWorkflowStore()).activeWorkflow
    const executionStore = useExecutionStore()
    vi.mocked(executionStore.getWorkflowStatus).mockImplementation(
      (workflow) => (workflow ? statusMap.value.get(workflow) : undefined)
    )
    vi.mocked(executionStore.clearWorkflowStatus).mockImplementation(
      (workflow) => {
        statusMap.value = new Map(
          [...statusMap.value].filter(([entry]) => entry !== workflow)
        )
      }
    )
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
