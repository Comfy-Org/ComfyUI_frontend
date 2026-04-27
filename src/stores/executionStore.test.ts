import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { app } from '@/scripts/app'
import { MAX_PROGRESS_JOBS, useExecutionStore } from '@/stores/executionStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import { executionIdToNodeLocatorId } from '@/utils/graphTraversalUtil'

// Create mock functions that will be shared
const {
  mockNodeExecutionIdToNodeLocatorId,
  mockNodeIdToNodeLocatorId,
  mockNodeLocatorIdToNodeExecutionId,
  mockShowTextPreview
} = vi.hoisted(() => ({
  mockNodeExecutionIdToNodeLocatorId: vi.fn(),
  mockNodeIdToNodeLocatorId: vi.fn(),
  mockNodeLocatorIdToNodeExecutionId: vi.fn(),
  mockShowTextPreview: vi.fn()
}))

import type * as WorkflowStoreModule from '@/platform/workflow/management/stores/workflowStore'
import type { NodeProgressState } from '@/schemas/apiSchema'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'
import { createTestingPinia } from '@pinia/testing'

// Reactive ref so the watcher on activeWorkflow?.path fires in tests
const mockActiveWorkflow = ref<{ path: string } | null>(null)

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

describe('useExecutionStore - isJobForActiveWorkflow', () => {
  let store: ReturnType<typeof useExecutionStore>

  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveWorkflow.value = null
    apiEventHandlers.clear()
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useExecutionStore()
    store.bindExecutionEvents()
  })

  it('should return true when promptId is null (legacy message)', () => {
    expect(store.isJobForActiveWorkflow(null)).toBe(true)
  })

  it('should return true when promptId is undefined', () => {
    expect(store.isJobForActiveWorkflow(undefined)).toBe(true)
  })

  it('should return true when job is not in the session map (unknown job)', () => {
    mockActiveWorkflow.value = { path: '/workflow-a' }
    expect(store.isJobForActiveWorkflow('unknown-job')).toBe(true)
  })

  it('should return true when no active workflow is open', () => {
    mockActiveWorkflow.value = null
    store.ensureSessionWorkflowPath('job-1', '/workflow-a')
    expect(store.isJobForActiveWorkflow('job-1')).toBe(true)
  })

  it('should return true when job path matches active workflow', () => {
    mockActiveWorkflow.value = { path: '/workflow-a' }
    store.ensureSessionWorkflowPath('job-1', '/workflow-a')
    expect(store.isJobForActiveWorkflow('job-1')).toBe(true)
  })

  it('should return false when job path differs from active workflow', () => {
    mockActiveWorkflow.value = { path: '/workflow-b' }
    store.ensureSessionWorkflowPath('job-1', '/workflow-a')
    expect(store.isJobForActiveWorkflow('job-1')).toBe(false)
  })
})

describe('useExecutionStore - WS message filtering by workflow tab', () => {
  let store: ReturnType<typeof useExecutionStore>

  function fireEvent<T>(name: string, detail: T) {
    const handler = apiEventHandlers.get(name)
    if (!handler) throw new Error(`${name} handler not bound`)
    handler(new CustomEvent(name, { detail }))
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveWorkflow.value = null
    apiEventHandlers.clear()
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useExecutionStore()
    store.bindExecutionEvents()
  })

  describe('handleExecuted filtering', () => {
    it('should update nodes when job matches active workflow', () => {
      mockActiveWorkflow.value = { path: '/workflow-a' }
      store.ensureSessionWorkflowPath('job-1', '/workflow-a')

      // Start execution to set activeJobId
      fireEvent('execution_start', {
        prompt_id: 'job-1',
        timestamp: Date.now()
      })
      expect(store.activeJobId).toBe('job-1')

      // Fire executed for a node
      fireEvent('executed', {
        node: 'node-1',
        display_node: 'node-1',
        prompt_id: 'job-1',
        output: { images: [] }
      })

      expect(store.activeJob?.nodes['node-1']).toBe(true)
    })

    it('should ignore executed events from a different workflow', () => {
      mockActiveWorkflow.value = { path: '/workflow-b' }
      store.ensureSessionWorkflowPath('job-1', '/workflow-a')

      fireEvent('execution_start', {
        prompt_id: 'job-1',
        timestamp: Date.now()
      })

      fireEvent('executed', {
        node: 'node-1',
        display_node: 'node-1',
        prompt_id: 'job-1',
        output: { images: [] }
      })

      // Node should not be marked as executed since we're on workflow-b
      expect(store.activeJob?.nodes['node-1']).not.toBe(true)
    })
  })

  describe('handleExecutionCached filtering', () => {
    it('should ignore cached events from a different workflow', () => {
      mockActiveWorkflow.value = { path: '/workflow-b' }
      store.ensureSessionWorkflowPath('job-1', '/workflow-a')

      fireEvent('execution_start', {
        prompt_id: 'job-1',
        timestamp: Date.now()
      })

      fireEvent('execution_cached', {
        prompt_id: 'job-1',
        timestamp: Date.now(),
        nodes: ['node-1', 'node-2']
      })

      expect(store.activeJob?.nodes['node-1']).not.toBe(true)
      expect(store.activeJob?.nodes['node-2']).not.toBe(true)
    })
  })

  describe('handleProgress filtering', () => {
    it('should ignore progress from a different workflow', () => {
      mockActiveWorkflow.value = { path: '/workflow-b' }
      store.ensureSessionWorkflowPath('job-1', '/workflow-a')

      fireEvent('execution_start', {
        prompt_id: 'job-1',
        timestamp: Date.now()
      })

      fireEvent('progress', {
        value: 5,
        max: 10,
        prompt_id: 'job-1',
        node: 'node-1'
      })

      expect(store._executingNodeProgress).toBeNull()
    })

    it('should update progress when job matches active workflow', () => {
      mockActiveWorkflow.value = { path: '/workflow-a' }
      store.ensureSessionWorkflowPath('job-1', '/workflow-a')

      fireEvent('execution_start', {
        prompt_id: 'job-1',
        timestamp: Date.now()
      })

      fireEvent('progress', {
        value: 5,
        max: 10,
        prompt_id: 'job-1',
        node: 'node-1'
      })

      expect(store._executingNodeProgress).toEqual({
        value: 5,
        max: 10,
        prompt_id: 'job-1',
        node: 'node-1'
      })
    })
  })

  describe('handleProgressState filtering', () => {
    it('should always update nodeProgressStatesByJob regardless of active workflow', () => {
      mockActiveWorkflow.value = { path: '/workflow-b' }
      store.ensureSessionWorkflowPath('job-1', '/workflow-a')

      const nodes = {
        'node-1': {
          value: 5,
          max: 10,
          state: 'running' as const,
          node_id: 'node-1',
          prompt_id: 'job-1',
          display_node_id: 'node-1'
        }
      }

      fireEvent('progress_state', { prompt_id: 'job-1', nodes })

      // Per-job map should always be updated
      expect(store.nodeProgressStatesByJob['job-1']).toBeDefined()
    })

    it('should NOT update nodeProgressStates when job is for a different workflow', () => {
      mockActiveWorkflow.value = { path: '/workflow-b' }
      store.ensureSessionWorkflowPath('job-1', '/workflow-a')

      const nodes = {
        'node-1': {
          value: 5,
          max: 10,
          state: 'running' as const,
          node_id: 'node-1',
          prompt_id: 'job-1',
          display_node_id: 'node-1'
        }
      }

      fireEvent('progress_state', { prompt_id: 'job-1', nodes })

      // nodeProgressStates (the "current view") should NOT be updated
      expect(Object.keys(store.nodeProgressStates)).toHaveLength(0)
    })

    it('should update nodeProgressStates when job matches active workflow', () => {
      mockActiveWorkflow.value = { path: '/workflow-a' }
      store.ensureSessionWorkflowPath('job-1', '/workflow-a')

      const nodes = {
        'node-1': {
          value: 5,
          max: 10,
          state: 'running' as const,
          node_id: 'node-1',
          prompt_id: 'job-1',
          display_node_id: 'node-1'
        }
      }

      fireEvent('progress_state', { prompt_id: 'job-1', nodes })

      expect(store.nodeProgressStates['node-1']).toBeDefined()
      expect(store.nodeProgressStates['node-1'].state).toBe('running')
    })
  })

  describe('multi-tab scenario', () => {
    it('should isolate progress between two workflows', () => {
      // Queue jobs from two different workflow tabs
      store.ensureSessionWorkflowPath('job-a', '/workflow-a')
      store.ensureSessionWorkflowPath('job-b', '/workflow-b')

      // User is viewing workflow A
      mockActiveWorkflow.value = { path: '/workflow-a' }

      // Start job-a
      fireEvent('execution_start', {
        prompt_id: 'job-a',
        timestamp: Date.now()
      })

      // Progress from job-a should show
      fireEvent('progress', {
        value: 3,
        max: 10,
        prompt_id: 'job-a',
        node: 'node-1'
      })
      expect(store._executingNodeProgress?.value).toBe(3)

      // Progress from job-b should NOT show (different workflow)
      fireEvent('progress', {
        value: 7,
        max: 10,
        prompt_id: 'job-b',
        node: 'node-1'
      })
      // Should still be 3 from job-a
      expect(store._executingNodeProgress?.value).toBe(3)
    })

    it('should show correct progress after switching tabs', () => {
      store.ensureSessionWorkflowPath('job-a', '/workflow-a')
      store.ensureSessionWorkflowPath('job-b', '/workflow-b')

      // Start job-a
      fireEvent('execution_start', {
        prompt_id: 'job-a',
        timestamp: Date.now()
      })

      // User is on workflow A — progress from job-a appears
      mockActiveWorkflow.value = { path: '/workflow-a' }
      const nodesA = {
        'node-1': {
          value: 5,
          max: 10,
          state: 'running' as const,
          node_id: 'node-1',
          prompt_id: 'job-a',
          display_node_id: 'node-1'
        }
      }
      fireEvent('progress_state', { prompt_id: 'job-a', nodes: nodesA })
      expect(store.nodeProgressStates['node-1']?.value).toBe(5)

      // Switch to workflow B — progress from job-a should no longer update nodeProgressStates
      mockActiveWorkflow.value = { path: '/workflow-b' }
      const nodesA2 = {
        'node-1': {
          value: 8,
          max: 10,
          state: 'running' as const,
          node_id: 'node-1',
          prompt_id: 'job-a',
          display_node_id: 'node-1'
        }
      }
      fireEvent('progress_state', { prompt_id: 'job-a', nodes: nodesA2 })
      // nodeProgressStates should NOT be updated (still old value from last render)
      expect(store.nodeProgressStates['node-1']?.value).toBe(5)

      // But nodeProgressStatesByJob should be updated
      expect(store.nodeProgressStatesByJob['job-a']['node-1'].value).toBe(8)
    })
  })

  describe('tab switch rehydration', () => {
    it('should rehydrate nodeProgressStates from the new workflow on tab switch', async () => {
      store.ensureSessionWorkflowPath('job-a', '/workflow-a')
      store.ensureSessionWorkflowPath('job-b', '/workflow-b')

      // Populate per-job maps with progress data
      mockActiveWorkflow.value = { path: '/workflow-a' }
      const nodesA = {
        'node-1': {
          value: 3,
          max: 10,
          state: 'running' as const,
          node_id: 'node-1',
          prompt_id: 'job-a',
          display_node_id: 'node-1'
        }
      }
      fireEvent('progress_state', { prompt_id: 'job-a', nodes: nodesA })
      expect(store.nodeProgressStates['node-1']?.value).toBe(3)

      mockActiveWorkflow.value = { path: '/workflow-b' }
      const nodesB = {
        'node-2': {
          value: 7,
          max: 10,
          state: 'running' as const,
          node_id: 'node-2',
          prompt_id: 'job-b',
          display_node_id: 'node-2'
        }
      }
      fireEvent('progress_state', { prompt_id: 'job-b', nodes: nodesB })
      expect(store.nodeProgressStates['node-2']?.value).toBe(7)

      // Switch back to workflow A — watcher should rehydrate from job-a
      mockActiveWorkflow.value = { path: '/workflow-a' }
      await vi.dynamicImportSettled()
      // Wait for watcher to fire
      await new Promise((r) => setTimeout(r, 0))

      expect(store.nodeProgressStates['node-1']?.value).toBe(3)
      expect(store.nodeProgressStates['node-2']).toBeUndefined()
    })

    it('should clear nodeProgressStates when switching to a workflow with no jobs', async () => {
      store.ensureSessionWorkflowPath('job-a', '/workflow-a')

      mockActiveWorkflow.value = { path: '/workflow-a' }
      const nodesA = {
        'node-1': {
          value: 5,
          max: 10,
          state: 'running' as const,
          node_id: 'node-1',
          prompt_id: 'job-a',
          display_node_id: 'node-1'
        }
      }
      fireEvent('progress_state', { prompt_id: 'job-a', nodes: nodesA })
      expect(store.nodeProgressStates['node-1']?.value).toBe(5)

      // Switch to a workflow with no queued jobs
      mockActiveWorkflow.value = { path: '/workflow-c' }
      await new Promise((r) => setTimeout(r, 0))

      expect(Object.keys(store.nodeProgressStates)).toHaveLength(0)
    })
  })
})
