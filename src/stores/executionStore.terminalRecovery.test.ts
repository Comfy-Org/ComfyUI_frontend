import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ExecutingWsMessage,
  ExecutionErrorWsMessage,
  ExecutionStartWsMessage,
  NodeProgressState,
  NotificationWsMessage,
  ProgressStateWsMessage
} from '@/platform/remote/comfyui/execution/types'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'

const { mockRemoveTextPreview } = await vi.hoisted(async () => ({
  mockRemoveTextPreview: vi.fn()
}))

vi.mock(import('@/composables/useAppMode'))
vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

vi.mock<unknown>(import('@/composables/node/useNodeProgressText'), () => ({
  useNodeProgressText: () => ({
    showTextPreview: vi.fn(),
    removeTextPreview: mockRemoveTextPreview
  })
}))

type EventHandler = (event: CustomEvent) => void
interface EventPayloads {
  execution_error: ExecutionErrorWsMessage
  execution_start: ExecutionStartWsMessage
  notification: NotificationWsMessage
  progress_state: ProgressStateWsMessage
}
const apiEventHandlers = new Map<string, EventHandler>()

vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: {
    addEventListener: vi.fn((event: string, handler: EventHandler) => {
      apiEventHandlers.set(event, handler)
    }),
    removeEventListener: vi.fn((event: string) => {
      apiEventHandlers.delete(event)
    }),
    clientId: 'test-client',
    apiURL: vi.fn((path: string) => `/api${path}`),
    lastExecutingMessage: null
  }
}))

vi.mock<unknown>(import('@/scripts/app'), () => {
  const rootGraph = { getNodeById: vi.fn(), nodes: [] }
  return {
    app: {
      rootGraph,
      rootGraphOrUndefined: rootGraph,
      revokePreviews: vi.fn(),
      nodePreviewImages: {}
    }
  }
})

const WORKFLOW_A_ID = 'workflow-a-id'
const WORKFLOW_B_ID = 'workflow-b-id'

function workflow(id: string, path: string): LoadedComfyWorkflow {
  return fromPartial<LoadedComfyWorkflow>({
    activeState: { id },
    initialState: { id },
    path
  })
}

const workflowA = workflow(WORKFLOW_A_ID, 'workflows/a.json')
const workflowB = workflow(WORKFLOW_B_ID, 'workflows/b.json')

function fireExecuting(
  node: string | null,
  ids: Pick<ExecutingWsMessage, 'prompt_id' | 'workflow_id'>
) {
  api.lastExecutingMessage = { node, ...ids }
  const handler = apiEventHandlers.get('executing')
  if (!handler) throw new Error('executing handler not bound')
  handler(new CustomEvent('executing', { detail: node }))
}

function fire<K extends keyof EventPayloads>(
  event: K,
  detail: EventPayloads[K]
) {
  const handler = apiEventHandlers.get(event)
  if (!handler) throw new Error(`${event} handler not bound`)
  handler(new CustomEvent(event, { detail }))
  // Some frames are RAF-coalesced in the store; flush unconditionally so the
  // assertion sees the applied state, and so this does not have to track which
  // handlers are coalesced.
  vi.advanceTimersToNextFrame()
}

function runningNode(jobId: string, nodeId: string): NodeProgressState {
  return {
    node_id: nodeId,
    display_node_id: nodeId,
    real_node_id: nodeId,
    prompt_id: jobId,
    state: 'running',
    value: 3,
    max: 10
  }
}

/**
 * Open these tabs through the real store, so `isOpen` and `openWorkflows` are
 * the production implementations rather than a copy of them. A copy would keep
 * passing if `isOpen` started keying by instance instead of path, which is
 * exactly the identity mix-up this suite exists to catch.
 *
 * Additive, and a no-op for a tab already open. Pinia is rebuilt per test, so
 * nothing accumulates across tests.
 */
function openTabs(...workflows: LoadedComfyWorkflow[]) {
  const workflowStore = useWorkflowStore()
  for (const workflow of workflows) {
    if (workflowStore.isOpen(workflow)) continue
    workflowStore.attachWorkflow(workflow, workflowStore.openWorkflows.length)
  }
}

describe('executionStore terminal-job recovery', () => {
  let store: ReturnType<typeof useExecutionStore>

  beforeEach(() => {
    apiEventHandlers.clear()
    useWorkflowStore().activeWorkflow = workflowA
    openTabs(workflowA, workflowB)
    store = useExecutionStore()
    store.bindExecutionEvents()
  })

  function stuckActiveJob(jobId = 'job-a') {
    store.registerJobWorkflowIdMapping(jobId, WORKFLOW_A_ID)
    fire('execution_start', {
      prompt_id: jobId,
      workflow_id: WORKFLOW_A_ID,
      timestamp: 1
    })
    fireExecuting('1', { prompt_id: jobId, workflow_id: WORKFLOW_A_ID })
    fire('progress_state', {
      prompt_id: jobId,
      workflow_id: WORKFLOW_A_ID,
      nodes: { '1': runningNode(jobId, '1') }
    })
    return jobId
  }

  it('clears progress for a job the backend reports as finished', () => {
    const jobId = stuckActiveJob()
    expect(store.nodeProgressStates['1']?.state).toBe('running')

    store.reconcileTerminalJobs(new Set(), new Set([jobId]))

    expect(store.nodeProgressStates['1']).toBeUndefined()
    expect(store.nodeProgressStatesByJob[jobId]).toBeUndefined()
    expect(store.activeJobId).toBeNull()
  })

  it('leaves a job the backend still reports as running alone', () => {
    const jobId = stuckActiveJob()

    store.reconcileTerminalJobs(new Set([jobId]), new Set([jobId]))

    expect(store.nodeProgressStates['1']?.state).toBe('running')
    expect(store.activeJobId).toBe(jobId)
  })

  it('ignores a job that is neither running nor in history yet', () => {
    const jobId = stuckActiveJob()

    store.reconcileTerminalJobs(new Set(), new Set())

    expect(store.nodeProgressStates['1']?.state).toBe('running')
    expect(store.activeJobId).toBe(jobId)
  })

  it('does not blank a live run when evicting an older job', () => {
    const stale = 'job-stale'
    store.registerJobWorkflowIdMapping(stale, WORKFLOW_A_ID)
    fire('progress_state', {
      prompt_id: stale,
      workflow_id: WORKFLOW_A_ID,
      nodes: { '1': runningNode(stale, '1') }
    })
    const live = stuckActiveJob('job-live')

    store.reconcileTerminalJobs(new Set([live]), new Set([stale]))

    expect(store.nodeProgressStatesByJob[stale]).toBeUndefined()
    expect(store.nodeProgressStates['1']?.prompt_id).toBe(live)
    expect(store.activeJobId).toBe(live)
  })

  it('clears a stuck job belonging to another workflow', () => {
    store.registerJobWorkflowIdMapping('job-b', WORKFLOW_B_ID)
    fire('progress_state', {
      prompt_id: 'job-b',
      workflow_id: WORKFLOW_B_ID,
      nodes: { '1': runningNode('job-b', '1') }
    })
    expect(store.nodeProgressStatesByJob['job-b']).toBeDefined()

    store.reconcileTerminalJobs(new Set(), new Set(['job-b']))

    expect(store.nodeProgressStatesByJob['job-b']).toBeUndefined()
  })

  it('clears an initializing job that reached history without a frame', () => {
    fire('notification', { id: 'job-init', value: 'Waiting for a machine' })
    expect(store.isJobInitializing('job-init')).toBe(true)

    store.reconcileTerminalJobs(new Set(), new Set(['job-init']))

    expect(store.isJobInitializing('job-init')).toBe(false)
  })

  it('leaves a second workflow alone on a repeat pass', () => {
    const jobId = stuckActiveJob()
    store.registerJobWorkflowIdMapping('job-b', WORKFLOW_B_ID)
    store.storeJob({
      nodes: ['1'],
      id: 'job-b',
      promptOutput: { '1': { inputs: {}, class_type: 'TestNode' } },
      workflow: workflowB,
      mode: 'graph'
    })
    fire('execution_start', {
      prompt_id: 'job-b',
      workflow_id: WORKFLOW_B_ID,
      timestamp: 1
    })

    store.reconcileTerminalJobs(new Set(), new Set([jobId]))
    store.reconcileTerminalJobs(new Set(), new Set([jobId]))

    expect(store.nodeProgressStates['1']).toBeUndefined()
    expect(
      store.getWorkflowStatus(workflowB),
      'B never went terminal, so neither pass may release it'
    ).toBe('running')
  })

  it('still recovers when the terminal frame was dropped for a legacy backend', () => {
    const jobId = 'job-legacy'
    store.registerJobWorkflowIdMapping(jobId, WORKFLOW_A_ID)
    fire('execution_start', { prompt_id: jobId, timestamp: 1 })
    fire('progress_state', {
      prompt_id: jobId,
      nodes: { '1': runningNode(jobId, '1') }
    })
    expect(store.nodeProgressStates['1']?.state).toBe('running')

    store.reconcileTerminalJobs(new Set(), new Set([jobId]))

    expect(store.nodeProgressStates['1']).toBeUndefined()
  })
  function stuckQueuedJob(jobId = 'job-queued') {
    store.registerJobWorkflowIdMapping(jobId, WORKFLOW_A_ID)
    store.storeJob({
      nodes: ['1'],
      id: jobId,
      promptOutput: { '1': { inputs: {}, class_type: 'TestNode' } },
      workflow: workflowA,
      mode: 'graph'
    })
    fire('execution_start', {
      prompt_id: jobId,
      workflow_id: WORKFLOW_A_ID,
      timestamp: 1
    })
    fire('progress_state', {
      prompt_id: jobId,
      workflow_id: WORKFLOW_A_ID,
      nodes: { '1': runningNode(jobId, '1') }
    })
    return jobId
  }

  it('releases the workflow status when a terminal frame was dropped', () => {
    const jobId = stuckQueuedJob()
    expect(store.getWorkflowStatus(workflowA)).toBe('running')

    store.reconcileTerminalJobs(new Set(), new Set([jobId]))

    expect(store.getWorkflowStatus(workflowA)).toBeUndefined()
  })

  it('fires onJobReset while the job record its consumer reads still exists', () => {
    const jobId = stuckQueuedJob()
    const seen: string[][] = []
    store.onJobReset((job) => {
      seen.push(Object.keys(job.nodes))
    })

    store.reconcileTerminalJobs(new Set(), new Set([jobId]))

    expect(
      seen,
      'fired exactly once, with the node list still populated'
    ).toEqual([['1']])
  })

  it.for([
    { name: 'node error', nodeId: '1' },
    { name: 'service-level error', nodeId: null }
  ])('releases background job records after a $name', ({ nodeId }) => {
    const jobId = `job-bg-error-${nodeId ?? 'service'}`
    store.registerJobWorkflowIdMapping(jobId, WORKFLOW_B_ID)
    store.storeJob({
      nodes: ['1'],
      id: jobId,
      promptOutput: { '1': { inputs: {}, class_type: 'TestNode' } },
      workflow: workflowB,
      mode: 'graph'
    })
    fire('execution_start', {
      prompt_id: jobId,
      workflow_id: WORKFLOW_B_ID,
      timestamp: 1
    })
    fire('progress_state', {
      prompt_id: jobId,
      workflow_id: WORKFLOW_B_ID,
      nodes: { '1': runningNode(jobId, '1') }
    })
    fire('execution_error', {
      prompt_id: jobId,
      workflow_id: WORKFLOW_B_ID,
      timestamp: 2,
      node_id: nodeId,
      node_type: 'TestNode',
      exception_type: 'RuntimeError',
      exception_message: 'boom',
      traceback: [],
      executed: [],
      current_inputs: {},
      current_outputs: {}
    })

    expect(store.nodeProgressStatesByJob[jobId]).toBeUndefined()
    expect(store.queuedJobs[jobId]).toBeUndefined()
  })

  it('unsticks a tab whose job never reported progress', () => {
    // The gap the tracked set had: execution_start sets the tab to Running, so
    // a job whose terminal frame was dropped before any progress_state arrived
    // was in no tracked collection and its badge stayed Running for the
    // session.
    const jobId = 'job-no-progress'
    store.registerJobWorkflowIdMapping(jobId, WORKFLOW_B_ID)
    store.storeJob({
      nodes: ['1'],
      id: jobId,
      promptOutput: { '1': { inputs: {}, class_type: 'TestNode' } },
      workflow: workflowB,
      mode: 'graph'
    })
    fire('execution_start', {
      prompt_id: jobId,
      workflow_id: WORKFLOW_B_ID,
      timestamp: 1
    })

    store.reconcileTerminalJobs(new Set(), new Set([jobId]))

    expect(store.getWorkflowStatus(workflowB)).toBeUndefined()
  })
})
