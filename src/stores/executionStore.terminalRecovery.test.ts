import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'
import { createMockLoadedWorkflow } from '@/utils/__tests__/litegraphTestUtils'

vi.mock(import('@/composables/useAppMode'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@comfyorg/telemetry/reportError'))
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

const apiEvents: EventTarget = api

function workflow(path: string): LoadedComfyWorkflow {
  return createMockLoadedWorkflow({
    path,
    instanceId: `instance-${path}`,
    activeState: { id: `graph-${path}` },
    initialState: { id: `graph-${path}` }
  })
}

const workflowA = workflow('workflows/a.json')
const workflowB = workflow('workflows/b.json')

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

  afterEach(() => {
    store.unbindExecutionEvents()
  })

  function queueJob(jobId: string, wf: LoadedComfyWorkflow) {
    store.storeJob({
      nodes: ['1'],
      id: jobId,
      promptOutput: { '1': { inputs: {}, class_type: 'TestNode' } },
      workflow: wf,
      mode: 'graph'
    })
    return jobId
  }

  function startedJobWithNoTerminalFrame(
    jobId: string,
    wf: LoadedComfyWorkflow
  ) {
    queueJob(jobId, wf)
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

  it('does not disturb a second tab while forgetting one job', () => {
    startedJobWithNoTerminalFrame('job-a', workflowA)
    const jobB = startedJobWithNoTerminalFrame('job-b', workflowB)

    store.forgetFinishedJobs([jobB])

    expect(
      store.getWorkflowStatus(workflowA),
      'A never went terminal, so forgetting B must not release it'
    ).toBe('running')
  })

  const siblingCases: {
    name: string
    registerSibling: () => string
    expectedStatus: 'running' | undefined
  }[] = [
    {
      name: 'started',
      registerSibling: () =>
        startedJobWithNoTerminalFrame('job-b-2', workflowB),
      expectedStatus: 'running'
    },
    {
      name: 'pending',
      registerSibling: () => queueJob('job-b-2', workflowB),
      expectedStatus: undefined
    }
  ]

  it.for(siblingCases)(
    'keeps the tab running only while a $name sibling holds it',
    ({ registerSibling, expectedStatus }) => {
      const firstJob = startedJobWithNoTerminalFrame('job-b-1', workflowB)
      registerSibling()

      store.forgetFinishedJobs([firstJob])

      expect(store.getWorkflowStatus(workflowB)).toBe(expectedStatus)
      expect(store.queuedJobs[firstJob]).toBeUndefined()
      expect(store.queuedJobs['job-b-2']).toBeDefined()
    }
  )

  it('keeps a newer terminal badge when an older unreadable job is forgotten', () => {
    const staleJob = startedJobWithNoTerminalFrame('job-b-stale', workflowB)
    const completedJob = startedJobWithNoTerminalFrame(
      'job-b-completed',
      workflowB
    )
    apiEvents.dispatchEvent(
      new CustomEvent('execution_success', {
        detail: { prompt_id: completedJob, timestamp: 2 }
      })
    )
    expect(store.getWorkflowStatus(workflowB)).toBe('completed')
    expect(
      store.queuedJobs[completedJob],
      'the completed job is already forgotten, so it cannot hold the badge'
    ).toBeUndefined()

    store.forgetFinishedJobs([staleJob])

    expect(
      store.getWorkflowStatus(workflowB),
      'only an orphaned running badge may be released'
    ).toBe('completed')
  })
})
