import { fromPartial } from '@total-typescript/shoehorn'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import type {
  ExecutedWsMessage,
  ExecutingWsMessage,
  ExecutionCachedWsMessage,
  ExecutionErrorWsMessage,
  ExecutionInterruptedWsMessage,
  ExecutionStartWsMessage,
  ExecutionSuccessWsMessage,
  NodeProgressState,
  NotificationWsMessage,
  ProgressStateWsMessage,
  ProgressWsMessage
} from '@/platform/remote/comfyui/execution/types'
import type { LoadedComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import { useExecutionStore } from '@/stores/executionStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { zeroUuid } from '@/utils/uuid'

vi.mock(import('@/composables/useAppMode'))
vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

type EventHandler = (event: CustomEvent) => void
interface EventPayloads {
  executed: ExecutedWsMessage
  execution_cached: ExecutionCachedWsMessage
  execution_error: ExecutionErrorWsMessage
  execution_interrupted: ExecutionInterruptedWsMessage
  execution_start: ExecutionStartWsMessage
  execution_success: ExecutionSuccessWsMessage
  notification: NotificationWsMessage
  progress: ProgressWsMessage
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
    path,
    instanceId: `instance-${path}`
  })
}

const workflowA = workflow(WORKFLOW_A_ID, 'workflows/a.json')
const workflowB = workflow(WORKFLOW_B_ID, 'workflows/b.json')

const workflowACopy = workflow(WORKFLOW_A_ID, 'workflows/a copy.json')

/**
 * `executing` is dispatched with a bare node id for extension compatibility,
 * so the store reads the ids off the raw message api recorded. Mirror that.
 */
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
  // assertion sees the applied state rather than the pending batch, and so
  // this does not have to track which handlers are coalesced.
  vi.advanceTimersToNextFrame()
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

describe('executionStore workflow gating', () => {
  let store: ReturnType<typeof useExecutionStore>
  beforeEach(() => {
    apiEventHandlers.clear()
    api.lastExecutingMessage = null
    vi.mocked(
      useNodeOutputStore().revokePreviewsByExecutionId
    ).mockImplementation(() => {})
    useWorkflowStore().activeWorkflow = null
    openTabs(workflowA, workflowB)
    store = useExecutionStore()
    store.bindExecutionEvents()
  })

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

    // Two handlers crossed with own-versus-foreign. `executed` and
    // `execution_cached` are separate code paths, so all four rows stay.
    it.for([
      { event: 'executed', own: true },
      { event: 'executed', own: false },
      { event: 'execution_cached', own: true },
      { event: 'execution_cached', own: false }
    ])('$event marks the active job nodes: $own', ({ event, own }) => {
      const ids = own
        ? { prompt_id: 'job-a', workflow_id: WORKFLOW_A_ID }
        : { prompt_id: 'job-b', workflow_id: WORKFLOW_B_ID }
      if (event === 'executed') {
        fire('executed', { ...ids, node: '1', display_node: '1', output: {} })
      } else {
        fire('execution_cached', { ...ids, nodes: ['1'], timestamp: 2 })
      }

      expect(store.activeJob?.nodes['1']).toBe(own ? true : undefined)
    })

    it('does not apply an unresolvable frame to another active job', () => {
      fire('executed', {
        prompt_id: 'job-x',
        node: '1',
        display_node: '1',
        output: {}
      })

      expect(store.activeJob?.nodes['1']).toBeUndefined()
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

    it('unresolvable execution_error does not reset another active job', () => {
      fire('execution_error', {
        prompt_id: 'job-x',
        timestamp: 2,
        node_id: '1',
        node_type: 'TestNode',
        exception_message: 'fail',
        exception_type: 'Error',
        traceback: [],
        executed: [],
        current_inputs: {},
        current_outputs: {}
      })

      expect(store.activeJobId).toBe('job-a')
    })

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

    it('records a background completion only on its owning workflow', () => {
      queueJobFrom('job-b', workflowB)

      fire('execution_start', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        timestamp: 1
      })
      fire('execution_success', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        timestamp: 2
      })

      expect(store.getWorkflowStatus(workflowA)).toBeUndefined()
      expect(store.getWorkflowStatus(workflowB)).toBe('completed')
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

    it('handles a gateway-synthesised cancel with no node fields', () => {
      queueJobFrom('job-b', workflowB)
      fire('progress_state', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        nodes: { '1': nodeState('job-b', '1', 'running', 4) }
      })

      fire('execution_interrupted', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        timestamp: 2,
        synthetic: true,
        reason: 'Job cancelled by user'
      })

      expect(store.activeJobId, 'the visible run is untouched').toBe('job-a')
      expect(
        store.nodeProgressStatesByJob['job-b'],
        "the cancelled job's own records are still released"
      ).toBeUndefined()
    })

    it('execution_error from another workflow leaves active state alone but clears its initializing flag', () => {
      queueJobFrom('job-b', workflowB)
      fire('notification', { id: 'job-b', value: 'Waiting for a machine' })
      expect(store.isJobInitializing('job-b')).toBe(true)

      fire('execution_error', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        timestamp: 2,
        node_id: '1',
        node_type: 'TestNode',
        exception_message: 'fail',
        exception_type: 'Error',
        traceback: [],
        executed: []
      })

      expect(store.activeJobId).toBe('job-a')
      expect(store.isJobInitializing('job-b')).toBe(false)
    })

    it('does not reset the active workflow when a stamped background error arrives before storeJob', () => {
      fire('execution_error', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        timestamp: 2,
        node_id: '1',
        node_type: 'TestNode',
        exception_message: 'fail',
        exception_type: 'Error',
        traceback: [],
        executed: []
      })

      expect(store.activeJobId).toBe('job-a')
    })

    it('does not reset the active workflow for a background account precondition', () => {
      queueJobFrom('job-b', workflowB)

      fire('execution_error', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        timestamp: 2,
        node_id: '1',
        node_type: 'PartnerApiNode',
        exception_message:
          'Payment Required: Please add credits to your account to use this node.',
        exception_type: 'InsufficientFundsError',
        traceback: [],
        executed: []
      })

      expect(store.activeJobId).toBe('job-a')
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

    it('retains the latest progress snapshot for each job in one frame', () => {
      const handler = apiEventHandlers.get('progress_state')
      assert(handler)
      handler(
        new CustomEvent('progress_state', {
          detail: {
            prompt_id: 'job-a',
            workflow_id: WORKFLOW_A_ID,
            nodes: { '1': nodeState('job-a', '1', 'running', 3) }
          }
        })
      )
      handler(
        new CustomEvent('progress_state', {
          detail: {
            prompt_id: 'job-b',
            workflow_id: WORKFLOW_B_ID,
            nodes: { '1': nodeState('job-b', '1', 'running', 7) }
          }
        })
      )

      vi.advanceTimersToNextFrame()

      expect(store.nodeProgressStatesByJob['job-a']?.['1']?.value).toBe(3)
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

    it('updates the executing node progress on a workflow_id match', () => {
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

      expect(store.executingNodeProgress).toBe(0.4)
    })

    it('skips the executing node progress on a workflow_id mismatch', () => {
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

      expect(store.executingNodeProgress).toBeNull()
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

      expect(
        useNodeOutputStore().revokePreviewsByExecutionId
      ).toHaveBeenCalled()
    })

    it('does not revoke previews for a frame from another workflow', () => {
      fire('progress_state', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        nodes: { '1': nodeState('job-b', '1', 'running') }
      })

      expect(
        useNodeOutputStore().revokePreviewsByExecutionId
      ).not.toHaveBeenCalled()
    })

    it('revokes when a node transitions pending -> running', () => {
      fire('progress_state', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        nodes: { '1': nodeState('job-a', '1', 'pending') }
      })
      expect(
        useNodeOutputStore().revokePreviewsByExecutionId
      ).not.toHaveBeenCalled()

      fire('progress_state', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        nodes: { '1': nodeState('job-a', '1', 'running') }
      })

      expect(
        useNodeOutputStore().revokePreviewsByExecutionId
      ).toHaveBeenCalled()
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

      expect(
        useNodeOutputStore().revokePreviewsByExecutionId
      ).toHaveBeenCalledTimes(1)
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

  describe('metadata hygiene', () => {
    it('ignores an empty-string workflow_id rather than matching on it', () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-b', workflowB)

      fire('progress_state', {
        prompt_id: 'job-b',
        workflow_id: '',
        nodes: { '1': nodeState('job-b', '1', 'running', 5) }
      })

      expect(store.nodeProgressStates['1']).toBeUndefined()
    })

    it('gates on workflow_id even when the job mapping disagrees', () => {
      useWorkflowStore().activeWorkflow = workflowA
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
      expect(store.executingNodeProgress).toBe(0.5)

      fireExecuting('9', { prompt_id: 'job-b', workflow_id: WORKFLOW_B_ID })

      expect(store.executingNodeProgress).toBe(0.5)
    })

    it('still works when the raw message was never recorded', () => {
      const handler = apiEventHandlers.get('executing')
      assert.exists(handler)
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

      expect(store.executingNodeProgress).toBe(0.4)
    })

    it('drops a progress frame from another workflow', () => {
      fire('progress', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        node: '1',
        value: 7,
        max: 10
      })

      expect(store.executingNodeProgress).toBeNull()
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
      expect(store.executingNodeProgress).toBeNull()
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
    it('stays clean across repeated switches during one run', async () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-a', workflowA)

      async function cycle(step: number) {
        fire('progress_state', {
          prompt_id: 'job-a',
          workflow_id: WORKFLOW_A_ID,
          nodes: { '1': nodeState('job-a', '1', 'running', step) }
        })
        useWorkflowStore().activeWorkflow = workflowB
        await nextTick()
        const inB = store.nodeProgressStates['1']
        useWorkflowStore().activeWorkflow = workflowA
        await nextTick()
        return { inB, inA: store.nodeProgressStates['1']?.value }
      }

      const first = await cycle(3)
      expect(first.inB, 'first arrival in B').toBeUndefined()
      expect(first.inA).toBe(3)

      const second = await cycle(5)
      expect(second.inB, 'second arrival in B').toBeUndefined()
      expect(second.inA).toBe(5)
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

      fire('progress_state', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        nodes: { '1': nodeState('job-a', '1', 'running', 6) }
      })

      expect(store.nodeProgressStates['1']).toBeUndefined()
    })
    it('does not project a foreign entry that is still in the mirror', () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-a', workflowA)
      fire('progress_state', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        nodes: { '1': nodeState('job-a', '1', 'running', 3) }
      })
      expect(Object.keys(store.nodeLocationProgressStates)).toHaveLength(1)

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
      openTabs(workflowA, workflowACopy)
    })

    it('rejects a foreign job output frame for the copy', () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-a', workflowA)
      queueJobFrom('job-copy', workflowACopy)

      useWorkflowStore().activeWorkflow = workflowACopy

      expect(store.belongsToActiveWorkflow('job-a', WORKFLOW_A_ID)).toBe(false)
      expect(store.belongsToActiveWorkflow('job-copy', WORKFLOW_A_ID)).toBe(
        true
      )
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

  describe('ownership resolution precedence', () => {
    beforeEach(() => {
      openTabs(workflowA, workflowACopy)
    })

    it('prefers the tab instance over both weaker legs', () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-a', workflowA)
      store.ensureSessionWorkflowPath(
        'job-a',
        workflowACopy.path,
        workflowA.instanceId
      )

      useWorkflowStore().activeWorkflow = workflowACopy
      expect(
        store.belongsToActiveWorkflow('job-a', WORKFLOW_A_ID),
        'the instance still says A, so the copy does not own it'
      ).toBe(false)
      useWorkflowStore().activeWorkflow = workflowA
      expect(store.belongsToActiveWorkflow('job-a', WORKFLOW_A_ID)).toBe(true)
    })

    it('falls back to the session path when no instance is known', () => {
      useWorkflowStore().activeWorkflow = workflowA
      store.ensureSessionWorkflowPath('job-pathonly', workflowACopy.path)

      expect(
        store.belongsToActiveWorkflow('job-pathonly', WORKFLOW_A_ID),
        'the path says the copy owns it, even though the graph id matches A'
      ).toBe(false)
      useWorkflowStore().activeWorkflow = workflowACopy
      expect(store.belongsToActiveWorkflow('job-pathonly', WORKFLOW_A_ID)).toBe(
        true
      )
    })

    it('falls back to the graph id when neither instance nor path is known', () => {
      useWorkflowStore().activeWorkflow = workflowA
      store.registerJobWorkflowIdMapping('job-elsewhere', WORKFLOW_B_ID)

      expect(
        store.belongsToActiveWorkflow('job-elsewhere', WORKFLOW_B_ID)
      ).toBe(false)
      expect(
        store.belongsToActiveWorkflow('job-elsewhere', WORKFLOW_A_ID)
      ).toBe(true)
    })

    it('stays permissive when ownership cannot be resolved at all', () => {
      useWorkflowStore().activeWorkflow = workflowA

      expect(store.belongsToActiveWorkflow('job-unknown', undefined)).toBe(true)
    })

    it('does not give a running job to the copy that Save As creates', () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-a', workflowA)

      const savedAs = workflow(
        'a-brand-new-graph-id',
        'workflows/saved as.json'
      )
      openTabs(workflowA, savedAs)
      useWorkflowStore().activeWorkflow = savedAs

      expect(store.belongsToActiveWorkflow('job-a', WORKFLOW_A_ID)).toBe(false)
      useWorkflowStore().activeWorkflow = workflowA
      expect(store.belongsToActiveWorkflow('job-a', WORKFLOW_A_ID)).toBe(true)
    })

    // Core falls back to the id inside extra_pnginfo.workflow, so a graph still
    // on LGraph's default id has the sentinel stamped onto its frames. Compared
    // as a real id it matches nothing, so the tab's own frames were rejected.
    it('does not reject a frame whose only id is the all-zero sentinel', () => {
      useWorkflowStore().activeWorkflow = workflowA

      expect(
        store.belongsToActiveWorkflow('job-fresh-graph', zeroUuid),
        'the sentinel is not an id, so it cannot be grounds for rejection'
      ).toBe(true)
    })
  })

  describe('returning to a tab whose job started in the background', () => {
    it('adopts the job so the tab is not both running and idle', async () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-a', workflowA)

      useWorkflowStore().activeWorkflow = workflowB
      await nextTick()

      fire('execution_start', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        timestamp: 1
      })
      fire('progress_state', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        nodes: { '1': nodeState('job-a', '1', 'running', 3) }
      })
      useWorkflowStore().activeWorkflow = workflowA
      await nextTick()

      expect(store.nodeProgressStates['1']?.state).toBe('running')
      expect(store.activeJobId).toBe('job-a')
      expect(store.isIdle).toBe(false)
    })

    it('does not adopt a job belonging to a different tab', async () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-b', workflowB)
      fire('execution_start', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        timestamp: 1
      })
      fire('progress_state', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        nodes: { '1': nodeState('job-b', '1', 'running', 3) }
      })

      useWorkflowStore().activeWorkflow = workflowA
      await nextTick()

      expect(store.activeJobId).toBeNull()
      expect(store.isIdle).toBe(true)
    })
  })

  describe('per-job state that a neighbouring job must not disturb', () => {
    it('keeps a background pending snapshot when the visible job ends', () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-a', workflowA)
      queueJobFrom('job-b', workflowB)
      fire('execution_start', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        timestamp: 1
      })

      // B's frame and A's terminal `executing` land in the same tick.
      const handler = apiEventHandlers.get('progress_state')
      assert.exists(handler)
      handler(
        new CustomEvent('progress_state', {
          detail: {
            prompt_id: 'job-b',
            workflow_id: WORKFLOW_B_ID,
            nodes: { '1': nodeState('job-b', '1', 'running', 6) }
          }
        })
      )
      fireExecuting(null, { prompt_id: 'job-a', workflow_id: WORKFLOW_A_ID })
      vi.advanceTimersToNextFrame()

      expect(
        store.nodeProgressStatesByJob['job-b'],
        "A ending must not drop B's pending snapshot"
      ).toBeDefined()
    })

    it('clears only the interrupted job initializing flag', () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-a', workflowA)
      queueJobFrom('job-b', workflowB)
      fire('notification', { id: 'job-a', value: 'Waiting for a machine' })
      fire('notification', { id: 'job-b', value: 'Waiting for a machine' })
      expect(store.isJobInitializing('job-b')).toBe(true)
      // Set directly rather than via execution_start, which would clear A's own
      // initializing flag and make the assertion below vacuous.
      store.activeJobId = 'job-a'

      fire('execution_interrupted', {
        prompt_id: 'job-b',
        workflow_id: WORKFLOW_B_ID,
        timestamp: 2
      })

      expect(
        store.isJobInitializing('job-a'),
        'the visible run is still waiting for a machine'
      ).toBe(true)
      expect(store.isJobInitializing('job-b')).toBe(false)
    })
  })

  describe('the all-zero sentinel, one row per normalization', () => {
    it('leaves a sentinel-only frame unresolvable, so activeJobId rejects it', () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-a', workflowA)
      fire('execution_start', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        timestamp: 1
      })

      expect(store.belongsToActiveWorkflow('job-x', zeroUuid)).toBe(false)
    })

    it('adopts an unmapped job stamped with the sentinel', () => {
      useWorkflowStore().activeWorkflow = workflowA

      fire('execution_start', {
        prompt_id: 'job-fresh',
        workflow_id: zeroUuid,
        timestamp: 1
      })

      expect(store.activeJobId).toBe('job-fresh')
    })
  })

  describe('a background job that finishes', () => {
    it('does not leave activeJobId naming a finished background job', () => {
      useWorkflowStore().activeWorkflow = workflowA
      queueJobFrom('job-a', workflowA)
      fire('execution_start', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        timestamp: 1
      })
      useWorkflowStore().activeWorkflow = workflowB
      fire('execution_success', {
        prompt_id: 'job-a',
        workflow_id: WORKFLOW_A_ID,
        timestamp: 2
      })

      expect(store.activeJobId).toBeNull()
      expect(store.isIdle).toBe(true)
    })
  })
})
