import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NodeProgressState } from '@/platform/remote/comfyui/execution/types'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'

/**
 * Recovery from a dropped terminal WebSocket frame.
 *
 * `execution_success` / `execution_error` / `execution_interrupted` are
 * broadcast once and never retried, so a single dropped frame leaves node
 * progress pinned forever — the user sees a node stuck mid-run with no way to
 * clear it. Queue polling is the only authority that can notice: the backend
 * reports the job in history while the frontend still holds progress for it.
 */

const { mockShowTextPreview, mockRemoveTextPreview } = await vi.hoisted(
  async () => ({
    mockShowTextPreview: vi.fn(),
    mockRemoveTextPreview: vi.fn()
  })
)

vi.mock(import('@/composables/useAppMode'))
vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

vi.mock<unknown>(import('@/composables/node/useNodeProgressText'), () => ({
  useNodeProgressText: () => ({
    showTextPreview: mockShowTextPreview,
    removeTextPreview: mockRemoveTextPreview
  })
}))

type EventHandler = (event: CustomEvent) => void
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

/**
 * `executing` is dispatched with a bare node id for extension compatibility, so
 * the store reads the ids off the raw message api recorded. Mirror that rather
 * than passing an object as the detail, which would pass for the wrong reason.
 */
function fireExecuting(
  node: string | null,
  ids: { prompt_id: string; workflow_id?: string }
) {
  api.lastExecutingMessage = { node, ...ids }
  const handler = apiEventHandlers.get('executing')
  if (!handler) throw new Error('executing handler not bound')
  handler(new CustomEvent('executing', { detail: node }))
}

function fire(event: string, detail: Record<string, unknown>) {
  const handler = apiEventHandlers.get(event)
  if (!handler) throw new Error(`${event} handler not bound`)
  handler(new CustomEvent(event, { detail }))
  if (event === 'progress_state' || event === 'progress') {
    vi.advanceTimersToNextFrame()
  }
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

describe('executionStore terminal-job recovery', () => {
  let store: ReturnType<typeof useExecutionStore>

  beforeEach(() => {
    apiEventHandlers.clear()
    useWorkflowStore().activeWorkflow = workflowA
    Object.assign(useWorkflowStore(), { openWorkflows: [workflowA, workflowB] })
    vi.mocked(useWorkflowStore().isOpen).mockImplementation((wf) =>
      useWorkflowStore().openWorkflows.some((open) => open.path === wf.path)
    )
    store = useExecutionStore()
    store.bindExecutionEvents()
  })

  /** A job of the active workflow, mid-run, whose terminal frame never came. */
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

    // Submitted but not yet visible in either list: evicting here would blank
    // a run that is about to report progress.
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
    // The other tab's job is tracked per-job even though it never wrote the
    // shared mirror, so it needs evicting too or that tab stays stuck.
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

  it('is idempotent', () => {
    const jobId = stuckActiveJob()

    store.reconcileTerminalJobs(new Set(), new Set([jobId]))
    expect(() =>
      store.reconcileTerminalJobs(new Set(), new Set([jobId]))
    ).not.toThrow()

    expect(store.nodeProgressStates['1']).toBeUndefined()
  })

  it('still recovers when the terminal frame was dropped for a legacy backend', () => {
    // No workflow_id anywhere: recovery must not depend on the new field.
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
  /** As above, but queued through storeJob, which is what associates the job
   * with its workflow. The status and text-preview paths both read that. */
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

    // handleExecutionStart set this and nothing else resets it, so without the
    // release the tab keeps claiming it is running for the rest of the session.
    expect(store.getWorkflowStatus(workflowA)).toBeUndefined()
  })

  it('removes the text preview before the job record it reads is deleted', async () => {
    mockRemoveTextPreview.mockClear()
    vi.mocked(useWorkflowStore().executionIdToCurrentId).mockReturnValue('1')
    const { useCanvasStore } =
      await import('@/renderer/core/canvas/canvasStore')
    useCanvasStore().canvas = fromPartial({
      graph: { getNodeById: () => fromPartial({}) }
    })
    const jobId = stuckQueuedJob()

    store.reconcileTerminalJobs(new Set(), new Set([jobId]))

    // clearTextPreviewsForJob reads the job's node list out of queuedJobs and
    // returns early once it is gone, so order is the whole point here.
    expect(mockRemoveTextPreview).toHaveBeenCalled()
  })

  it('releases a background job records when it ends in an error', () => {
    const jobId = 'job-bg-error'
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
    expect(store.nodeProgressStatesByJob[jobId]).toBeDefined()

    // A is in front, so this error belongs to a background tab. It is still a
    // finished job, so its own records have to go, like the success path.
    fire('execution_error', {
      prompt_id: jobId,
      workflow_id: WORKFLOW_B_ID,
      node_id: '1',
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
    // Must be a background job: a visible one is tracked through activeJobId,
    // which execution_start only sets for the workflow in front.
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
    expect(store.getWorkflowStatus(workflowB)).toBe('running')
    expect(
      store.activeJobId,
      'B is behind, so it must not be adopted'
    ).toBeNull()

    store.reconcileTerminalJobs(new Set(), new Set([jobId]))

    expect(store.getWorkflowStatus(workflowB)).toBeUndefined()
  })
})
