import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { fromPartial } from '@total-typescript/shoehorn'

import { app } from '@/scripts/app'
import { MAX_PROGRESS_JOBS, useExecutionStore } from '@/stores/executionStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import { createNodeLocatorId } from '@/types/nodeIdentification'
import { executionIdToNodeLocatorId } from '@/utils/graphTraversalUtil'
import type * as DistributionTypes from '@/platform/distribution/types'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import type * as WorkflowStoreModule from '@/platform/workflow/management/stores/workflowStore'
import type { NodeProgressState } from '@/schemas/apiSchema'
import { createTestWorkflow } from '@/stores/__tests__/workflowFixture'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'

const {
  mockNodeIdToNodeLocatorId,
  mockNodeLocatorIdToNodeExecutionId,
  mockExecutionIdToCurrentId,
  mockActiveWorkflow,
  mockOpenWorkflows,
  mockShowTextPreview,
  mockTrackExecutionError,
  mockTrackExecutionSuccess,
  mockTrackSharedWorkflowRun,
  mockRevokePreviewsByExecutionId
} = await vi.hoisted(async () => {
  const { shallowRef } = await import('vue')
  return {
    mockNodeIdToNodeLocatorId: vi.fn(),
    mockNodeLocatorIdToNodeExecutionId: vi.fn(),
    mockExecutionIdToCurrentId: vi.fn(),
    mockActiveWorkflow: shallowRef<{ path?: string } | null>(null),
    mockOpenWorkflows: shallowRef<{ path: string }[]>([]),
    mockShowTextPreview: vi.fn(),
    mockTrackExecutionError: vi.fn(),
    mockTrackExecutionSuccess: vi.fn(),
    mockTrackSharedWorkflowRun: vi.fn(),
    mockRevokePreviewsByExecutionId: vi.fn()
  }
})

const mockAppModeState = vi.hoisted(() => ({
  mode: { value: 'graph' },
  isAppMode: { value: false }
}))

vi.mock('@/composables/useAppMode', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    useAppMode: () => mockAppModeState
  }
})

beforeEach(() => {
  mockAppModeState.mode.value = 'graph'
  mockAppModeState.isAppMode.value = false
})
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'
import { createTestingPinia } from '@pinia/testing'
import { toNodeId } from '@/types/nodeId'

// Mock the workflowStore
vi.mock('@/platform/workflow/management/stores/workflowStore', async () => {
  const { ComfyWorkflow } = await vi.importActual<typeof WorkflowStoreModule>(
    '@/platform/workflow/management/stores/workflowStore'
  )
  return {
    ComfyWorkflow,
    useWorkflowStore: vi.fn(() => ({
      nodeIdToNodeLocatorId: mockNodeIdToNodeLocatorId,
      nodeLocatorIdToNodeExecutionId: mockNodeLocatorIdToNodeExecutionId,
      executionIdToCurrentId: mockExecutionIdToCurrentId,
      get activeWorkflow() {
        return mockActiveWorkflow.value
      },
      get openWorkflows() {
        return mockOpenWorkflows.value
      },
      isOpen: (workflow: { path?: string }) =>
        mockOpenWorkflows.value.some((w) => w.path === workflow.path)
    }))
  }
})

vi.mock('@/platform/distribution/types', async () => ({
  ...(await vi.importActual<typeof DistributionTypes>(
    '@/platform/distribution/types'
  )),
  isCloud: true
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({
    trackExecutionError: mockTrackExecutionError,
    trackExecutionSuccess: mockTrackExecutionSuccess,
    trackSharedWorkflowRun: mockTrackSharedWorkflowRun
  })
}))

// Remove any previous global types
declare global {
  interface Window {}
}

vi.mock('@/composables/node/useNodeProgressText', () => ({
  useNodeProgressText: () => ({
    showTextPreview: mockShowTextPreview
  })
}))

/**
 * Captures event handlers registered via api.addEventListener so tests
 * can invoke them directly (e.g. to simulate WebSocket progress events).
 */
type EventHandler = (...args: unknown[]) => void
const apiEventHandlers = new Map<string, EventHandler>()
vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: vi.fn((event: string, handler: EventHandler) => {
      apiEventHandlers.set(event, handler)
    }),
    removeEventListener: vi.fn((event: string) => {
      apiEventHandlers.delete(event)
    }),
    clientId: 'test-client',
    apiURL: vi.fn((path: string) => `/api${path}`)
  }
}))

vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: () => ({
    revokePreviewsByExecutionId: mockRevokePreviewsByExecutionId
  })
}))

vi.mock('@/stores/jobPreviewStore', () => ({
  useJobPreviewStore: () => ({
    clearPreview: vi.fn()
  })
}))

// Mock the app import with proper implementation
vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: {
      getNodeById: vi.fn(),
      nodes: [] // Add nodes array for workflowStore iteration
    },
    revokePreviews: vi.fn(),
    nodePreviewImages: {}
  }
}))

beforeEach(() => {
  mockActiveWorkflow.value = null
  mockOpenWorkflows.value = []
})

function createQueuedWorkflow(path: string = 'workflows/test.json') {
  return createTestWorkflow({
    activeState: { id: 'workflow-id' },
    initialState: { id: 'workflow-id' },
    path
  })
}

function createPromptNode(title: string, classType: string) {
  return {
    inputs: {},
    class_type: classType,
    _meta: {
      title
    }
  }
}

describe('useExecutionStore - NodeLocatorId conversions', () => {
  let store: ReturnType<typeof useExecutionStore>

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock implementations
    mockNodeIdToNodeLocatorId.mockReset()
    mockNodeLocatorIdToNodeExecutionId.mockReset()
    mockExecutionIdToCurrentId.mockReset()

    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useExecutionStore()
  })

  describe('executionIdToNodeLocatorId', () => {
    it('should convert execution ID to NodeLocatorId', () => {
      // Mock subgraph structure
      const mockSubgraph = {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        nodes: []
      }

      const mockNode = createMockLGraphNode({
        id: 123,
        isSubgraphNode: () => true,
        subgraph: mockSubgraph
      })
      // Mock app.rootGraph.getNodeById to return the mock node
      vi.mocked(app.rootGraph.getNodeById).mockReturnValue(mockNode)

      const result = executionIdToNodeLocatorId(app.rootGraph, '123:456')

      expect(result).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890:456')
    })

    it('should convert simple node ID to NodeLocatorId', () => {
      const result = executionIdToNodeLocatorId(app.rootGraph, '123')

      // For simple node IDs, it should return the ID as-is
      expect(result).toBe('123')
    })

    it('should handle numeric node IDs', () => {
      const result = executionIdToNodeLocatorId(app.rootGraph, 123)

      // For numeric IDs, it should convert to string and return as-is
      expect(result).toBe('123')
    })

    it('should return undefined when conversion fails', () => {
      // Mock app.rootGraph.getNodeById to return null (node not found)
      vi.mocked(app.rootGraph.getNodeById).mockReturnValue(null)

      expect(executionIdToNodeLocatorId(app.rootGraph, '999:456')).toBe(
        undefined
      )
    })
  })

  describe('nodeLocatorIdToExecutionId', () => {
    it('should convert NodeLocatorId to execution ID', () => {
      const locatorId = createNodeLocatorId(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        toNodeId(456)
      )
      const mockExecutionId = '123:456'
      mockNodeLocatorIdToNodeExecutionId.mockReturnValue(mockExecutionId)

      const result = store.nodeLocatorIdToExecutionId(locatorId)

      expect(mockNodeLocatorIdToNodeExecutionId).toHaveBeenCalledWith(locatorId)
      expect(result).toBe(mockExecutionId)
    })

    it('should return null when conversion fails', () => {
      const locatorId = createNodeLocatorId(
        'unknown-subgraph-id',
        toNodeId(456)
      )
      mockNodeLocatorIdToNodeExecutionId.mockReturnValue(null)

      const result = store.nodeLocatorIdToExecutionId(locatorId)

      expect(result).toBeNull()
    })
  })
})

describe('useExecutionStore - nodeLocationProgressStates caching', () => {
  let store: ReturnType<typeof useExecutionStore>

  beforeEach(() => {
    vi.clearAllMocks()
    mockNodeIdToNodeLocatorId.mockReset()
    mockNodeLocatorIdToNodeExecutionId.mockReset()
    mockExecutionIdToCurrentId.mockReset()

    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useExecutionStore()
  })

  it('should resolve execution IDs to locator IDs for subgraph nodes', () => {
    const mockSubgraph = {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      nodes: []
    }
    const mockNode = createMockLGraphNode({
      id: 123,
      isSubgraphNode: () => true,
      subgraph: mockSubgraph
    })
    vi.mocked(app.rootGraph.getNodeById).mockReturnValue(mockNode)

    store.nodeProgressStates = {
      node1: {
        display_node_id: '123:456',
        state: 'running',
        value: 50,
        max: 100,
        prompt_id: 'test',
        node_id: 'node1'
      }
    }

    const result = store.nodeLocationProgressStates

    expect(result[createNodeLocatorId(null, toNodeId(123))]).toBeDefined()
    expect(
      result[
        createNodeLocatorId(
          'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          toNodeId(456)
        )
      ]
    ).toBeDefined()
  })

  it('should not re-traverse graph for same execution IDs across progress updates', () => {
    const mockSubgraph = {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      nodes: []
    }
    const mockNode = createMockLGraphNode({
      id: 123,
      isSubgraphNode: () => true,
      subgraph: mockSubgraph
    })
    vi.mocked(app.rootGraph.getNodeById).mockReturnValue(mockNode)

    store.nodeProgressStates = {
      node1: {
        display_node_id: '123:456',
        state: 'running',
        value: 50,
        max: 100,
        prompt_id: 'test',
        node_id: 'node1'
      }
    }

    // First evaluation triggers graph traversal
    expect(
      store.nodeLocationProgressStates[createNodeLocatorId(null, toNodeId(123))]
    ).toBeDefined()
    const callCountAfterFirst = vi.mocked(app.rootGraph.getNodeById).mock.calls
      .length

    // Second update with same execution IDs but different progress
    store.nodeProgressStates = {
      node1: {
        display_node_id: '123:456',
        state: 'running',
        value: 75,
        max: 100,
        prompt_id: 'test',
        node_id: 'node1'
      }
    }

    expect(
      store.nodeLocationProgressStates[createNodeLocatorId(null, toNodeId(123))]
    ).toBeDefined()

    // getNodeById should NOT be called again for the same execution ID
    expect(vi.mocked(app.rootGraph.getNodeById).mock.calls.length).toBe(
      callCountAfterFirst
    )
  })

  it('should correctly resolve multiple sibling nodes in the same subgraph', () => {
    const mockSubgraph = {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      nodes: []
    }
    const mockNode = createMockLGraphNode({
      id: 123,
      isSubgraphNode: () => true,
      subgraph: mockSubgraph
    })
    vi.mocked(app.rootGraph.getNodeById).mockReturnValue(mockNode)

    // Two sibling nodes in the same subgraph
    store.nodeProgressStates = {
      node1: {
        display_node_id: '123:456',
        state: 'running',
        value: 50,
        max: 100,
        prompt_id: 'test',
        node_id: 'node1'
      },
      node2: {
        display_node_id: '123:789',
        state: 'running',
        value: 30,
        max: 100,
        prompt_id: 'test',
        node_id: 'node2'
      }
    }

    const result = store.nodeLocationProgressStates

    // Both sibling nodes should be resolved with the correct subgraph UUID
    expect(
      result[
        createNodeLocatorId(
          'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          toNodeId(456)
        )
      ]
    ).toBeDefined()
    expect(
      result[
        createNodeLocatorId(
          'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          toNodeId(789)
        )
      ]
    ).toBeDefined()

    // The shared parent "123" should also have a merged state
    expect(result[createNodeLocatorId(null, toNodeId(123))]).toBeDefined()
    expect(result[createNodeLocatorId(null, toNodeId(123))].state).toBe(
      'running'
    )
  })

  it('keeps an existing error state when later progress maps to the same locator', () => {
    store.nodeProgressStates = {
      node1: {
        display_node_id: '123',
        state: 'error',
        value: 0,
        max: 100,
        prompt_id: 'test',
        node_id: 'node1'
      },
      node2: {
        display_node_id: '123:456',
        state: 'running',
        value: 50,
        max: 100,
        prompt_id: 'test',
        node_id: 'node2'
      }
    }

    expect(
      store.nodeLocationProgressStates[createNodeLocatorId(null, toNodeId(123))]
        .state
    ).toBe('error')
  })

  it('ignores finished progress when current state is already running', () => {
    store.nodeProgressStates = {
      node1: {
        display_node_id: '123',
        state: 'running',
        value: 5,
        max: 10,
        prompt_id: 'test',
        node_id: 'node1'
      },
      node2: {
        display_node_id: '123',
        state: 'finished',
        value: 10,
        max: 10,
        prompt_id: 'test',
        node_id: 'node2'
      }
    }

    expect(
      store.nodeLocationProgressStates[createNodeLocatorId(null, toNodeId(123))]
    ).toMatchObject({ state: 'running', value: 5 })
  })

  it('keeps later running progress from moving a locator backwards', () => {
    store.nodeProgressStates = {
      node1: {
        display_node_id: '123',
        state: 'running',
        value: 6,
        max: 10,
        prompt_id: 'test',
        node_id: 'node1'
      },
      node2: {
        display_node_id: '123',
        state: 'running',
        value: 8,
        max: 10,
        prompt_id: 'test',
        node_id: 'node2'
      }
    }

    expect(
      store.nodeLocationProgressStates[createNodeLocatorId(null, toNodeId(123))]
    ).toMatchObject({ state: 'running', value: 6, max: 10 })
  })

  it('merges zero-max running progress without dividing by zero', () => {
    store.nodeProgressStates = {
      node1: {
        display_node_id: '123',
        state: 'pending',
        value: 0,
        max: 0,
        prompt_id: 'test',
        node_id: 'node1'
      },
      node2: {
        display_node_id: '123',
        state: 'running',
        value: 0,
        max: 0,
        prompt_id: 'test',
        node_id: 'node2'
      }
    }

    expect(
      store.nodeLocationProgressStates[createNodeLocatorId(null, toNodeId(123))]
    ).toMatchObject({ state: 'running', value: 0, max: 0 })
  })

  it('skips nested progress when the execution id cannot be resolved', () => {
    vi.mocked(app.rootGraph.getNodeById).mockReturnValue(null)
    store.nodeProgressStates = {
      node1: {
        display_node_id: '404:1',
        state: 'running',
        value: 5,
        max: 10,
        prompt_id: 'test',
        node_id: 'node1'
      }
    }

    expect(store.nodeLocationProgressStates).toHaveProperty('404')
    expect(store.nodeLocationProgressStates).not.toHaveProperty('404:1')
  })
})

describe('useExecutionStore - nodeProgressStatesByJob eviction', () => {
  let store: ReturnType<typeof useExecutionStore>

  function makeProgressNodes(
    nodeId: string,
    jobId: string
  ): Record<string, NodeProgressState> {
    return {
      [nodeId]: {
        value: 5,
        max: 10,
        state: 'running',
        node_id: nodeId,
        prompt_id: jobId,
        display_node_id: nodeId
      }
    }
  }

  function fireProgressState(
    jobId: string,
    nodes: Record<string, NodeProgressState>
  ) {
    const handler = apiEventHandlers.get('progress_state')
    if (!handler) throw new Error('progress_state handler not bound')
    handler(
      new CustomEvent('progress_state', { detail: { nodes, prompt_id: jobId } })
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    apiEventHandlers.clear()
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useExecutionStore()
    store.bindExecutionEvents()
  })

  it('should retain entries below the limit', () => {
    for (let i = 0; i < 5; i++) {
      fireProgressState(`job-${i}`, makeProgressNodes(`${i}`, `job-${i}`))
    }

    expect(Object.keys(store.nodeProgressStatesByJob)).toHaveLength(5)
  })

  it('should evict oldest entries when exceeding MAX_PROGRESS_JOBS', () => {
    for (let i = 0; i < MAX_PROGRESS_JOBS + 10; i++) {
      fireProgressState(`job-${i}`, makeProgressNodes(`${i}`, `job-${i}`))
    }

    const keys = Object.keys(store.nodeProgressStatesByJob)
    expect(keys).toHaveLength(MAX_PROGRESS_JOBS)
    // Oldest jobs (0-9) should be evicted; newest should remain
    expect(keys).not.toContain('job-0')
    expect(keys).not.toContain('job-9')
    expect(keys).toContain(`job-${MAX_PROGRESS_JOBS + 9}`)
    expect(keys).toContain(`job-${MAX_PROGRESS_JOBS}`)
  })

  it('should keep the most recently added job after eviction', () => {
    for (let i = 0; i < MAX_PROGRESS_JOBS + 1; i++) {
      fireProgressState(`job-${i}`, makeProgressNodes(`${i}`, `job-${i}`))
    }

    const lastJobId = `job-${MAX_PROGRESS_JOBS}`
    expect(store.nodeProgressStatesByJob).toHaveProperty(lastJobId)
  })

  it('should not evict when updating an existing job', () => {
    for (let i = 0; i < MAX_PROGRESS_JOBS; i++) {
      fireProgressState(`job-${i}`, makeProgressNodes(`${i}`, `job-${i}`))
    }
    expect(Object.keys(store.nodeProgressStatesByJob)).toHaveLength(
      MAX_PROGRESS_JOBS
    )

    // Update an existing job — should not trigger eviction
    fireProgressState('job-0', makeProgressNodes('0', 'job-0'))
    expect(Object.keys(store.nodeProgressStatesByJob)).toHaveLength(
      MAX_PROGRESS_JOBS
    )
    expect(store.nodeProgressStatesByJob).toHaveProperty('job-0')
  })
})

describe('useExecutionStore - reconcileInitializingJobs', () => {
  let store: ReturnType<typeof useExecutionStore>

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useExecutionStore()
  })

  it('should remove job IDs not present in active jobs', () => {
    store.initializingJobIds = new Set(['job-1', 'job-2', 'job-3'])

    store.reconcileInitializingJobs(new Set(['job-1']))

    expect(store.initializingJobIds).toEqual(new Set(['job-1']))
  })

  it('should be a no-op when all initializing IDs are active', () => {
    store.initializingJobIds = new Set(['job-1', 'job-2'])

    store.reconcileInitializingJobs(new Set(['job-1', 'job-2', 'job-3']))

    expect(store.initializingJobIds).toEqual(new Set(['job-1', 'job-2']))
  })

  it('should be a no-op when there are no initializing jobs', () => {
    store.initializingJobIds = new Set()

    store.reconcileInitializingJobs(new Set(['job-1']))

    expect(store.initializingJobIds).toEqual(new Set())
  })

  it('should clear all initializing IDs when no active jobs exist', () => {
    store.initializingJobIds = new Set(['job-1', 'job-2'])

    store.reconcileInitializingJobs(new Set())

    expect(store.initializingJobIds).toEqual(new Set())
  })

  it('clears initialization ids directly', () => {
    store.initializingJobIds = new Set(['job-1'])

    store.clearInitializationByJobId(null)
    store.clearInitializationByJobId('missing')
    store.clearInitializationByJobId('job-1')

    expect(store.initializingJobIds).toEqual(new Set())
  })

  it('checks initializing jobs by stringified id', () => {
    store.initializingJobIds = new Set(['7'])

    expect(store.isJobInitializing(undefined)).toBe(false)
    expect(store.isJobInitializing(7)).toBe(true)
  })

  it('does not rewrite initializing state when no requested ids are tracked', () => {
    store.initializingJobIds = new Set(['job-1'])
    const before = store.initializingJobIds

    store.clearInitializationByJobIds(['missing'])

    expect(store.initializingJobIds).toBe(before)
    expect(store.initializingJobIds).toEqual(new Set(['job-1']))
  })
})

describe('useExecutionStore - workflowStatus', () => {
  let store: ReturnType<typeof useExecutionStore>
  const makeWorkflow = (path: string): ComfyWorkflow =>
    fromPartial<ComfyWorkflow>({ path, filename: path.split('/').pop() })
  const workflowA = makeWorkflow('/workflows/a.json')
  const workflowB = makeWorkflow('/workflows/b.json')

  function fireExecutionStart(jobId: string) {
    const handler = apiEventHandlers.get('execution_start')
    if (!handler) throw new Error('execution_start handler not bound')
    handler(
      new CustomEvent('execution_start', { detail: { prompt_id: jobId } })
    )
  }

  function fireExecutionSuccess(jobId: string) {
    const handler = apiEventHandlers.get('execution_success')
    if (!handler) throw new Error('execution_success handler not bound')
    handler(
      new CustomEvent('execution_success', { detail: { prompt_id: jobId } })
    )
  }

  function fireExecutionError(jobId: string) {
    const handler = apiEventHandlers.get('execution_error')
    if (!handler) throw new Error('execution_error handler not bound')
    handler(
      new CustomEvent('execution_error', {
        detail: {
          prompt_id: jobId,
          node_id: '1',
          node_type: 'TestNode',
          exception_message: 'fail',
          exception_type: 'Error',
          traceback: []
        }
      })
    )
  }

  function fireExecutionInterrupted(jobId: string) {
    const handler = apiEventHandlers.get('execution_interrupted')
    if (!handler) throw new Error('execution_interrupted handler not bound')
    handler(
      new CustomEvent('execution_interrupted', {
        detail: { prompt_id: jobId }
      })
    )
  }

  function callStoreJob(jobId: string, workflow: ComfyWorkflow) {
    store.storeJob({
      nodes: ['1'],
      id: jobId,
      promptOutput: { '1': createPromptNode('Node', 'TestNode') },
      workflow
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    apiEventHandlers.clear()
    mockOpenWorkflows.value = [workflowA, workflowB]
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useExecutionStore()
    store.bindExecutionEvents()
  })

  it('sets running on execution_start when storeJob already ran', () => {
    callStoreJob('job-1', workflowA)
    fireExecutionStart('job-1')

    expect(store.getWorkflowStatus(workflowA)).toBe('running')
  })

  it('flushes running status when storeJob arrives after WS', () => {
    fireExecutionStart('job-1')
    expect(store.getWorkflowStatus(workflowA)).toBeUndefined()

    callStoreJob('job-1', workflowA)
    expect(store.getWorkflowStatus(workflowA)).toBe('running')
  })

  it('flushes terminal completed when WS finishes before storeJob', () => {
    // Instant-finish race: WS fires start+success before HTTP response.
    fireExecutionStart('job-1')
    fireExecutionSuccess('job-1')

    callStoreJob('job-1', workflowA)
    expect(store.getWorkflowStatus(workflowA)).toBe('completed')
  })

  it('flushes terminal failed when WS errors before storeJob', () => {
    // Invalid-workflow path: execution_error fires before HTTP response.
    fireExecutionError('job-1')

    callStoreJob('job-1', workflowA)
    expect(store.getWorkflowStatus(workflowA)).toBe('failed')
  })

  it('drops pending status on interrupt before storeJob', () => {
    fireExecutionStart('job-1')
    fireExecutionInterrupted('job-1')

    callStoreJob('job-1', workflowA)
    expect(store.getWorkflowStatus(workflowA)).toBeUndefined()
  })

  it('sets completed on execution_success', () => {
    callStoreJob('job-1', workflowA)
    fireExecutionStart('job-1')
    fireExecutionSuccess('job-1')

    expect(store.getWorkflowStatus(workflowA)).toBe('completed')
  })

  it('leaves workflowStatus unchanged when open workflows are unchanged', async () => {
    callStoreJob('job-a', workflowA)
    fireExecutionSuccess('job-a')

    mockOpenWorkflows.value = [workflowA, workflowB]
    await nextTick()

    expect(store.getWorkflowStatus(workflowA)).toBe('completed')
  })

  it('sets failed on execution_error', () => {
    callStoreJob('job-1', workflowA)
    fireExecutionStart('job-1')
    fireExecutionError('job-1')

    expect(store.getWorkflowStatus(workflowA)).toBe('failed')
  })

  it('skips status badge on user-initiated interrupt', () => {
    callStoreJob('job-1', workflowA)
    fireExecutionStart('job-1')
    fireExecutionInterrupted('job-1')

    expect(store.getWorkflowStatus(workflowA)).toBeUndefined()
  })

  it('handles interrupt for a queued workflow with no active job', () => {
    callStoreJob('job-1', workflowA)

    fireExecutionInterrupted('job-1')

    expect(store.getWorkflowStatus(workflowA)).toBeUndefined()
  })

  it('evicts the oldest pending status once the buffer cap is exceeded', () => {
    // Each start with no matching storeJob buffers a 'running' status. One
    // past the cap evicts the oldest so the buffer can't grow unbounded.
    for (let i = 0; i <= MAX_PROGRESS_JOBS; i++) fireExecutionStart(`job-${i}`)

    callStoreJob('job-0', workflowA)
    expect(store.getWorkflowStatus(workflowA)).toBeUndefined()

    callStoreJob(`job-${MAX_PROGRESS_JOBS}`, workflowB)
    expect(store.getWorkflowStatus(workflowB)).toBe('running')
  })

  it('overwrites stale terminal with running on re-queue', () => {
    callStoreJob('job-1', workflowA)
    fireExecutionStart('job-1')
    fireExecutionSuccess('job-1')
    expect(store.getWorkflowStatus(workflowA)).toBe('completed')

    // Re-queue the same workflow under a fresh jobId.
    callStoreJob('job-2', workflowA)
    fireExecutionStart('job-2')
    expect(store.getWorkflowStatus(workflowA)).toBe('running')
  })

  it('ignores status events for unknown prompt ids', () => {
    fireExecutionSuccess('unknown-job')
    expect(store.getWorkflowStatus(workflowA)).toBeUndefined()
    expect(store.getWorkflowStatus(workflowB)).toBeUndefined()
  })

  it('prunes only closed workflows, leaving open ones intact', async () => {
    callStoreJob('job-a', workflowA)
    callStoreJob('job-b', workflowB)
    fireExecutionSuccess('job-a')
    fireExecutionSuccess('job-b')

    mockOpenWorkflows.value = [workflowB]
    await nextTick()

    expect(store.getWorkflowStatus(workflowA)).toBeUndefined()
    expect(store.getWorkflowStatus(workflowB)).toBe('completed')
  })

  it('ignores terminal events for a workflow closed mid-run', async () => {
    callStoreJob('job-a', workflowA)
    fireExecutionStart('job-a')
    expect(store.getWorkflowStatus(workflowA)).toBe('running')

    // Close the tab while the job is still running.
    mockOpenWorkflows.value = [workflowB]
    await nextTick()
    expect(store.getWorkflowStatus(workflowA)).toBeUndefined()

    // A late success must not resurrect an entry for the closed workflow.
    fireExecutionSuccess('job-a')
    expect(store.getWorkflowStatus(workflowA)).toBeUndefined()
  })

  it('drops service-level errors without writing failed', () => {
    callStoreJob('job-1', workflowA)
    fireExecutionStart('job-1')
    expect(store.getWorkflowStatus(workflowA)).toBe('running')

    // Service-level error: empty node_id triggers the short-circuit branch.
    const handler = apiEventHandlers.get('execution_error')
    handler!(
      new CustomEvent('execution_error', {
        detail: {
          prompt_id: 'job-1',
          node_id: '',
          node_type: '',
          exception_message: 'Job has stagnated',
          exception_type: 'StagnationError',
          traceback: []
        }
      })
    )

    expect(store.getWorkflowStatus(workflowA)).toBe('running')
  })

  it('drops pending failed when service-level error fires before storeJob', () => {
    apiEventHandlers.get('execution_error')!(
      new CustomEvent('execution_error', {
        detail: {
          prompt_id: 'job-1',
          node_id: '',
          node_type: '',
          exception_message: 'Job has stagnated',
          exception_type: 'StagnationError',
          traceback: []
        }
      })
    )

    callStoreJob('job-1', workflowA)
    expect(store.getWorkflowStatus(workflowA)).toBeUndefined()
  })

  it('clears workflowStatus on unbindExecutionEvents', () => {
    callStoreJob('job-1', workflowA)
    fireExecutionStart('job-1')
    fireExecutionSuccess('job-1')
    expect(store.getWorkflowStatus(workflowA)).toBe('completed')

    store.unbindExecutionEvents()
    expect(store.getWorkflowStatus(workflowA)).toBeUndefined()
  })
})

describe('useExecutionStore - clearActiveJobIfStale', () => {
  let store: ReturnType<typeof useExecutionStore>

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useExecutionStore()
  })

  it('clears the active job and progress state when not in the active set', () => {
    store.activeJobId = 'job-1'
    store.queuedJobs = { 'job-1': { nodes: { 'node-1': false } } }
    store.nodeProgressStates = {
      'node-1': {
        value: 5,
        max: 10,
        state: 'running',
        node_id: 'node-1',
        display_node_id: 'node-1',
        prompt_id: 'job-1'
      }
    }

    store.clearActiveJobIfStale(new Set(['job-2']))

    expect(store.activeJobId).toBeNull()
    expect(store.queuedJobs['job-1']).toBeUndefined()
    expect(store.nodeProgressStates).toEqual({})
  })

  it('preserves the active job when present in the active set', () => {
    store.activeJobId = 'job-1'
    store.queuedJobs = { 'job-1': { nodes: {} } }

    store.clearActiveJobIfStale(new Set(['job-1', 'job-2']))

    expect(store.activeJobId).toBe('job-1')
    expect(store.queuedJobs['job-1']).toBeDefined()
  })

  it('is a no-op when there is no active job', () => {
    store.activeJobId = null
    store.queuedJobs = { other: { nodes: {} } }

    store.clearActiveJobIfStale(new Set())

    expect(store.activeJobId).toBeNull()
    expect(store.queuedJobs['other']).toBeDefined()
  })
})

describe('useExecutionStore - progress_text startup guard', () => {
  let store: ReturnType<typeof useExecutionStore>

  function fireProgressText(detail: {
    nodeId: string
    text: string
    prompt_id?: string
  }) {
    const handler = apiEventHandlers.get('progress_text')
    if (!handler) throw new Error('progress_text handler not bound')
    handler(new CustomEvent('progress_text', { detail }))
  }

  beforeEach(() => {
    vi.clearAllMocks()
    apiEventHandlers.clear()
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useExecutionStore()
    store.bindExecutionEvents()
  })

  it('should ignore progress_text before the canvas is initialized', async () => {
    const { useCanvasStore } =
      await import('@/renderer/core/canvas/canvasStore')
    useCanvasStore().canvas = null

    expect(() =>
      fireProgressText({
        nodeId: toNodeId('1'),
        text: 'warming up'
      })
    ).not.toThrow()

    expect(mockShowTextPreview).not.toHaveBeenCalled()
  })

  it('should call showTextPreview when canvas is available', async () => {
    const mockNode = createMockLGraphNode({ id: 1 })
    const { useCanvasStore } =
      await import('@/renderer/core/canvas/canvasStore')
    useCanvasStore().canvas = fromPartial<LGraphCanvas>({
      graph: { getNodeById: vi.fn(() => mockNode) }
    })

    fireProgressText({ nodeId: toNodeId('1'), text: 'warming up' })

    expect(mockShowTextPreview).toHaveBeenCalledWith(mockNode, 'warming up')
  })

  it('should ignore progress_text for another active prompt', async () => {
    const mockNode = createMockLGraphNode({ id: 1 })
    const { useCanvasStore } =
      await import('@/renderer/core/canvas/canvasStore')
    useCanvasStore().canvas = fromPartial<LGraphCanvas>({
      graph: { getNodeById: vi.fn(() => mockNode) }
    })
    store.activeJobId = 'job-1'

    fireProgressText({
      nodeId: toNodeId('1'),
      text: 'warming up',
      prompt_id: 'job-2'
    })

    expect(mockShowTextPreview).not.toHaveBeenCalled()
  })

  it('should ignore progress_text without text or node id', () => {
    fireProgressText({ nodeId: toNodeId('1'), text: '' })
    fireProgressText({
      nodeId: '' as ReturnType<typeof toNodeId>,
      text: 'warming up'
    })

    expect(mockShowTextPreview).not.toHaveBeenCalled()
  })

  it('should ignore nested progress_text when the execution ID cannot be mapped', async () => {
    const { useCanvasStore } =
      await import('@/renderer/core/canvas/canvasStore')
    useCanvasStore().canvas = fromPartial<LGraphCanvas>({
      graph: { getNodeById: vi.fn() }
    })
    mockExecutionIdToCurrentId.mockReturnValue(undefined)

    expect(() =>
      fireProgressText({ nodeId: toNodeId('1:2'), text: 'warming up' })
    ).not.toThrow()

    expect(mockExecutionIdToCurrentId).toHaveBeenCalledWith('1:2')
    expect(mockShowTextPreview).not.toHaveBeenCalled()
  })

  it('should ignore progress_text when the current node id cannot be parsed', async () => {
    const { useCanvasStore } =
      await import('@/renderer/core/canvas/canvasStore')
    useCanvasStore().canvas = fromPartial<LGraphCanvas>({
      graph: { getNodeById: vi.fn() }
    })
    mockExecutionIdToCurrentId.mockReturnValue({})

    fireProgressText({ nodeId: toNodeId('1:2'), text: 'warming up' })

    expect(mockShowTextPreview).not.toHaveBeenCalled()
  })
})

describe('useExecutionErrorStore - Node Error Lookups', () => {
  let store: ReturnType<typeof useExecutionErrorStore>

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useExecutionErrorStore()
  })

  describe('getNodeErrors', () => {
    it('should return undefined when no errors exist', () => {
      const result = store.getNodeErrors(
        createNodeLocatorId(null, toNodeId(123))
      )
      expect(result).toBeUndefined()
    })

    it('should return node error by locator ID for root graph node', () => {
      store.recordNodeErrors({
        '123': {
          errors: [
            {
              type: 'validation_error',
              message: 'Invalid input',
              details: 'Width must be positive',
              extra_info: { input_name: 'width' }
            }
          ],
          class_type: 'TestNode',
          dependent_outputs: []
        }
      })

      const result = store.getNodeErrors(
        createNodeLocatorId(null, toNodeId(123))
      )
      expect(result).toBeDefined()
      expect(result?.errors).toHaveLength(1)
      expect(result?.errors[0].message).toBe('Invalid input')
    })

    it('should return node error by locator ID for subgraph node', () => {
      const subgraphUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      const mockSubgraph = {
        id: subgraphUuid,
        getNodeById: vi.fn(),
        nodes: []
      }

      const mockNode = createMockLGraphNode({
        id: 123,
        isSubgraphNode: () => true,
        subgraph: mockSubgraph
      })

      vi.mocked(app.rootGraph.getNodeById).mockReturnValue(mockNode)

      store.recordNodeErrors({
        '123:456': {
          errors: [
            {
              type: 'validation_error',
              message: 'Invalid subgraph input',
              details: 'Missing required input',
              extra_info: { input_name: 'image' }
            }
          ],
          class_type: 'SubgraphNode',
          dependent_outputs: []
        }
      })

      const locatorId = createNodeLocatorId(subgraphUuid, toNodeId(456))
      const result = store.getNodeErrors(locatorId)
      expect(result).toBeDefined()
      expect(result?.errors[0].message).toBe('Invalid subgraph input')
    })
  })

  describe('slotHasError', () => {
    it('should return false when node has no errors', () => {
      const result = store.slotHasError(
        createNodeLocatorId(null, toNodeId(123)),
        'width'
      )
      expect(result).toBe(false)
    })

    it('should return false when node has errors but slot is not mentioned', () => {
      store.recordNodeErrors({
        '123': {
          errors: [
            {
              type: 'validation_error',
              message: 'Invalid input',
              details: 'Width must be positive',
              extra_info: { input_name: 'width' }
            }
          ],
          class_type: 'TestNode',
          dependent_outputs: []
        }
      })

      const result = store.slotHasError(
        createNodeLocatorId(null, toNodeId(123)),
        'height'
      )
      expect(result).toBe(false)
    })

    it('should return true when slot has error', () => {
      store.recordNodeErrors({
        '123': {
          errors: [
            {
              type: 'validation_error',
              message: 'Invalid input',
              details: 'Width must be positive',
              extra_info: { input_name: 'width' }
            }
          ],
          class_type: 'TestNode',
          dependent_outputs: []
        }
      })

      const result = store.slotHasError(
        createNodeLocatorId(null, toNodeId(123)),
        'width'
      )
      expect(result).toBe(true)
    })

    it('should return true when multiple errors exist for the same slot', () => {
      store.recordNodeErrors({
        '123': {
          errors: [
            {
              type: 'validation_error',
              message: 'Invalid input',
              details: 'Width must be positive',
              extra_info: { input_name: 'width' }
            },
            {
              type: 'validation_error',
              message: 'Invalid range',
              details: 'Width must be less than 1000',
              extra_info: { input_name: 'width' }
            }
          ],
          class_type: 'TestNode',
          dependent_outputs: []
        }
      })

      const result = store.slotHasError(
        createNodeLocatorId(null, toNodeId(123)),
        'width'
      )
      expect(result).toBe(true)
    })

    it('should handle errors without extra_info', () => {
      store.recordNodeErrors({
        '123': {
          errors: [
            {
              type: 'validation_error',
              message: 'General error',
              details: 'Something went wrong'
            }
          ],
          class_type: 'TestNode',
          dependent_outputs: []
        }
      })

      const result = store.slotHasError(
        createNodeLocatorId(null, toNodeId(123)),
        'width'
      )
      expect(result).toBe(false)
    })
  })
})

describe('useExecutionStore - executingNode with subgraphs', () => {
  let store: ReturnType<typeof useExecutionStore>

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useExecutionStore()
  })

  it('should find executing node info in root graph from queued prompt data', () => {
    store.storeJob({
      id: 'test-prompt',
      nodes: ['123'],
      promptOutput: {
        '123': createPromptNode('Test Node', 'TestNode')
      },
      workflow: createQueuedWorkflow()
    })
    store.activeJobId = 'test-prompt'

    store.nodeProgressStates = {
      '123': {
        state: 'running',
        value: 0,
        max: 100,
        display_node_id: '123',
        prompt_id: 'test-prompt',
        node_id: '123'
      }
    }

    expect(store.executingNode).toEqual({
      title: 'Test Node',
      type: 'TestNode'
    })
  })

  it('should find executing node info in subgraph using execution ID', () => {
    store.storeJob({
      id: 'test-prompt',
      nodes: ['456:789'],
      promptOutput: {
        '456:789': createPromptNode('Nested Node', 'NestedNode')
      },
      workflow: createQueuedWorkflow()
    })
    store.activeJobId = 'test-prompt'

    store.nodeProgressStates = {
      '456:789': {
        state: 'running',
        value: 0,
        max: 100,
        display_node_id: '456:789',
        prompt_id: 'test-prompt',
        node_id: '456:789'
      }
    }

    expect(store.executingNode).toEqual({
      title: 'Nested Node',
      type: 'NestedNode'
    })
  })

  it('should return null when no node is executing', () => {
    store.nodeProgressStates = {}

    expect(store.executingNode).toBeNull()
  })

  it('should return null when executing node metadata cannot be found', () => {
    store.storeJob({
      id: 'test-prompt',
      nodes: ['123'],
      promptOutput: {
        '123': createPromptNode('Test Node', 'TestNode')
      },
      workflow: createQueuedWorkflow()
    })
    store.activeJobId = 'test-prompt'

    store.nodeProgressStates = {
      '999': {
        state: 'running',
        value: 0,
        max: 100,
        display_node_id: '999',
        prompt_id: 'test-prompt',
        node_id: '999'
      }
    }

    expect(store.executingNode).toBeNull()
  })
})

describe('useMissingNodesErrorStore - setMissingNodeTypes', () => {
  let store: ReturnType<typeof useMissingNodesErrorStore>

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useMissingNodesErrorStore()
  })

  it('clears missingNodesError when called with an empty array', () => {
    store.setMissingNodeTypes([{ type: 'NodeA' }])
    store.setMissingNodeTypes([])
    expect(store.missingNodesError).toBeNull()
  })

  it('hasMissingNodes is false when error is null', () => {
    store.setMissingNodeTypes([])
    expect(store.hasMissingNodes).toBe(false)
  })

  it('hasMissingNodes is true after setting non-empty types', () => {
    store.setMissingNodeTypes([{ type: 'NodeA' }])
    expect(store.hasMissingNodes).toBe(true)
  })

  it('deduplicates string entries by value', () => {
    store.setMissingNodeTypes(['GroupNode', 'GroupNode', 'OtherGroup'])
    expect(store.missingNodesError?.nodeTypes).toHaveLength(2)
    expect(store.missingNodesError?.nodeTypes).toEqual([
      'GroupNode',
      'OtherGroup'
    ])
  })

  it('keeps a single string entry unchanged', () => {
    store.setMissingNodeTypes(['GroupNode'])
    expect(store.missingNodesError?.nodeTypes).toHaveLength(1)
  })

  it('deduplicates object entries with the same nodeId', () => {
    store.setMissingNodeTypes([
      { type: 'NodeA', nodeId: toNodeId(1) },
      { type: 'NodeA', nodeId: toNodeId(1) }
    ])
    expect(store.missingNodesError?.nodeTypes).toHaveLength(1)
  })

  it('keeps object entries with different nodeIds even if same type', () => {
    store.setMissingNodeTypes([
      { type: 'NodeA', nodeId: toNodeId(1) },
      { type: 'NodeA', nodeId: toNodeId(2) }
    ])
    expect(store.missingNodesError?.nodeTypes).toHaveLength(2)
  })

  it('deduplicates object entries by type when nodeId is absent', () => {
    store.setMissingNodeTypes([{ type: 'NodeB' }, { type: 'NodeB' }])
    expect(store.missingNodesError?.nodeTypes).toHaveLength(1)
  })

  it('keeps distinct types when nodeId is absent', () => {
    store.setMissingNodeTypes([{ type: 'NodeB' }, { type: 'NodeC' }])
    expect(store.missingNodesError?.nodeTypes).toHaveLength(2)
  })

  it('treats absent nodeId the same as type-only key (falls back to type)', () => {
    store.setMissingNodeTypes([{ type: 'NodeD' }, { type: 'NodeD' }])
    expect(store.missingNodesError?.nodeTypes).toHaveLength(1)
  })

  it('handles a mix of string and object entries correctly', () => {
    store.setMissingNodeTypes([
      'GroupNode',
      'GroupNode', // string dup
      { type: 'NodeA', nodeId: toNodeId(1) },
      { type: 'NodeA', nodeId: toNodeId(1) }, // object dup by nodeId
      { type: 'NodeA', nodeId: toNodeId(2) }, // same type, different nodeId → kept
      { type: 'NodeB' },
      { type: 'NodeB' } // object dup by type
    ])
    // Unique: 'GroupNode', {NodeA,1}, {NodeA,2}, {NodeB} → 4
    expect(store.missingNodesError?.nodeTypes).toHaveLength(4)
  })

  it('stores a non-empty message string in missingNodesError', () => {
    store.setMissingNodeTypes([{ type: 'NodeA' }])
    expect(typeof store.missingNodesError?.message).toBe('string')
    expect(store.missingNodesError!.message.length).toBeGreaterThan(0)
  })

  it('stores the deduplicated nodeTypes array in missingNodesError', () => {
    const input = [{ type: 'NodeA' }, { type: 'NodeB' }]
    store.setMissingNodeTypes(input)
    expect(store.missingNodesError?.nodeTypes).toEqual(input)
  })
})

describe('useExecutionStore - WebSocket event handlers', () => {
  let store: ReturnType<typeof useExecutionStore>

  function fire<T>(event: string, detail: T) {
    const handler = apiEventHandlers.get(event)
    if (!handler) throw new Error(`${event} handler not bound`)
    handler(new CustomEvent(event, { detail }))
  }

  beforeEach(() => {
    vi.clearAllMocks()
    apiEventHandlers.clear()
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useExecutionStore()
    store.bindExecutionEvents()
  })

  describe('execution_start', () => {
    it('sets activeJobId and seeds an empty queued job entry', () => {
      fire('execution_start', { prompt_id: 'job-1', timestamp: 0 })

      expect(store.activeJobId).toBe('job-1')
      expect(store.queuedJobs['job-1']).toEqual({ nodes: {} })
    })

    it('clears transient errors while preserving validation errors', () => {
      const errorStore = useExecutionErrorStore()
      const nodeErrors = {
        '1': {
          class_type: 'Test',
          dependent_outputs: [],
          errors: [
            {
              type: 'required_input_missing',
              message: 'Missing',
              details: '',
              extra_info: { input_name: 'x' }
            }
          ]
        }
      }
      errorStore.recordExecutionError({
        prompt_id: 'old-job',
        timestamp: 0,
        node_id: '1',
        node_type: 'Test',
        executed: [],
        exception_message: 'boom',
        exception_type: 'RuntimeError',
        traceback: []
      })
      errorStore.recordPromptError({
        type: 'old-error',
        message: 'old prompt error',
        details: ''
      })
      errorStore.recordNodeErrors(nodeErrors)
      errorStore.showErrorOverlay()

      fire('execution_start', { prompt_id: 'job-1', timestamp: 0 })

      expect(errorStore.lastExecutionError).toBeNull()
      expect(errorStore.lastPromptError).toBeNull()
      expect(errorStore.lastNodeErrors).toEqual(nodeErrors)
      expect(errorStore.isErrorOverlayOpen).toBe(true)
    })

    it('clears initializing state for the starting job', () => {
      store.initializingJobIds = new Set(['job-1', 'job-2'])
      fire('execution_start', { prompt_id: 'job-1', timestamp: 0 })

      expect(store.initializingJobIds.has('job-1')).toBe(false)
      expect(store.initializingJobIds.has('job-2')).toBe(true)
    })

    it('captures a queued workflow path when the start event wins the race', () => {
      store.queuedJobs = {
        'job-1': {
          nodes: {},
          workflow: createQueuedWorkflow('/workflows/race.json')
        }
      }

      fire('execution_start', { prompt_id: 'job-1', timestamp: 0 })

      expect(store.jobIdToSessionWorkflowPath.get('job-1')).toBe(
        '/workflows/race.json'
      )
    })
  })

  describe('execution_cached', () => {
    it('marks the listed nodes as cached on the active job', () => {
      fire('execution_start', { prompt_id: 'job-1', timestamp: 0 })

      fire('execution_cached', {
        prompt_id: 'job-1',
        nodes: ['nodeA', 'nodeB'],
        timestamp: 0
      })

      expect(store.activeJob?.nodes).toEqual({ nodeA: true, nodeB: true })
    })

    it('is a no-op when no active job exists', () => {
      fire('execution_cached', {
        prompt_id: 'job-1',
        nodes: ['nodeA'],
        timestamp: 0
      })

      expect(store.activeJob).toBeUndefined()
    })
  })

  describe('execution_interrupted', () => {
    it('clears active job state on interrupt', () => {
      fire('execution_start', { prompt_id: 'job-1', timestamp: 0 })
      expect(store.activeJobId).toBe('job-1')

      fire('execution_interrupted', {
        prompt_id: 'job-1',
        node_id: 'n1',
        node_type: 't',
        executed: [],
        timestamp: 0
      })

      expect(store.activeJobId).toBeNull()
      expect(store.queuedJobs['job-1']).toBeUndefined()
    })
  })

  describe('executed', () => {
    it('marks the executed node as done on the active job', () => {
      fire('execution_start', { prompt_id: 'job-1', timestamp: 0 })
      fire('execution_cached', {
        prompt_id: 'job-1',
        nodes: ['n1'],
        timestamp: 0
      })

      fire('executed', {
        node: 'n1',
        display_node: 'n1',
        prompt_id: 'job-1',
        output: {}
      })

      expect(store.activeJob?.nodes['n1']).toBe(true)
    })

    it('is a no-op when no active job exists', () => {
      expect(() =>
        fire('executed', {
          node: 'n1',
          display_node: 'n1',
          prompt_id: 'orphan',
          output: {}
        })
      ).not.toThrow()
      expect(store.activeJob).toBeUndefined()
    })
  })

  describe('execution_success', () => {
    it('clears active job and progress state', () => {
      fire('execution_start', { prompt_id: 'job-1', timestamp: 0 })

      fire('execution_success', { prompt_id: 'job-1', timestamp: 0 })

      expect(store.activeJobId).toBeNull()
      expect(store.queuedJobs['job-1']).toBeUndefined()
    })

    it('does not track success for jobs this client did not queue', () => {
      fire('execution_success', { prompt_id: 'foreign-job', timestamp: 0 })

      expect(mockTrackExecutionSuccess).not.toHaveBeenCalled()
      expect(mockTrackSharedWorkflowRun).not.toHaveBeenCalled()
    })

    it('tracks shared workflow run when the queued workflow has share attribution', () => {
      const workflow = createQueuedWorkflow()
      workflow.shareId = 'share-1'
      store.storeJob({
        nodes: ['a'],
        id: 'job-1',
        promptOutput: {
          a: createPromptNode('Node A', 'NodeA')
        },
        workflow
      })
      fire('execution_start', { prompt_id: 'job-1', timestamp: 0 })

      fire('execution_success', { prompt_id: 'job-1', timestamp: 0 })

      expect(mockTrackExecutionSuccess).toHaveBeenCalledWith({
        jobId: 'job-1'
      })
      expect(mockTrackSharedWorkflowRun).toHaveBeenCalledWith({
        job_id: 'job-1',
        share_id: 'share-1',
        view_mode: 'graph',
        is_app_mode: false
      })
    })

    it('tracks shared workflow run from the success event job', () => {
      const workflow = createQueuedWorkflow()
      workflow.shareId = 'share-1'
      store.storeJob({
        nodes: ['a'],
        id: 'job-1',
        promptOutput: {
          a: createPromptNode('Node A', 'NodeA')
        },
        workflow
      })

      fire('execution_success', { prompt_id: 'job-1', timestamp: 0 })

      expect(mockTrackSharedWorkflowRun).toHaveBeenCalledWith({
        job_id: 'job-1',
        share_id: 'share-1',
        view_mode: 'graph',
        is_app_mode: false
      })
    })

    it('attributes shared workflow run to queue-time mode, not completion-time mode', () => {
      const workflow = createQueuedWorkflow()
      workflow.shareId = 'share-1'
      store.storeJob({
        nodes: ['a'],
        id: 'job-1',
        promptOutput: {
          a: createPromptNode('Node A', 'NodeA')
        },
        workflow
      })

      mockAppModeState.mode.value = 'app'
      mockAppModeState.isAppMode.value = true
      fire('execution_success', { prompt_id: 'job-1', timestamp: 0 })

      expect(mockTrackSharedWorkflowRun).toHaveBeenCalledWith({
        job_id: 'job-1',
        share_id: 'share-1',
        view_mode: 'graph',
        is_app_mode: false
      })
    })

    it('attributes shared workflow run to the queued workflow, not the active one', () => {
      const workflow = createQueuedWorkflow()
      workflow.shareId = 'share-1'
      workflow.activeMode = 'app'
      store.storeJob({
        nodes: ['a'],
        id: 'job-1',
        promptOutput: {
          a: createPromptNode('Node A', 'NodeA')
        },
        workflow
      })

      fire('execution_success', { prompt_id: 'job-1', timestamp: 0 })

      expect(mockTrackSharedWorkflowRun).toHaveBeenCalledWith({
        job_id: 'job-1',
        share_id: 'share-1',
        view_mode: 'app',
        is_app_mode: true
      })
    })

    it('uses current mode when shared queued job has no queued mode snapshot', () => {
      mockAppModeState.mode.value = 'app'
      mockAppModeState.isAppMode.value = true
      store.queuedJobs = {
        'job-1': {
          nodes: {},
          shareId: 'share-1'
        }
      }

      fire('execution_success', { prompt_id: 'job-1', timestamp: 0 })

      expect(mockTrackSharedWorkflowRun).toHaveBeenCalledWith({
        job_id: 'job-1',
        share_id: 'share-1',
        view_mode: 'app',
        is_app_mode: true
      })
    })
  })

  describe('executing', () => {
    it('is a no-op when there is no active job', () => {
      store.activeJobId = 'ghost-job'

      fire('executing', null)

      expect(store.activeJobId).toBe('ghost-job')
    })

    it('clears _executingNodeProgress and activeJobId when detail is null', () => {
      fire('execution_start', { prompt_id: 'job-1', timestamp: 0 })
      store._executingNodeProgress = {
        value: 1,
        max: 2,
        prompt_id: 'job-1',
        node: '1'
      }

      fire('executing', null)

      expect(store._executingNodeProgress).toBeNull()
      expect(store.activeJobId).toBeNull()
    })

    it('keeps the active job when a numeric node id is executing', () => {
      fire('execution_start', { prompt_id: 'job-1', timestamp: 0 })

      fire('executing', 123)

      expect(store.activeJobId).toBe('job-1')
      expect(store.queuedJobs['job-1']).toBeDefined()
    })
  })

  describe('progress_state', () => {
    it('does not revoke previews when the node execution id is invalid', () => {
      mockRevokePreviewsByExecutionId.mockClear()

      fire('progress_state', {
        prompt_id: 'job-1',
        nodes: {
          '': {
            value: 1,
            max: 2,
            state: 'running',
            node_id: '',
            display_node_id: '',
            prompt_id: 'job-1'
          }
        }
      })

      expect(mockRevokePreviewsByExecutionId).not.toHaveBeenCalled()
      expect(store.nodeProgressStates).toHaveProperty('')
    })
  })

  describe('progress', () => {
    it('sets _executingNodeProgress from the event payload', () => {
      const payload = { value: 3, max: 10, prompt_id: 'job-1', node: 'n1' }

      fire('progress', payload)

      expect(store._executingNodeProgress).toEqual(payload)
    })
  })

  describe('status', () => {
    it('reads clientId from api once and stops listening', async () => {
      const apiModule = await import('@/scripts/api')
      const removeSpy = vi.mocked(apiModule.api.removeEventListener)

      fire('status', { exec_info: { queue_remaining: 0 } })

      expect(store.clientId).toBe('test-client')
      expect(removeSpy).toHaveBeenCalledWith('status', expect.any(Function))
    })

    it('keeps listening when status arrives before clientId is available', async () => {
      const apiModule = await import('@/scripts/api')
      const removeSpy = vi.mocked(apiModule.api.removeEventListener)
      apiModule.api.clientId = ''

      try {
        fire('status', { exec_info: { queue_remaining: 0 } })

        expect(store.clientId).toBeNull()
        expect(removeSpy).not.toHaveBeenCalledWith(
          'status',
          expect.any(Function)
        )
      } finally {
        apiModule.api.clientId = 'test-client'
      }
    })
  })

  describe('execution_error', () => {
    it('routes a service-level error (no node_id) to the prompt error store', () => {
      const errorStore = useExecutionErrorStore()

      fire('execution_error', {
        prompt_id: 'job-1',
        node_id: null,
        exception_type: 'StagnationError',
        exception_message: 'Job has stagnated',
        traceback: ['line 1', 'line 2']
      })

      expect(errorStore.lastPromptError).toMatchObject({
        type: 'StagnationError',
        message: 'StagnationError: Job has stagnated',
        details: 'line 1\nline 2'
      })
    })

    it('uses the message directly for service-level errors without a type', () => {
      const errorStore = useExecutionErrorStore()

      fire('execution_error', {
        prompt_id: 'job-1',
        node_id: null,
        exception_message: 'Job failed before node execution',
        traceback: []
      })

      expect(errorStore.lastPromptError).toMatchObject({
        type: 'error',
        message: 'Job failed before node execution',
        details: ''
      })
    })

    it('uses an empty prompt message for service-level errors without backend copy', () => {
      const errorStore = useExecutionErrorStore()

      fire('execution_error', {
        prompt_id: 'job-1',
        node_id: null,
        exception_message: '',
        traceback: []
      })

      expect(errorStore.lastPromptError).toMatchObject({
        type: 'error',
        message: '',
        details: ''
      })
    })

    it('routes a runtime error (with node_id) to lastExecutionError', () => {
      const errorStore = useExecutionErrorStore()

      fire('execution_error', {
        prompt_id: 'job-1',
        node_id: 'n1',
        node_type: 'KSampler',
        exception_type: 'RuntimeError',
        exception_message: 'CUDA OOM',
        traceback: []
      })

      expect(errorStore.lastExecutionError).toMatchObject({
        prompt_id: 'job-1',
        node_id: 'n1',
        exception_message: 'CUDA OOM'
      })
    })

    it('keeps a subscription precondition (no node_id) out of the error panel and count', () => {
      const errorStore = useExecutionErrorStore()

      fire('execution_error', {
        prompt_id: 'job-1',
        node_id: null,
        exception_type: 'InactiveSubscriptionError',
        exception_message:
          'User has no active subscription. Please subscribe to a plan to continue.',
        traceback: []
      })

      expect(errorStore.lastExecutionError).toBeNull()
      expect(errorStore.lastPromptError).toBeNull()
      expect(errorStore.lastNodeErrors).toBeNull()
      expect(errorStore.totalErrorCount).toBe(0)
    })

    it('keeps a sign-in precondition out of the error panel and count', () => {
      const errorStore = useExecutionErrorStore()

      fire('execution_error', {
        prompt_id: 'job-1',
        node_id: 'n1',
        node_type: 'ApiNode',
        exception_type: 'RuntimeError',
        exception_message: 'Unauthorized: Please login first to use this node.',
        traceback: []
      })

      expect(errorStore.lastExecutionError).toBeNull()
      expect(errorStore.lastPromptError).toBeNull()
      expect(errorStore.totalErrorCount).toBe(0)
    })

    it('keeps a runtime credit precondition at a node out of the error panel and count', () => {
      const errorStore = useExecutionErrorStore()

      fire('execution_error', {
        prompt_id: 'job-1',
        node_id: 'n1',
        node_type: 'PartnerApiNode',
        exception_type: 'InsufficientFundsError',
        exception_message:
          'Payment Required: Please add credits to your account to use this node.',
        traceback: []
      })

      expect(errorStore.lastExecutionError).toBeNull()
      expect(errorStore.lastPromptError).toBeNull()
      expect(errorStore.totalErrorCount).toBe(0)
    })

    it('still routes an ordinary node runtime error to the error panel', () => {
      const errorStore = useExecutionErrorStore()

      fire('execution_error', {
        prompt_id: 'job-1',
        node_id: 'n1',
        node_type: 'KSampler',
        exception_type: 'RuntimeError',
        exception_message: 'Something unrelated broke',
        traceback: []
      })

      expect(errorStore.lastExecutionError).not.toBeNull()
      expect(errorStore.totalErrorCount).toBe(1)
    })
  })

  describe('notification', () => {
    it('marks a job as initializing when text indicates waiting for a machine', () => {
      fire('notification', {
        id: 'job-9',
        value: 'Waiting for a machine to become available'
      })

      expect(store.initializingJobIds.has('job-9')).toBe(true)
    })

    it('ignores notifications without an id', () => {
      fire('notification', {
        id: '',
        value: 'Waiting for a machine'
      })

      expect(store.initializingJobIds.size).toBe(0)
    })

    it('ignores notifications without the waiting-for-machine sentinel', () => {
      fire('notification', { id: 'job-9', value: 'Hello' })

      expect(store.initializingJobIds.has('job-9')).toBe(false)
    })

    it('ignores notifications without text', () => {
      fire('notification', { id: 'job-9' })

      expect(store.initializingJobIds.has('job-9')).toBe(false)
    })
  })

  describe('unbindExecutionEvents', () => {
    it('removes every listener registered by bindExecutionEvents', async () => {
      const apiModule = await import('@/scripts/api')
      const removeSpy = vi.mocked(apiModule.api.removeEventListener)
      const events = [
        'notification',
        'execution_start',
        'execution_cached',
        'execution_interrupted',
        'execution_success',
        'executed',
        'executing',
        'progress',
        'progress_state',
        'execution_error',
        'progress_text'
      ]

      store.unbindExecutionEvents()

      for (const event of events) {
        expect(removeSpy).toHaveBeenCalledWith(event, expect.any(Function))
      }
    })
  })
})

describe('useExecutionStore - storeJob and workflow path tracking', () => {
  let store: ReturnType<typeof useExecutionStore>

  beforeEach(() => {
    vi.clearAllMocks()
    apiEventHandlers.clear()
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useExecutionStore()
  })

  it('storeJob populates queuedJobs and tracks the workflow path', () => {
    const workflow = createTestWorkflow({
      activeState: { id: 'wf-1' },
      initialState: { id: 'wf-1' },
      path: '/workflows/foo.json'
    })

    store.storeJob({
      nodes: ['a', 'b'],
      id: 'job-1',
      promptOutput: {
        a: createPromptNode('Node A', 'NodeA'),
        b: createPromptNode('Node B', 'NodeB')
      },
      workflow
    })

    expect(store.queuedJobs['job-1']?.nodes).toEqual({ a: false, b: false })
    expect(store.queuedJobs['job-1']?.nodeLookup).toEqual({
      a: { title: 'Node A', type: 'NodeA' },
      b: { title: 'Node B', type: 'NodeB' }
    })
    expect(store.queuedJobs['job-1']?.workflow).toStrictEqual(workflow)
    expect(store.queuedJobs['job-1']?.shareId).toBeUndefined()
    expect(store.jobIdToWorkflowId.get('job-1')).toBe('wf-1')
    expect(store.jobIdToSessionWorkflowPath.get('job-1')).toBe(
      '/workflows/foo.json'
    )
  })

  it('storeJob works without workflow metadata', () => {
    const workflow: ComfyWorkflow | undefined = fromPartial<ComfyWorkflow>({})
    const missingWorkflow: ComfyWorkflow | undefined = undefined

    store.storeJob({
      nodes: ['a'],
      id: 'job-1',
      promptOutput: {
        a: createPromptNode('Node A', 'NodeA')
      },
      workflow
    })

    expect(store.queuedJobs['job-1']?.nodes).toEqual({ a: false })
    expect(store.jobIdToWorkflowId.has('job-1')).toBe(false)
    expect(store.jobIdToSessionWorkflowPath.has('job-1')).toBe(false)

    store.storeJob({
      nodes: ['b'],
      id: 'job-2',
      promptOutput: {
        b: createPromptNode('Node B', 'NodeB')
      },
      workflow: missingWorkflow
    })

    expect(store.queuedJobs['job-2']?.nodes).toEqual({ b: false })
    expect(store.queuedJobs['job-2']?.workflow).toBeUndefined()
  })

  it('reports zero execution progress for an active job with no nodes', () => {
    store.activeJobId = 'job-1'
    store.queuedJobs = { 'job-1': { nodes: {} } }

    expect(store.executionProgress).toBe(0)
  })

  it('registerJobWorkflowIdMapping ignores empty inputs', () => {
    store.registerJobWorkflowIdMapping('job-1', 'wf-1')
    store.registerJobWorkflowIdMapping('', 'wf-2')
    store.registerJobWorkflowIdMapping('job-2', '')

    expect(store.jobIdToWorkflowId.get('job-1')).toBe('wf-1')
    expect(store.jobIdToWorkflowId.size).toBe(1)
  })

  it('ensureSessionWorkflowPath is idempotent and updates on change', () => {
    store.ensureSessionWorkflowPath('job-1', '/a.json')
    store.ensureSessionWorkflowPath('job-1', '/a.json')
    store.ensureSessionWorkflowPath('job-1', '/b.json')

    expect(store.jobIdToSessionWorkflowPath.get('job-1')).toBe('/b.json')
  })

  it('evicts the oldest workflow paths when the session map exceeds capacity', () => {
    for (let i = 0; i < 4001; i++) {
      store.ensureSessionWorkflowPath(`job-${i}`, `/workflow-${i}.json`)
    }

    expect(store.jobIdToSessionWorkflowPath.size).toBe(4000)
    expect(store.jobIdToSessionWorkflowPath.has('job-0')).toBe(false)
    expect(store.jobIdToSessionWorkflowPath.get('job-4000')).toBe(
      '/workflow-4000.json'
    )
  })

  it('reports whether the active workflow is running', () => {
    mockActiveWorkflow.value = { path: '/workflows/foo.json' }
    store.activeJobId = 'job-1'
    store.ensureSessionWorkflowPath('job-1', '/workflows/foo.json')

    expect(store.isActiveWorkflowRunning).toBe(true)

    store.ensureSessionWorkflowPath('job-1', '/workflows/bar.json')
    expect(store.isActiveWorkflowRunning).toBe(false)

    mockActiveWorkflow.value = {}
    expect(store.isActiveWorkflowRunning).toBe(false)
  })

  it('counts running jobs from progress state', () => {
    store.nodeProgressStatesByJob = {
      'job-1': {
        a: {
          value: 1,
          max: 10,
          state: 'running',
          node_id: 'a',
          display_node_id: 'a',
          prompt_id: 'job-1'
        }
      },
      'job-2': {
        b: {
          value: 10,
          max: 10,
          state: 'finished',
          node_id: 'b',
          display_node_id: 'b',
          prompt_id: 'job-2'
        }
      }
    }

    expect(store.runningJobIds).toEqual(['job-1'])
    expect(store.runningWorkflowCount).toBe(1)
  })
})
