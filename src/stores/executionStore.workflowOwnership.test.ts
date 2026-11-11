import { reportError } from '@comfyorg/telemetry/reportError'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'
import { zeroUuid } from '@comfyorg/graph-model/uuid'
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
    activeState: { id: 'shared-graph-id' },
    initialState: { id: 'shared-graph-id' }
  })
}

const workflowA = workflow('workflows/a.json')
const workflowB = workflow('workflows/b.json')

function promptNode() {
  return { inputs: {}, class_type: 'TestNode', _meta: { title: 'Node' } }
}

function openTabs(...workflows: LoadedComfyWorkflow[]) {
  const workflowStore = useWorkflowStore()
  for (const wf of workflows) {
    if (workflowStore.isOpen(wf)) continue
    workflowStore.attachWorkflow(wf, workflowStore.openWorkflows.length)
  }
}

describe('executionStore workflow ownership', () => {
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

  function queueJobFrom(jobId: string, wf: LoadedComfyWorkflow) {
    store.storeJob({
      nodes: ['1'],
      id: jobId,
      promptOutput: { '1': promptNode() },
      workflow: wf,
      mode: 'graph'
    })
  }

  function fire(event: string, detail: Record<string, unknown>) {
    apiEvents.dispatchEvent(new CustomEvent(event, { detail }))
  }

  it('does not separate two tabs by their shared graph id', () => {
    queueJobFrom('job-a', workflowA)
    queueJobFrom('job-b', workflowB)

    expect(store.rememberStampAndCheckActiveWorkflow('job-a')).toBe(true)
    expect(store.rememberStampAndCheckActiveWorkflow('job-b')).toBe(false)
  })

  it('accepts a frame that names no job at all', () => {
    expect(store.rememberStampAndCheckActiveWorkflow(undefined)).toBe(true)
  })

  describe('the session path, when no tab instance is known', () => {
    it('places a job by the path it was queued from', () => {
      store.ensureSessionWorkflowPath('job-b', workflowB.path)

      expect(store.rememberStampAndCheckActiveWorkflow('job-b')).toBe(false)
      useWorkflowStore().activeWorkflow = workflowB
      expect(store.rememberStampAndCheckActiveWorkflow('job-b')).toBe(true)
    })

    it('loses to the tab instance when the two disagree', () => {
      queueJobFrom('job-a', workflowA)
      store.ensureSessionWorkflowPath(
        'job-a',
        workflowB.path,
        workflowA.instanceId
      )

      useWorkflowStore().activeWorkflow = workflowB
      expect(
        store.rememberStampAndCheckActiveWorkflow('job-a'),
        'the instance still says A, so B does not own it'
      ).toBe(false)
    })
  })

  describe("the frame's own workflow id, when no per-tab mapping exists", () => {
    it('places a job queued before this page load', () => {
      expect(
        store.rememberStampAndCheckActiveWorkflow(
          'job-from-a-previous-page',
          'other-graph'
        )
      ).toBe(false)
      expect(
        store.rememberStampAndCheckActiveWorkflow(
          'job-from-a-previous-page',
          'shared-graph-id'
        )
      ).toBe(true)
    })

    it('ignores the all-zero sentinel rather than comparing it', () => {
      expect(
        store.rememberStampAndCheckActiveWorkflow(
          'job-on-a-fresh-graph',
          zeroUuid
        )
      ).toBe(true)
    })

    it('reaches the gate from a real progress_state frame', async () => {
      fire('progress_state', {
        prompt_id: 'job-elsewhere',
        workflow_id: 'other-graph',
        nodes: {
          '1': {
            value: 3,
            max: 10,
            state: 'running',
            node_id: '1',
            prompt_id: 'job-elsewhere'
          }
        }
      })
      await vi.waitFor(() =>
        expect(store.nodeProgressStatesByJob['job-elsewhere']).toBeDefined()
      )

      expect(
        store.nodeProgressStates['1'],
        "a frame stamped with another graph's id does not reach the visible tab"
      ).toBeUndefined()
    })

    it('loses to the session path when the two disagree', () => {
      store.ensureSessionWorkflowPath('job-b', workflowB.path)

      expect(
        store.rememberStampAndCheckActiveWorkflow('job-b', 'shared-graph-id'),
        'the path says B owns it, even though the graph id matches A'
      ).toBe(false)
    })
  })

  describe('the stamp remembered from an earlier frame of the same job', () => {
    function foreignJobStarted(jobId: string, workflowId?: string) {
      fire('execution_start', {
        prompt_id: jobId,
        workflow_id: workflowId,
        timestamp: 1
      })
      return jobId
    }

    it('places a job for a caller that holds no frame', () => {
      foreignJobStarted('job-elsewhere', 'other-graph')

      expect(
        store.rememberStampAndCheckActiveWorkflow('job-elsewhere'),
        'the stamp seen on execution_start still decides when no id is passed'
      ).toBe(false)
    })

    it('keeps the first stamp when a later frame disagrees', () => {
      foreignJobStarted('job-elsewhere', 'other-graph')

      store.rememberStampAndCheckActiveWorkflow(
        'job-elsewhere',
        'shared-graph-id'
      )

      expect(
        store.rememberStampAndCheckActiveWorkflow('job-elsewhere'),
        'the later stamp must not relabel the job onto the visible tab'
      ).toBe(false)
    })

    it('loses to the tab instance, which is still the strongest leg', () => {
      queueJobFrom('job-a', workflowA)
      store.rememberStampAndCheckActiveWorkflow('job-a', 'other-graph')

      useWorkflowStore().activeWorkflow = workflowB
      expect(
        store.rememberStampAndCheckActiveWorkflow('job-a'),
        'the instance says A, so the remembered stamp must not outrank it'
      ).toBe(false)
      useWorkflowStore().activeWorkflow = workflowA
      expect(store.rememberStampAndCheckActiveWorkflow('job-a')).toBe(true)
    })

    it('loses to the session path', () => {
      store.ensureSessionWorkflowPath('job-b', workflowB.path)
      store.rememberStampAndCheckActiveWorkflow('job-b', 'shared-graph-id')

      expect(
        store.rememberStampAndCheckActiveWorkflow('job-b'),
        'the path says B owns it, even though the remembered stamp matches A'
      ).toBe(false)
    })

    it('stops a tab switch from adopting a foreign job', async () => {
      foreignJobStarted('job-elsewhere', 'other-graph')
      expect(store.queuedJobs['job-elsewhere']).toBeDefined()

      useWorkflowStore().activeWorkflow = workflowB
      await nextTick()

      expect(store.activeJobId).toBeNull()
    })

    it('is forgotten with the job', () => {
      foreignJobStarted('job-elsewhere', 'other-graph')

      store.forgetFinishedJobs(['job-elsewhere'])

      expect(
        store.rememberStampAndCheckActiveWorkflow('job-elsewhere'),
        'nothing is left to place the job, so the fallback admits it again'
      ).toBe(true)
    })
  })

  describe('reporting a rejected execution_start', () => {
    function rejectionWarnings() {
      return vi
        .mocked(reportError)
        .mock.calls.filter(
          ([, options]) =>
            options.errorType === 'warning_rejecting_unowned_execution_start'
        )
    }

    it('does not report a rejection decided by the frame workflow id', () => {
      fire('execution_start', {
        prompt_id: 'job-elsewhere',
        workflow_id: 'other-graph',
        timestamp: 1
      })

      expect(store.activeJobId, 'the frame was still rejected').toBeNull()
      expect(rejectionWarnings()).toHaveLength(0)
    })

    it('does not report a rejection decided by the session path', () => {
      store.ensureSessionWorkflowPath('job-b', workflowB.path)

      fire('execution_start', { prompt_id: 'job-b', timestamp: 1 })

      expect(store.activeJobId).toBeNull()
      expect(rejectionWarnings()).toHaveLength(0)
    })
  })
})
