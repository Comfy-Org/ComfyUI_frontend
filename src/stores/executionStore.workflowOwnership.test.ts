import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'
import { zeroUuid } from '@/utils/uuid'

vi.mock(import('@/composables/useAppMode'))
vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

const apiEvents: EventTarget = api

/**
 * `instanceId` is the only identifier unique per open tab. A workflow id is
 * shared by every copy of a graph, and a path is shared by a workflow reopened
 * in a second tab, so neither can decide which tab a frame belongs to.
 */
function workflow(path: string): LoadedComfyWorkflow {
  return fromPartial<LoadedComfyWorkflow>({
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

describe('executionStore workflow ownership', () => {
  let store: ReturnType<typeof useExecutionStore>

  beforeEach(() => {
    openTabs(workflowA, workflowB)
    useWorkflowStore().activeWorkflow = workflowA
    store = useExecutionStore()
    store.bindExecutionEvents()
  })

  /** Queue a job from `wf`, which is what records its owning tab. */
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

  it('rejects a frame owned by another open tab', () => {
    queueJobFrom('job-b', workflowB)

    expect(store.belongsToActiveWorkflow('job-b')).toBe(false)
  })

  it('accepts the visible tab own frame', () => {
    queueJobFrom('job-a', workflowA)

    expect(store.belongsToActiveWorkflow('job-a')).toBe(true)
  })

  it('does not separate two tabs by their shared graph id', () => {
    // Both fixtures carry 'shared-graph-id', which is what a copy-paste into a
    // new tab produces. The gate must still tell them apart.
    queueJobFrom('job-a', workflowA)
    queueJobFrom('job-b', workflowB)

    expect(store.belongsToActiveWorkflow('job-a')).toBe(true)
    expect(store.belongsToActiveWorkflow('job-b')).toBe(false)
  })

  describe('a job whose owning tab is unknown', () => {
    it('is accepted while nothing else is running', () => {
      expect(store.belongsToActiveWorkflow('job-from-a-previous-page')).toBe(
        true
      )
    })

    it('is rejected while another job is active', () => {
      queueJobFrom('job-a', workflowA)
      fire('execution_start', { prompt_id: 'job-a', timestamp: 1 })
      expect(store.activeJobId).toBe('job-a')

      expect(store.belongsToActiveWorkflow('job-from-a-previous-page')).toBe(
        false
      )
    })
  })

  it('accepts a frame that names no job at all', () => {
    // `status` frames carry no prompt_id, so there is nothing to attribute.
    expect(store.belongsToActiveWorkflow(undefined)).toBe(true)
  })

  describe('the session path, when no tab instance is known', () => {
    it('places a job by the path it was queued from', () => {
      store.ensureSessionWorkflowPath('job-b', workflowB.path)

      expect(store.belongsToActiveWorkflow('job-b')).toBe(false)
      useWorkflowStore().activeWorkflow = workflowB
      expect(store.belongsToActiveWorkflow('job-b')).toBe(true)
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
        store.belongsToActiveWorkflow('job-a'),
        'the instance still says A, so B does not own it'
      ).toBe(false)
    })
  })

  describe("the frame's own workflow id, when no per-tab mapping exists", () => {
    it('places a job queued before this page load', () => {
      // No instance and no path: the only thing left is what the server
      // stamped on the frame, which is why ComfyUI#16763 exists.
      expect(
        store.belongsToActiveWorkflow('job-from-a-previous-page', 'other-graph')
      ).toBe(false)
      expect(
        store.belongsToActiveWorkflow(
          'job-from-a-previous-page',
          'shared-graph-id'
        )
      ).toBe(true)
    })

    it('ignores the all-zero sentinel rather than comparing it', () => {
      // LGraph._id's default. Compared as a real id it matches nothing, so the
      // tab's own frames were rejected.
      expect(
        store.belongsToActiveWorkflow('job-on-a-fresh-graph', zeroUuid)
      ).toBe(true)
    })

    it('reaches the gate from a real progress_state frame', async () => {
      // The store API is not the only caller: the handlers must forward the
      // stamped id, or the leg is only reachable from tests.
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
        store.belongsToActiveWorkflow('job-b', 'shared-graph-id'),
        'the path says B owns it, even though the graph id matches A'
      ).toBe(false)
    })
  })
})
