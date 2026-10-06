import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type { NodeProgressState } from '@/platform/remote/comfyui/execution/types'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'

/**
 * Workflow-ownership gating for execution WebSocket messages.
 *
 * Core stamps `workflow_id` on every JSON frame of a running prompt, so a frame
 * that belongs to another open workflow tab must not write the shared "current
 * execution" state. Three resolution paths have to keep working, because a
 * frontend talks to backends of three different vintages:
 *
 *  - **modern**: the frame carries `workflow_id`
 *  - **legacy**: no `workflow_id` anywhere — ownership resolves from the
 *    mapping registered when the job was queued, or from the session path
 *  - **unresolvable**: neither is available, and behaviour must stay exactly as
 *    it was before gating existed (permissive)
 */

const { mockShowTextPreview } = await vi.hoisted(async () => ({
  mockShowTextPreview: vi.fn()
}))

vi.mock(import('@/composables/useAppMode'))
vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

vi.mock<unknown>(import('@/composables/node/useNodeProgressText'), () => ({
  useNodeProgressText: () => ({
    showTextPreview: mockShowTextPreview,
    removeTextPreview: vi.fn()
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
    path,
    // Every open tab carries its own instanceId in the running app, and it is
    // the only identifier that is unique per tab rather than per workflow.
    instanceId: `instance-${path}`
  })
}

const workflowA = workflow(WORKFLOW_A_ID, 'workflows/a.json')
const workflowB = workflow(WORKFLOW_B_ID, 'workflows/b.json')

/**
 * Copy a workflow, open a new tab and paste it: `ensureWorkflowId` keeps the
 * id already in the pasted json, so both tabs carry the same workflow id while
 * being different open workflows. Reported by QA on the core PR thread, with
 * three unsaved copies of the default graph.
 */
const workflowACopy = workflow(WORKFLOW_A_ID, 'workflows/a copy.json')

const RAF_COALESCED = new Set(['progress_state', 'progress'])

/**
 * `executing` is dispatched with a bare node id for extension compatibility,
 * so the store reads the ids off the raw message api recorded. Mirror that.
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
  // progress frames are RAF-coalesced in the store; flush so the assertion
  // sees the applied state rather than the pending batch.
  if (RAF_COALESCED.has(event)) vi.advanceTimersToNextFrame()
}

function nodeState(
  jobId: string,
  nodeId: string,
  state: NodeProgressState['state'],
  value = 0
): NodeProgressState {
  return {
    node_id: nodeId,
    display_node_id: nodeId,
    real_node_id: nodeId,
    prompt_id: jobId,
    state,
    value,
    max: 10
  }
}

describe('executionStore workflow gating', () => {
  let store: ReturnType<typeof useExecutionStore>
  let revokePreviews: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    apiEventHandlers.clear()
    api.lastExecutingMessage = null
    mockShowTextPreview.mockClear()
    revokePreviews = vi
      .spyOn(useNodeOutputStore(), 'revokePreviewsByExecutionId')
      .mockImplementation(() => {})
    useWorkflowStore().activeWorkflow = null
    Object.assign(useWorkflowStore(), { openWorkflows: [workflowA, workflowB] })
    vi.mocked(useWorkflowStore().isOpen).mockImplementation((wf) =>
      useWorkflowStore().openWorkflows.some((open) => open.path === wf.path)
    )
    store = useExecutionStore()
    store.bindExecutionEvents()
  })

  /** Queue a job from `wf` so the id mapping exists, as storeJob does. */
  function queueLegacyJobFrom(jobId: string, wf: LoadedComfyWorkflow) {
    store.storeJob({
      nodes: ['1'],
      id: jobId,
      promptOutput: { '1': { inputs: {}, class_type: 'TestNode' } },
      startTime: 42,
      submissionAcceptedAt: 62,
      workflow: wf,
      mode: 'graph'
    })
  }

  function queueJobFrom(jobId: string, wf: LoadedComfyWorkflow) {
    const graphId = wf.activeState.id ?? wf.initialState.id
    if (!graphId) throw new Error('workflow graph id missing')
    store.registerJobWorkflowIdMapping(jobId, graphId)
    store.storeJob({
      nodes: ['1'],
      id: jobId,
      promptOutput: { '1': { inputs: {}, class_type: 'TestNode' } },
      startTime: 42,
      submissionAcceptedAt: 62,
      workflow: wf,
      mode: 'graph'
    })
  }

  describe('execution_start', () => {
    it('adopts activeJobId for a frame from the active workflow', () => {
      useWorkflowStore().activeWorkflow = workflowA

      fire('execution_start', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        timestamp: 1
      })

      expect(store.activeJobId).toBe('job-a')
    })

    it('does not steal activeJobId for a frame from another workflow', () => {
      useWorkflowStore().activeWorkflow = workflowA
      fire('execution_start', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        timestamp: 1
      })

      fire('execution_start', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        timestamp: 2
      })

      expect(store.activeJobId).toBe('job-a')
    })

    it('still records the other workflow as running', () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-b', workflowB)

      fire('execution_start', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        timestamp: 1
      })

      expect(store.getWorkflowStatus(workflowB)).toBe('running')
      expect(store.activeJobId).toBeNull()
    })

    it('adopts the job when there is no active workflow at all', () => {
      fire('execution_start', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        timestamp: 1
      })

      expect(store.activeJobId).toBe('job-a')
    })
  })

  describe('node completion frames', () => {
    beforeEach(() => {
      useWorkflowStore().activeWorkflow = workflowA
      fire('execution_start', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        timestamp: 1
      })
    })

    it('marks nodes for a frame from the active workflow', () => {
      fire('executed', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        node: '1',
        display_node: '1',
        output: {}
      })

      expect(store.activeJob?.nodes['1']).toBe(true)
    })

    it('executed from another workflow does not mark active job nodes', () => {
      fire('executed', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        node: '1',
        display_node: '1',
        output: {}
      })

      expect(store.activeJob?.nodes['1']).toBeUndefined()
    })

    it('execution_cached from another workflow does not mark active job nodes', () => {
      fire('execution_cached', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        nodes: ['1'],
        timestamp: 2
      })

      expect(store.activeJob?.nodes['1']).toBeUndefined()
    })

    it('execution_cached from the active workflow does mark them', () => {
      fire('execution_cached', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        nodes: ['1'],
        timestamp: 2
      })

      expect(store.activeJob?.nodes['1']).toBe(true)
    })
  })

  describe('terminal frames', () => {
    beforeEach(() => {
      useWorkflowStore().activeWorkflow = workflowA
      fire('execution_start', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        timestamp: 1
      })
    })

    it('execution_success from another workflow does not clear activeJobId', () => {
      fire('execution_success', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        timestamp: 2
      })

      expect(store.activeJobId).toBe('job-a')
    })

    // Regression: gating the whole handler hid the completed badge on a
    // background tab, which workflowTabStatus.spec.ts caught on CI. Per-workflow
    // status is keyed by the job's own workflow and is never shared state.
    it('still marks another workflow completed on its own tab', () => {
      queueJobFrom('job-b', workflowB)
      fire('execution_start', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        timestamp: 1
      })
      expect(store.getWorkflowStatus(workflowB)).toBe('running')

      fire('execution_success', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        timestamp: 2
      })

      expect(store.getWorkflowStatus(workflowB)).toBe('completed')
      expect(store.activeJobId).toBe('job-a')
    })

    it('execution_success from the active workflow clears it', () => {
      fire('execution_success', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        timestamp: 2
      })

      expect(store.activeJobId).toBeNull()
    })

    it('clears the initializing flag for the completed job either way', () => {
      queueJobFrom('job-b', workflowB)
      fire('notification', { id: 'job-b', value: 'Waiting for a machine' })
      expect(store.isJobInitializing('job-b')).toBe(true)

      fire('execution_success', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        timestamp: 2
      })

      expect(store.isJobInitializing('job-b')).toBe(false)
    })

    it('execution_interrupted from another workflow does not clear activeJobId', () => {
      fire('execution_interrupted', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        timestamp: 2,
        node_id: '1',
        node_type: 'TestNode',
        executed: []
      })

      expect(store.activeJobId).toBe('job-a')
    })

    it('execution_error from another workflow leaves active state alone but clears its initializing flag', () => {
      queueJobFrom('job-b', workflowB)

      fire('execution_error', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        timestamp: 2,
        node_id: '1',
        node_type: 'TestNode',
        exception_message: 'fail',
        exception_type: 'Error',
        traceback: []
      })

      expect(store.activeJobId).toBe('job-a')
      expect(store.isJobInitializing('job-b')).toBe(false)
    })
  })

  describe('progress_state', () => {
    beforeEach(() => {
      useWorkflowStore().activeWorkflow = workflowA
    })

    it('updates the global mirror when the frame matches the active workflow', () => {
      fire('progress_state', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        nodes: { '1': nodeState('job-a', '1', 'running', 3) }
      })

      expect(store.nodeProgressStates['1']?.value).toBe(3)
    })

    it('skips the global mirror when the frame is from another workflow', () => {
      fire('progress_state', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        nodes: { '1': nodeState('job-b', '1', 'running', 7) }
      })

      expect(store.nodeProgressStates['1']).toBeUndefined()
    })

    it('records per-job progress regardless of which workflow sent it', () => {
      fire('progress_state', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        nodes: { '1': nodeState('job-b', '1', 'running', 7) }
      })

      expect(store.nodeProgressStatesByJob['job-b']?.['1']?.value).toBe(7)
    })

    it('updates the mirror when there is no active workflow', () => {
      useWorkflowStore().activeWorkflow = null

      fire('progress_state', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        nodes: { '1': nodeState('job-b', '1', 'running', 7) }
      })

      expect(store.nodeProgressStates['1']?.value).toBe(7)
    })

    it('updates _executingNodeProgress on a workflow_id match', () => {
      fire('execution_start', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        timestamp: 1
      })
      fireExecuting('1', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID
      })

      fire('progress_state', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        nodes: { '1': nodeState('job-a', '1', 'running', 4) }
      })

      expect(store._executingNodeProgress?.value).toBe(4)
    })

    it('skips _executingNodeProgress on a workflow_id mismatch', () => {
      fire('execution_start', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        timestamp: 1
      })
      fireExecuting('1', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID
      })

      fire('progress_state', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        nodes: { '1': nodeState('job-b', '1', 'running', 9) }
      })

      expect(store._executingNodeProgress?.value).not.toBe(9)
    })
  })

  describe('preview revocation', () => {
    beforeEach(() => {
      useWorkflowStore().activeWorkflow = workflowA
    })

    it('revokes previews for a frame from the active workflow', () => {
      fire('progress_state', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        nodes: { '1': nodeState('job-a', '1', 'running') }
      })

      expect(revokePreviews).toHaveBeenCalled()
    })

    it('does not revoke previews for a frame from another workflow', () => {
      fire('progress_state', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        nodes: { '1': nodeState('job-b', '1', 'running') }
      })

      expect(revokePreviews).not.toHaveBeenCalled()
    })

    it('revokes when a node transitions pending -> running', () => {
      fire('progress_state', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        nodes: { '1': nodeState('job-a', '1', 'pending') }
      })
      expect(revokePreviews).not.toHaveBeenCalled()

      fire('progress_state', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        nodes: { '1': nodeState('job-a', '1', 'running') }
      })

      expect(revokePreviews).toHaveBeenCalled()
    })

    it('does not revoke twice while a node stays running', () => {
      const running = { '1': nodeState('job-a', '1', 'running') }
      fire('progress_state', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        nodes: running
      })
      fire('progress_state', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        nodes: running
      })

      expect(revokePreviews).toHaveBeenCalledTimes(1)
    })
  })

  describe('legacy backends that never send workflow_id', () => {
    it('falls back to the job -> workflow id mapping', () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-b', workflowB)
      fire('execution_start', { prompt_id: 'job-a', timestamp: 1 })

      fire('progress_state', {
        prompt_id: 'job-b',
        nodes: { '1': nodeState('job-b', '1', 'running', 5) }
      })

      expect(store.nodeProgressStates['1']).toBeUndefined()
      expect(store.nodeProgressStatesByJob['job-b']?.['1']?.value).toBe(5)
    })

    it('uses the mapping to accept a frame for the active workflow', () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-a', workflowA)

      fire('progress_state', {
        prompt_id: 'job-a',
        nodes: { '1': nodeState('job-a', '1', 'running', 5) }
      })

      expect(store.nodeProgressStates['1']?.value).toBe(5)
    })

    it('stays permissive when ownership cannot be resolved at all', () => {
      useWorkflowStore().activeWorkflow = workflowA

      // No workflow_id on the frame and no mapping for this job: the job could
      // have been queued by another browser session, and single-tab behaviour
      // must not regress.
      fire('progress_state', {
        prompt_id: 'job-from-elsewhere',
        nodes: { '1': nodeState('job-from-elsewhere', '1', 'running', 5) }
      })

      expect(store.nodeProgressStates['1']?.value).toBe(5)
    })

    it('does not steal activeJobId from a mapped foreign job', () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-b', workflowB)

      fire('execution_start', { prompt_id: 'job-b', timestamp: 1 })

      expect(store.activeJobId).toBeNull()
    })
  })

  describe('progress_text', () => {
    beforeEach(() => {
      useWorkflowStore().activeWorkflow = workflowA
    })

    it('drops text whose workflow_id does not match the active workflow', () => {
      queueJobFrom('job-b', workflowB)

      fire('progress_text', {
        nodeId: '1',
        text: 'hello',
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID
      })

      expect(mockShowTextPreview).not.toHaveBeenCalled()
    })

    it('drops text with no id information when a different job is active', () => {
      fire('execution_start', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        timestamp: 1
      })

      fire('progress_text', {
        nodeId: '1',
        text: 'hello',
        prompt_id: 'job-unknown'
      })

      expect(mockShowTextPreview).not.toHaveBeenCalled()
    })
  })

  describe('metadata hygiene', () => {
    it('ignores an empty-string workflow_id rather than matching on it', () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-b', workflowB)

      // Core omits the field entirely when unknown, never sends "" — but a
      // third-party server might, and an empty id must not read as "mine".
      fire('progress_state', {
        prompt_id: 'job-b',
        workflow_id: '',
        nodes: { '1': nodeState('job-b', '1', 'running', 5) }
      })

      expect(store.nodeProgressStates['1']).toBeUndefined()
    })

    it('gates on workflow_id even when the job mapping disagrees', () => {
      useWorkflowStore().activeWorkflow = workflowA
      // Mapping says workflow A, the frame says workflow B. The frame wins:
      // the server is the authority on which workflow produced the prompt.
      store.registerJobWorkflowIdMapping('job-x', WORKFLOW_A_ID)

      fire('progress_state', {
        prompt_id: 'job-x',
        workflow_id: WORKFLOW_B_ID,
        nodes: { '1': nodeState('job-x', '1', 'running', 5) }
      })

      expect(store.nodeProgressStates['1']).toBeUndefined()
    })
  })

  describe('executing frames', () => {
    beforeEach(() => {
      useWorkflowStore().activeWorkflow = workflowA
      fire('execution_start', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        timestamp: 1
      })
    })

    // The event detail is a bare node id for extension compatibility, so this
    // path can only gate via the raw message api records. Before that, the
    // other tab's final `executing: null` cleared the visible tab's run.
    it('does not let another workflow clear the visible active job', () => {
      fireExecuting(null, {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID
      })

      expect(store.activeJobId).toBe('job-a')
    })

    it('clears the active job on the visible workflow own terminal executing', () => {
      fireExecuting(null, {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID
      })

      expect(store.activeJobId).toBeNull()
    })

    it('does not clear node progress for another workflow executing frame', () => {
      fireExecuting('1', { prompt_id: 'job-a', workflow_id: WORKFLOW_A_ID })
      fire('progress_state', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        nodes: { '1': nodeState('job-a', '1', 'running', 5) }
      })
      expect(store._executingNodeProgress?.value).toBe(5)

      fireExecuting('9', { prompt_id: 'job-b', workflow_id: WORKFLOW_B_ID })

      expect(store._executingNodeProgress?.value).toBe(5)
    })

    // api clears the raw message straight after dispatch, so an `executing`
    // dispatched later by an extension is not read as belonging to whichever
    // run arrived last. Without that, a foreign frame would silently gate out
    // every extension-driven executing event that followed it.
    it('is not gated by a stale raw message from an earlier frame', () => {
      fireExecuting(null, {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID
      })
      expect(store.activeJobId).toBe('job-a')

      api.lastExecutingMessage = null
      const handler = apiEventHandlers.get('executing')!
      handler(new CustomEvent('executing', { detail: null }))

      expect(store.activeJobId).toBeNull()
    })

    it('still works when the raw message was never recorded', () => {
      // Defensive: an `executing` dispatched by an extension or a test rather
      // than by the socket has no raw message, and must behave as before.
      const handler = apiEventHandlers.get('executing')!
      handler(new CustomEvent('executing', { detail: null }))

      expect(store.activeJobId).toBeNull()
    })
  })

  describe('progress frames', () => {
    beforeEach(() => {
      useWorkflowStore().activeWorkflow = workflowA
      fire('execution_start', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        timestamp: 1
      })
    })

    it('applies a progress frame from the active workflow', () => {
      fire('progress', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        node: '1',
        value: 4,
        max: 10
      })

      expect(store._executingNodeProgress?.value).toBe(4)
    })

    it('drops a progress frame from another workflow', () => {
      fire('progress', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        node: '1',
        value: 7,
        max: 10
      })

      expect(store._executingNodeProgress).toBeNull()
    })
  })

  describe('mixed backend, upgraded mid-session', () => {
    beforeEach(() => {
      useWorkflowStore().activeWorkflow = workflowA
    })

    it('accepts its own frames before and after the field appears', () => {
      queueJobFrom('job-a', workflowA)

      fire('progress_state', {
        prompt_id: 'job-a',
        nodes: { '1': nodeState('job-a', '1', 'running', 2) }
      })
      expect(store.nodeProgressStates['1']?.value).toBe(2)

      fire('progress_state', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        nodes: { '1': nodeState('job-a', '1', 'running', 6) }
      })

      expect(store.nodeProgressStates['1']?.value).toBe(6)
    })

    it('rejects a foreign job both before and after the field appears', () => {
      queueJobFrom('job-b', workflowB)

      fire('progress_state', {
        prompt_id: 'job-b',
        nodes: { '1': nodeState('job-b', '1', 'running', 2) }
      })
      fire('progress_state', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        nodes: { '1': nodeState('job-b', '1', 'running', 6) }
      })

      expect(store.nodeProgressStates['1']).toBeUndefined()
      expect(store.nodeProgressStatesByJob['job-b']?.['1']?.value).toBe(6)
    })
  })

  describe('switching tabs mid-run', () => {
    // The QA run on a real generation found this: gating stops a background
    // workflow writing the mirror, but whatever it wrote while it was in front
    // stays there, and `nodeLocationProgressStates` resolves node ids against
    // the *currently* active graph. Two workflows sharing a node id therefore
    // show the stale entry on the newly visible node.
    it('clears the mirror when switching to a workflow with no running job', async () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-a', workflowA)
      fire('progress_state', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        nodes: { '1': nodeState('job-a', '1', 'running', 3) }
      })
      expect(store.nodeProgressStates['1']?.value).toBe(3)

      useWorkflowStore().activeWorkflow = workflowB
      await nextTick()

      expect(store.nodeProgressStates['1']).toBeUndefined()
      expect(store._executingNodeProgress).toBeNull()
    })

    it('replays the active workflow own progress when switching back', async () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-a', workflowA)
      fire('progress_state', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        nodes: { '1': nodeState('job-a', '1', 'running', 3) }
      })

      useWorkflowStore().activeWorkflow = workflowB
      await nextTick()
      expect(store.nodeProgressStates['1']).toBeUndefined()

      // A's run advanced while it was in the background; per-job state kept it.
      fire('progress_state', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        nodes: { '1': nodeState('job-a', '1', 'running', 8) }
      })

      useWorkflowStore().activeWorkflow = workflowA
      await nextTick()

      expect(store.nodeProgressStates['1']?.value).toBe(8)
    })

    it('keeps recording per-job progress for the backgrounded workflow', async () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-a', workflowA)
      useWorkflowStore().activeWorkflow = workflowB
      await nextTick()

      fire('progress_state', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        nodes: { '1': nodeState('job-a', '1', 'running', 8) }
      })

      expect(store.nodeProgressStates['1']).toBeUndefined()
      expect(store.nodeProgressStatesByJob['job-a']?.['1']?.value).toBe(8)
    })

    it('shows the newly active workflow own job rather than the one it replaced', async () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-a', workflowA)
      queueJobFrom('job-b', workflowB)
      fire('progress_state', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        nodes: { '1': nodeState('job-a', '1', 'running', 2) }
      })
      fire('progress_state', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        nodes: { '1': nodeState('job-b', '1', 'running', 7) }
      })
      expect(store.nodeProgressStates['1']?.value).toBe(2)

      useWorkflowStore().activeWorkflow = workflowB
      await nextTick()

      expect(store.nodeProgressStates['1']?.value).toBe(7)
      expect(store.nodeProgressStates['1']?.prompt_id).toBe('job-b')
    })
    // A legacy server sends no workflow_id at all, so ownership resolves
    // through the session path the client recorded at queue time. The QA pass
    // against core f1072eb0 saw foreign progress here; it must clear on switch
    // on that backend too, not only on one that stamps the frames.
    it('clears the mirror on a backend that sends no workflow id', async () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueLegacyJobFrom('job-a', workflowA)
      fire('progress_state', {
        prompt_id: 'job-a',
        nodes: { '1': nodeState('job-a', '1', 'running', 3) }
      })
      expect(store.nodeProgressStates['1']?.value).toBe(3)

      useWorkflowStore().activeWorkflow = workflowB
      await nextTick()

      expect(store.nodeProgressStates['1']).toBeUndefined()
    })
    // Round 2 of the GPU QA: the first switch is clean, a later one is not.
    it('stays clean across repeated switches during one run', async () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-a', workflowA)

      for (const [i, step] of [3, 5, 7, 9].entries()) {
        fire('progress_state', {
          prompt_id: 'job-a',
          workflow_id: WORKFLOW_A_ID,
          nodes: { '1': nodeState('job-a', '1', 'running', step) }
        })
        useWorkflowStore().activeWorkflow = workflowB
        await nextTick()
        expect(
          store.nodeProgressStates['1'],
          `switch ${i + 1} to B must not inherit A`
        ).toBeUndefined()

        useWorkflowStore().activeWorkflow = workflowA
        await nextTick()
        expect(store.nodeProgressStates['1']?.value).toBe(step)
      }
    })

    it('stays clean while the active workflow is queued behind the running one', async () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-a', workflowA)
      fire('progress_state', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        nodes: { '1': nodeState('job-a', '1', 'running', 3) }
      })

      useWorkflowStore().activeWorkflow = workflowB
      queueJobFrom('job-b', workflowB)
      await nextTick()
      expect(store.nodeProgressStates['1']).toBeUndefined()

      // A keeps running; B's own job has not started yet.
      fire('progress_state', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        nodes: { '1': nodeState('job-a', '1', 'running', 6) }
      })

      expect(store.nodeProgressStates['1']).toBeUndefined()
    })
    // The canvas stamps progress onto the new graph's nodes when the graph
    // changes (nodeProgressCanvasSync.replaceGraph), reading whatever the
    // mirror holds at that instant. Clearing the mirror on a watcher is a race
    // against that, and it is the race the GPU QA lost. So the projection has
    // to be correct even when the mirror still holds the foreign entry.
    it('does not project a foreign entry that is still in the mirror', () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-a', workflowA)
      fire('progress_state', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        nodes: { '1': nodeState('job-a', '1', 'running', 3) }
      })
      expect(Object.keys(store.nodeLocationProgressStates)).toHaveLength(1)

      // Switch without letting the watcher run, which is what the canvas sees
      // when it observes the graph change first.
      useWorkflowStore().activeWorkflow = workflowB

      expect(store.nodeProgressStates['1']?.value).toBe(3)
      expect(store.nodeLocationProgressStates).toEqual({})
    })

    it('projects the active workflow own entry', () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-a', workflowA)
      fire('progress_state', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        nodes: { '1': nodeState('job-a', '1', 'running', 3) }
      })

      const projected = Object.values(store.nodeLocationProgressStates)
      expect(projected).toHaveLength(1)
      expect(projected[0]?.value).toBe(3)
    })
  })

  describe('two open workflows that share an id', () => {
    beforeEach(() => {
      Object.assign(useWorkflowStore(), {
        openWorkflows: [workflowA, workflowACopy]
      })
    })

    // Node outputs are written by ComfyApp's own `executed` listener, not by
    // this store, and it resolves the node against the visible graph. The gate
    // it consults is this predicate.
    it('rejects a foreign job output frame for the copy', () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-a', workflowA)
      queueJobFrom('job-copy', workflowACopy)

      useWorkflowStore().activeWorkflow = workflowACopy

      expect(store.frameBelongsToVisibleWorkflow('job-a', WORKFLOW_A_ID)).toBe(
        false
      )
      expect(
        store.frameBelongsToVisibleWorkflow('job-copy', WORKFLOW_A_ID)
      ).toBe(true)
    })

    it('does not project a foreign job progress onto the copy', () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-a', workflowA)
      queueJobFrom('job-copy', workflowACopy)

      useWorkflowStore().activeWorkflow = workflowACopy
      fire('progress_state', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        nodes: { '1': nodeState('job-a', '1', 'running', 3) }
      })

      expect(store.nodeProgressStates['1']).toBeUndefined()
      expect(store.nodeLocationProgressStates).toEqual({})
    })

    it('still renders the copy own job', () => {
      useWorkflowStore().activeWorkflow = workflowACopy
      queueJobFrom('job-copy', workflowACopy)
      fire('progress_state', {
        prompt_id: 'job-copy',
        workflow_id: WORKFLOW_A_ID,
        nodes: { '1': nodeState('job-copy', '1', 'running', 4) }
      })

      expect(store.nodeProgressStates['1']?.value).toBe(4)
    })
  })

  /**
   * The resolution order is load-bearing and was wrong once: keying on the
   * graph id first let every tab sharing an id claim every job. These pin the
   * order itself, so reordering the legs fails here rather than in QA.
   */
  describe('ownership resolution precedence', () => {
    beforeEach(() => {
      Object.assign(useWorkflowStore(), {
        openWorkflows: [workflowA, workflowACopy]
      })
    })

    it('prefers the tab instance over a matching graph id', () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-a', workflowA)

      // The copy's graph id is identical, so the id leg would say yes.
      useWorkflowStore().activeWorkflow = workflowACopy
      expect(store.frameBelongsToVisibleWorkflow('job-a', WORKFLOW_A_ID)).toBe(
        false
      )
    })

    it('falls back to the session path when no instance is known', () => {
      useWorkflowStore().activeWorkflow = workflowA
      // No storeJob, so no instance mapping: register only the path.
      store.ensureSessionWorkflowPath('job-pathonly', workflowACopy.path)

      expect(
        store.frameBelongsToVisibleWorkflow('job-pathonly', WORKFLOW_A_ID),
        'the path says the copy owns it, even though the graph id matches A'
      ).toBe(false)
      useWorkflowStore().activeWorkflow = workflowACopy
      expect(
        store.frameBelongsToVisibleWorkflow('job-pathonly', WORKFLOW_A_ID)
      ).toBe(true)
    })

    it('falls back to the graph id when neither instance nor path is known', () => {
      useWorkflowStore().activeWorkflow = workflowA
      store.registerJobWorkflowIdMapping('job-elsewhere', WORKFLOW_B_ID)

      expect(
        store.frameBelongsToVisibleWorkflow('job-elsewhere', WORKFLOW_B_ID)
      ).toBe(false)
      expect(
        store.frameBelongsToVisibleWorkflow('job-elsewhere', WORKFLOW_A_ID)
      ).toBe(true)
    })

    it('stays permissive when ownership cannot be resolved at all', () => {
      useWorkflowStore().activeWorkflow = workflowA

      // A job from another browser session: no mapping, no frame id. Keeping
      // this permissive is what preserves single-tab behaviour.
      expect(
        store.frameBelongsToVisibleWorkflow('job-unknown', undefined)
      ).toBe(true)
    })

    it('keeps a running job with its tab across a rename', () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-a', workflowA)

      // renameWorkflow mutates the same object and rewrites the mapping by
      // instanceId, so the run must survive being given a new name mid-flight.
      store.rewriteSessionWorkflowPaths(
        workflowA.instanceId,
        'workflows/renamed.json'
      )
      expect(store.jobIdToSessionWorkflowPath.get('job-a')).toBe(
        'workflows/renamed.json'
      )
      expect(store.frameBelongsToVisibleWorkflow('job-a', WORKFLOW_A_ID)).toBe(
        true
      )
    })

    it('does not give a running job to the copy that Save As creates', () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-a', workflowA)

      // Save As mints a new workflow with its own instanceId and a new graph
      // id, and switches to it. The original tab keeps the run.
      const savedAs = workflow(
        'a-brand-new-graph-id',
        'workflows/saved as.json'
      )
      Object.assign(useWorkflowStore(), {
        openWorkflows: [workflowA, savedAs]
      })
      useWorkflowStore().activeWorkflow = savedAs

      expect(store.frameBelongsToVisibleWorkflow('job-a', WORKFLOW_A_ID)).toBe(
        false
      )
      useWorkflowStore().activeWorkflow = workflowA
      expect(store.frameBelongsToVisibleWorkflow('job-a', WORKFLOW_A_ID)).toBe(
        true
      )
    })
  })
})
