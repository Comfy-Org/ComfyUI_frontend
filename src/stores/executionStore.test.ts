import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { app } from '@/scripts/app'
import { api } from '@/scripts/api'
import { MAX_PROGRESS_JOBS, useExecutionStore } from '@/stores/executionStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import { executionIdToNodeLocatorId } from '@/utils/graphTraversalUtil'

// Create mock functions that will be shared
const mockNodeExecutionIdToNodeLocatorId = vi.fn()
const mockNodeIdToNodeLocatorId = vi.fn()
const mockNodeLocatorIdToNodeExecutionId = vi.fn()

import type * as WorkflowStoreModule from '@/platform/workflow/management/stores/workflowStore'
import type { NodeProgressState } from '@/schemas/apiSchema'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'
import { createTestingPinia } from '@pinia/testing'

vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    clientId: null,
    apiURL: vi.fn((path: string) => path)
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
      nodeLocatorIdToNodeExecutionId: mockNodeLocatorIdToNodeExecutionId
    }))
  }
})

// Remove any previous global types
declare global {
  interface Window {}
}

vi.mock('@/composables/node/useNodeProgressText', () => ({
  useNodeProgressText: () => ({
    showTextPreview: vi.fn()
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
    // Flush the RAF so the batched update is applied immediately
    vi.advanceTimersByTime(16)
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    apiEventHandlers.clear()
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useExecutionStore()
    store.bindExecutionEvents()
  })

  afterEach(() => {
    vi.useRealTimers()
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

describe('useExecutionStore - RAF batching', () => {
  let store: ReturnType<typeof useExecutionStore>

  function getRegisteredHandler(eventName: string) {
    const calls = vi.mocked(api.addEventListener).mock.calls
    const call = calls.find(([name]) => name === eventName)
    return call?.[1] as (e: CustomEvent) => void
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useExecutionStore()
    store.bindExecutionEvents()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('handleProgress', () => {
    function makeProgressEvent(
      value: number,
      max: number
    ): CustomEvent {
      return new CustomEvent('progress', {
        detail: { value, max, prompt_id: 'job-1', node: '1' }
      })
    }

    it('batches multiple progress events into one reactive update per frame', () => {
      const handler = getRegisteredHandler('progress')

      handler(makeProgressEvent(1, 10))
      handler(makeProgressEvent(5, 10))
      handler(makeProgressEvent(9, 10))

      expect(store._executingNodeProgress).toBeNull()

      vi.advanceTimersByTime(16)

      expect(store._executingNodeProgress).toEqual({
        value: 9,
        max: 10,
        prompt_id: 'job-1',
        node: '1'
      })
    })

    it('does not update reactive state before RAF fires', () => {
      const handler = getRegisteredHandler('progress')

      handler(makeProgressEvent(3, 10))

      expect(store._executingNodeProgress).toBeNull()
    })

    it('allows a new batch after the previous RAF fires', () => {
      const handler = getRegisteredHandler('progress')

      handler(makeProgressEvent(1, 10))
      vi.advanceTimersByTime(16)

      expect(store._executingNodeProgress).toEqual(
        expect.objectContaining({ value: 1 })
      )

      handler(makeProgressEvent(7, 10))
      vi.advanceTimersByTime(16)

      expect(store._executingNodeProgress).toEqual(
        expect.objectContaining({ value: 7 })
      )
    })
  })

  describe('handleProgressState', () => {
    function makeProgressStateEvent(
      nodeId: string,
      state: string,
      value = 0,
      max = 10
    ): CustomEvent {
      return new CustomEvent('progress_state', {
        detail: {
          prompt_id: 'job-1',
          nodes: {
            [nodeId]: {
              value,
              max,
              state,
              node_id: nodeId,
              prompt_id: 'job-1',
              display_node_id: nodeId
            }
          }
        }
      })
    }

    it('batches multiple progress_state events into one reactive update per frame', () => {
      const handler = getRegisteredHandler('progress_state')

      handler(makeProgressStateEvent('1', 'running', 1))
      handler(makeProgressStateEvent('1', 'running', 5))
      handler(makeProgressStateEvent('1', 'running', 9))

      expect(Object.keys(store.nodeProgressStates)).toHaveLength(0)

      vi.advanceTimersByTime(16)

      expect(store.nodeProgressStates['1']).toEqual(
        expect.objectContaining({ value: 9, state: 'running' })
      )
    })

    it('does not update reactive state before RAF fires', () => {
      const handler = getRegisteredHandler('progress_state')

      handler(makeProgressStateEvent('1', 'running'))

      expect(Object.keys(store.nodeProgressStates)).toHaveLength(0)
    })
  })

  describe('pending RAF is discarded when execution completes', () => {
    it('discards pending progress RAF on execution_success', () => {
      const progressHandler = getRegisteredHandler('progress')
      const startHandler = getRegisteredHandler('execution_start')
      const successHandler = getRegisteredHandler('execution_success')

      startHandler(
        new CustomEvent('execution_start', {
          detail: { prompt_id: 'job-1', timestamp: 0 }
        })
      )

      progressHandler(
        new CustomEvent('progress', {
          detail: { value: 5, max: 10, prompt_id: 'job-1', node: '1' }
        })
      )

      successHandler(
        new CustomEvent('execution_success', {
          detail: { prompt_id: 'job-1', timestamp: 0 }
        })
      )

      vi.advanceTimersByTime(16)

      expect(store._executingNodeProgress).toBeNull()
    })

    it('discards pending progress_state RAF on execution_success', () => {
      const progressStateHandler = getRegisteredHandler('progress_state')
      const startHandler = getRegisteredHandler('execution_start')
      const successHandler = getRegisteredHandler('execution_success')

      startHandler(
        new CustomEvent('execution_start', {
          detail: { prompt_id: 'job-1', timestamp: 0 }
        })
      )

      progressStateHandler(
        new CustomEvent('progress_state', {
          detail: {
            prompt_id: 'job-1',
            nodes: {
              '1': {
                value: 5,
                max: 10,
                state: 'running',
                node_id: '1',
                prompt_id: 'job-1',
                display_node_id: '1'
              }
            }
          }
        })
      )

      successHandler(
        new CustomEvent('execution_success', {
          detail: { prompt_id: 'job-1', timestamp: 0 }
        })
      )

      vi.advanceTimersByTime(16)

      expect(Object.keys(store.nodeProgressStates)).toHaveLength(0)
    })

    it('discards pending progress RAF on execution_error', () => {
      const progressHandler = getRegisteredHandler('progress')
      const startHandler = getRegisteredHandler('execution_start')
      const errorHandler = getRegisteredHandler('execution_error')

      startHandler(
        new CustomEvent('execution_start', {
          detail: { prompt_id: 'job-1', timestamp: 0 }
        })
      )

      progressHandler(
        new CustomEvent('progress', {
          detail: { value: 5, max: 10, prompt_id: 'job-1', node: '1' }
        })
      )

      errorHandler(
        new CustomEvent('execution_error', {
          detail: {
            prompt_id: 'job-1',
            node_id: '1',
            node_type: 'TestNode',
            exception_message: 'error',
            exception_type: 'RuntimeError',
            traceback: []
          }
        })
      )

      vi.advanceTimersByTime(16)

      expect(store._executingNodeProgress).toBeNull()
    })

    it('discards pending progress RAF on execution_interrupted', () => {
      const progressHandler = getRegisteredHandler('progress')
      const startHandler = getRegisteredHandler('execution_start')
      const interruptedHandler = getRegisteredHandler('execution_interrupted')

      startHandler(
        new CustomEvent('execution_start', {
          detail: { prompt_id: 'job-1', timestamp: 0 }
        })
      )

      progressHandler(
        new CustomEvent('progress', {
          detail: { value: 5, max: 10, prompt_id: 'job-1', node: '1' }
        })
      )

      interruptedHandler(
        new CustomEvent('execution_interrupted', {
          detail: {
            prompt_id: 'job-1',
            node_id: '1',
            node_type: 'TestNode',
            executed: []
          }
        })
      )

      vi.advanceTimersByTime(16)

      expect(store._executingNodeProgress).toBeNull()
    })
  })

  describe('unbindExecutionEvents cancels pending RAFs', () => {
    it('cancels pending progress RAF on unbind', () => {
      const handler = getRegisteredHandler('progress')

      handler(
        new CustomEvent('progress', {
          detail: { value: 5, max: 10, prompt_id: 'job-1', node: '1' }
        })
      )

      store.unbindExecutionEvents()
      vi.advanceTimersByTime(16)

      expect(store._executingNodeProgress).toBeNull()
    })

    it('cancels pending progress_state RAF on unbind', () => {
      const handler = getRegisteredHandler('progress_state')

      handler(
        new CustomEvent('progress_state', {
          detail: {
            prompt_id: 'job-1',
            nodes: {
              '1': {
                value: 0,
                max: 10,
                state: 'running',
                node_id: '1',
                prompt_id: 'job-1',
                display_node_id: '1'
              }
            }
          }
        })
      )

      store.unbindExecutionEvents()
      vi.advanceTimersByTime(16)

      expect(Object.keys(store.nodeProgressStates)).toHaveLength(0)
    })
  })
})
