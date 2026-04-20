import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { app } from '@/scripts/app'
import { MAX_PROGRESS_JOBS, useExecutionStore } from '@/stores/executionStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import { executionIdToNodeLocatorId } from '@/utils/graphTraversalUtil'

const {
  mockNodeExecutionIdToNodeLocatorId,
  mockNodeIdToNodeLocatorId,
  mockNodeLocatorIdToNodeExecutionId,
  mockActiveWorkflow,
  mockOpenWorkflows,
  mockShowTextPreview
} = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return {
    mockNodeExecutionIdToNodeLocatorId: vi.fn(),
    mockNodeIdToNodeLocatorId: vi.fn(),
    mockNodeLocatorIdToNodeExecutionId: vi.fn(),
    mockActiveWorkflow: ref<{ path?: string } | null>(null),
    mockOpenWorkflows: ref<{ path: string }[]>([]),
    mockShowTextPreview: vi.fn()
  }
})

import type * as WorkflowStoreModule from '@/platform/workflow/management/stores/workflowStore'
import type { NodeProgressState } from '@/schemas/apiSchema'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'
import { createTestingPinia } from '@pinia/testing'

// Mock the workflowStore
vi.mock('@/platform/workflow/management/stores/workflowStore', async () => {
  const { ComfyWorkflow } = await vi.importActual<typeof WorkflowStoreModule>(
    '@/platform/workflow/management/stores/workflowStore'
  )
  return {
    ComfyWorkflow,
    useWorkflowStore: vi.fn(() => ({
      nodeExecutionIdToNodeLocatorId: mockNodeExecutionIdToNodeLocatorId,
      nodeIdToNodeLocatorId: mockNodeIdToNodeLocatorId,
      nodeLocatorIdToNodeExecutionId: mockNodeLocatorIdToNodeExecutionId,
      get activeWorkflow() {
        return mockActiveWorkflow.value
      },
      get openWorkflows() {
        return mockOpenWorkflows.value
      }
    }))
  }
})

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

vi.mock('@/stores/imagePreviewStore', () => ({
  useNodeOutputStore: () => ({
    revokePreviewsByExecutionId: vi.fn()
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

describe('useExecutionStore - NodeLocatorId conversions', () => {
  let store: ReturnType<typeof useExecutionStore>

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset mock implementations
    mockNodeExecutionIdToNodeLocatorId.mockReset()
    mockNodeIdToNodeLocatorId.mockReset()
    mockNodeLocatorIdToNodeExecutionId.mockReset()

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
      const mockExecutionId = '123:456'
      mockNodeLocatorIdToNodeExecutionId.mockReturnValue(mockExecutionId)

      const result = store.nodeLocatorIdToExecutionId(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890:456'
      )

      expect(mockNodeLocatorIdToNodeExecutionId).toHaveBeenCalledWith(
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890:456'
      )
      expect(result).toBe(mockExecutionId)
    })

    it('should return null when conversion fails', () => {
      mockNodeLocatorIdToNodeExecutionId.mockReturnValue(null)

      const result = store.nodeLocatorIdToExecutionId('invalid:format')

      expect(result).toBeNull()
    })
  })
})

describe('useExecutionStore - nodeLocationProgressStates caching', () => {
  let store: ReturnType<typeof useExecutionStore>

  beforeEach(() => {
    vi.clearAllMocks()
    mockNodeExecutionIdToNodeLocatorId.mockReset()
    mockNodeIdToNodeLocatorId.mockReset()
    mockNodeLocatorIdToNodeExecutionId.mockReset()

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

    expect(result['123']).toBeDefined()
    expect(result['a1b2c3d4-e5f6-7890-abcd-ef1234567890:456']).toBeDefined()
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
    expect(store.nodeLocationProgressStates['123']).toBeDefined()
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

    expect(store.nodeLocationProgressStates['123']).toBeDefined()

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
    expect(result['a1b2c3d4-e5f6-7890-abcd-ef1234567890:456']).toBeDefined()
    expect(result['a1b2c3d4-e5f6-7890-abcd-ef1234567890:789']).toBeDefined()

    // The shared parent "123" should also have a merged state
    expect(result['123']).toBeDefined()
    expect(result['123'].state).toBe('running')
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
})

describe('useExecutionStore - workflowStatus', () => {
  let store: ReturnType<typeof useExecutionStore>

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

  function callStoreJob(jobId: string, workflowPath: string) {
    store.storeJob({
      nodes: ['1'],
      id: jobId,
      workflow: { path: workflowPath } as Parameters<
        typeof store.storeJob
      >[0]['workflow']
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    apiEventHandlers.clear()
    mockActiveWorkflow.value = null
    mockOpenWorkflows.value = []
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useExecutionStore()
    store.bindExecutionEvents()
  })

  it('sets running on execution_start when path mapping exists', () => {
    callStoreJob('job-1', '/workflows/a.json')
    fireExecutionStart('job-1')

    expect(store.workflowStatus.get('/workflows/a.json')).toBe('running')
  })

  it('sets running via ensureSessionWorkflowPath when WS fires before HTTP', () => {
    // WS fires first — no path mapping yet, setWorkflowStatus no-ops
    fireExecutionStart('job-1')
    expect(store.workflowStatus.get('/workflows/a.json')).toBeUndefined()

    // HTTP response arrives — ensureSessionWorkflowPath sees activeJobId match
    callStoreJob('job-1', '/workflows/a.json')
    expect(store.workflowStatus.get('/workflows/a.json')).toBe('running')
  })

  it('does not set running when job already completed before HTTP arrives', () => {
    // WS: start and success both fire before HTTP response
    fireExecutionStart('job-1')
    fireExecutionSuccess('job-1')

    // HTTP arrives late — job is no longer active
    callStoreJob('job-1', '/workflows/a.json')
    expect(store.workflowStatus.get('/workflows/a.json')).toBeUndefined()
  })

  it('does not set running when job was interrupted before HTTP arrives', () => {
    fireExecutionStart('job-1')
    fireExecutionInterrupted('job-1')

    callStoreJob('job-1', '/workflows/a.json')
    expect(store.workflowStatus.get('/workflows/a.json')).toBeUndefined()
  })

  it('sets completed on execution_success', () => {
    callStoreJob('job-1', '/workflows/a.json')
    fireExecutionStart('job-1')
    fireExecutionSuccess('job-1')

    expect(store.workflowStatus.get('/workflows/a.json')).toBe('completed')
  })

  it('sets failed on execution_error', () => {
    callStoreJob('job-1', '/workflows/a.json')
    fireExecutionStart('job-1')
    fireExecutionError('job-1')

    expect(store.workflowStatus.get('/workflows/a.json')).toBe('failed')
  })

  it('sets failed on execution_interrupted', () => {
    callStoreJob('job-1', '/workflows/a.json')
    fireExecutionStart('job-1')
    fireExecutionInterrupted('job-1')

    expect(store.workflowStatus.get('/workflows/a.json')).toBe('failed')
  })

  it('ignores status events for unknown prompt ids', () => {
    fireExecutionSuccess('unknown-job')
    expect(store.workflowStatus.size).toBe(0)
  })

  it('clears only the active workflow status, leaving others intact', async () => {
    callStoreJob('job-a', '/workflows/a.json')
    callStoreJob('job-b', '/workflows/b.json')
    fireExecutionStart('job-a')
    fireExecutionSuccess('job-a')
    fireExecutionStart('job-b')
    fireExecutionSuccess('job-b')

    mockActiveWorkflow.value = { path: '/workflows/a.json' }
    await nextTick()

    expect(store.workflowStatus.has('/workflows/a.json')).toBe(false)
    expect(store.workflowStatus.get('/workflows/b.json')).toBe('completed')
  })

  it('prunes only closed workflows, leaving open ones intact', async () => {
    callStoreJob('job-a', '/workflows/a.json')
    callStoreJob('job-b', '/workflows/b.json')
    fireExecutionSuccess('job-a')
    fireExecutionSuccess('job-b')

    mockOpenWorkflows.value = [{ path: '/workflows/b.json' }]
    await nextTick()

    expect(store.workflowStatus.has('/workflows/a.json')).toBe(false)
    expect(store.workflowStatus.get('/workflows/b.json')).toBe('completed')
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
        nodeId: '1',
        text: 'warming up'
      })
    ).not.toThrow()

    expect(mockShowTextPreview).not.toHaveBeenCalled()
  })

  it('should call showTextPreview when canvas is available', async () => {
    const mockNode = createMockLGraphNode({ id: 1 })
    const { useCanvasStore } =
      await import('@/renderer/core/canvas/canvasStore')
    useCanvasStore().canvas = {
      graph: { getNodeById: vi.fn(() => mockNode) }
    } as unknown as LGraphCanvas

    fireProgressText({ nodeId: '1', text: 'warming up' })

    expect(mockShowTextPreview).toHaveBeenCalledWith(mockNode, 'warming up')
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
      const result = store.getNodeErrors('123')
      expect(result).toBeUndefined()
    })

    it('should return node error by locator ID for root graph node', () => {
      store.lastNodeErrors = {
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
      }

      const result = store.getNodeErrors('123')
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

      store.lastNodeErrors = {
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
      }

      const locatorId = `${subgraphUuid}:456`
      const result = store.getNodeErrors(locatorId)
      expect(result).toBeDefined()
      expect(result?.errors[0].message).toBe('Invalid subgraph input')
    })
  })

  describe('slotHasError', () => {
    it('should return false when node has no errors', () => {
      const result = store.slotHasError('123', 'width')
      expect(result).toBe(false)
    })

    it('should return false when node has errors but slot is not mentioned', () => {
      store.lastNodeErrors = {
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
      }

      const result = store.slotHasError('123', 'height')
      expect(result).toBe(false)
    })

    it('should return true when slot has error', () => {
      store.lastNodeErrors = {
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
      }

      const result = store.slotHasError('123', 'width')
      expect(result).toBe(true)
    })

    it('should return true when multiple errors exist for the same slot', () => {
      store.lastNodeErrors = {
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
      }

      const result = store.slotHasError('123', 'width')
      expect(result).toBe(true)
    })

    it('should handle errors without extra_info', () => {
      store.lastNodeErrors = {
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
      }

      const result = store.slotHasError('123', 'width')
      expect(result).toBe(false)
    })
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
      { type: 'NodeA', nodeId: 1 },
      { type: 'NodeA', nodeId: 1 }
    ])
    expect(store.missingNodesError?.nodeTypes).toHaveLength(1)
  })

  it('keeps object entries with different nodeIds even if same type', () => {
    store.setMissingNodeTypes([
      { type: 'NodeA', nodeId: 1 },
      { type: 'NodeA', nodeId: 2 }
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
      { type: 'NodeA', nodeId: 1 },
      { type: 'NodeA', nodeId: 1 }, // object dup by nodeId
      { type: 'NodeA', nodeId: 2 }, // same type, different nodeId → kept
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
