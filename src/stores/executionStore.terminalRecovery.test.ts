import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'

vi.mock(import('@/composables/useAppMode'))
vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

const apiEvents: EventTarget = api

function workflow(path: string): LoadedComfyWorkflow {
  return fromPartial<LoadedComfyWorkflow>({
    path,
    instanceId: `instance-${path}`,
    activeState: { id: `graph-${path}` },
    initialState: { id: `graph-${path}` }
  })
}

const workflowA = workflow('workflows/a.json')
const workflowB = workflow('workflows/b.json')

/**
 * Register tabs through the real store, so `isOpen` and `openWorkflows` are the
 * production implementations. A hand-built double would keep passing if
 * `isOpen` changed what it keys on, and `applyWorkflowStatus` refuses to record
 * a status for a workflow the store does not consider open.
 */
function openTabs(...workflows: LoadedComfyWorkflow[]) {
  const workflowStore = useWorkflowStore()
  for (const wf of workflows) {
    if (workflowStore.isOpen(wf)) continue
    workflowStore.attachWorkflow(wf, workflowStore.openWorkflows.length)
  }
}

describe('executionStore terminal-frame recovery', () => {
  let store: ReturnType<typeof useExecutionStore>

  beforeEach(() => {
    openTabs(workflowA, workflowB)
    useWorkflowStore().activeWorkflow = workflowA
    store = useExecutionStore()
    store.bindExecutionEvents()
  })

  /**
   * A job that started and then never reported a terminal frame: the frame was
   * dropped, or the socket went away before it arrived.
   */
  function startedJobWithNoTerminalFrame(
    jobId: string,
    wf: LoadedComfyWorkflow
  ) {
    store.storeJob({
      nodes: ['1'],
      id: jobId,
      promptOutput: { '1': { inputs: {}, class_type: 'TestNode' } },
      workflow: wf,
      mode: 'graph'
    })
    apiEvents.dispatchEvent(
      new CustomEvent('execution_start', {
        detail: { prompt_id: jobId, timestamp: 1 }
      })
    )
    apiEvents.dispatchEvent(
      new CustomEvent('progress_state', {
        detail: {
          prompt_id: jobId,
          nodes: {
            '1': {
              value: 3,
              max: 10,
              state: 'running',
              node_id: '1',
              prompt_id: jobId
            }
          }
        }
      })
    )
    return jobId
  }

  it('releases the tab status of a job it forgets', () => {
    const jobId = startedJobWithNoTerminalFrame('job-b', workflowB)
    expect(store.getWorkflowStatus(workflowB)).toBe('running')

    store.forgetFinishedJobs([jobId])

    expect(
      store.getWorkflowStatus(workflowB),
      'the badge must not keep claiming the tab is running'
    ).toBeUndefined()
  })

  it('leaves a job the server still reports as running alone', async () => {
    const jobId = startedJobWithNoTerminalFrame('job-b', workflowB)
    // progress_state is RAF-coalesced, so the per-job record lands a frame later.
    await vi.waitFor(() =>
      expect(store.nodeProgressStatesByJob[jobId]).toBeDefined()
    )

    store.forgetFinishedJobs([])

    expect(store.getWorkflowStatus(workflowB)).toBe('running')
    expect(store.nodeProgressStatesByJob[jobId]).toBeDefined()
  })

  it('does not disturb a second tab while forgetting one job', () => {
    startedJobWithNoTerminalFrame('job-a', workflowA)
    const jobB = startedJobWithNoTerminalFrame('job-b', workflowB)

    store.forgetFinishedJobs([jobB])

    expect(
      store.getWorkflowStatus(workflowA),
      'A never went terminal, so forgetting B must not release it'
    ).toBe('running')
  })
})
