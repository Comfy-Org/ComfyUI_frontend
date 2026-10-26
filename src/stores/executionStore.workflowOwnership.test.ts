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

describe('executionStore workflow ownership', () => {
  let store: ReturnType<typeof useExecutionStore>

  beforeEach(() => {
    const workflowStore = useWorkflowStore()
    Object.assign(workflowStore, { openWorkflows: [workflowA, workflowB] })
    workflowStore.activeWorkflow = workflowA
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
})
