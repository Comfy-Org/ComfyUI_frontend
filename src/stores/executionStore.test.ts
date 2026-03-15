import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { app } from '@/scripts/app'
import { MAX_PROGRESS_JOBS, useExecutionStore } from '@/stores/executionStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { executionIdToNodeLocatorId } from '@/utils/graphTraversalUtil'

// Create mock functions that will be shared
const mockNodeExecutionIdToNodeLocatorId = vi.fn()
const mockNodeIdToNodeLocatorId = vi.fn()
const mockNodeLocatorIdToNodeExecutionId = vi.fn()

import type * as WorkflowStoreModule from '@/platform/workflow/management/stores/workflowStore'
import type { NodeProgressState } from '@/schemas/apiSchema'
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
    apiURL: vi.fn((path: string) => `/api${path}`),
    getServerFeature: vi.fn()
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

describe('useExecutionStore - focusedJobId management', () => {
  let store: ReturnType<typeof useExecutionStore>

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useExecutionStore()
  })

  it('should initialize focusedJobId as null', () => {
    expect(store.focusedJobId).toBeNull()
  })

  it('should set focusedJobId and update nodeProgressStates via setFocusedJob', () => {
    store.nodeProgressStatesByJob = {
      'job-1': {
        'node-1': {
          value: 50,
          max: 100,
          state: 'running',
          node_id: 'node-1',
          prompt_id: 'job-1'
        }
      },
      'job-2': {
        'node-2': {
          value: 30,
          max: 100,
          state: 'running',
          node_id: 'node-2',
          prompt_id: 'job-2'
        }
      }
    }

    store.setFocusedJob('job-1')
    expect(store.focusedJobId).toBe('job-1')
    expect(store.nodeProgressStates).toEqual({
      'node-1': {
        value: 50,
        max: 100,
        state: 'running',
        node_id: 'node-1',
        prompt_id: 'job-1'
      }
    })

    store.setFocusedJob('job-2')
    expect(store.focusedJobId).toBe('job-2')
    expect(store.nodeProgressStates).toEqual({
      'node-2': {
        value: 30,
        max: 100,
        state: 'running',
        node_id: 'node-2',
        prompt_id: 'job-2'
      }
    })
  })

  it('should clear nodeProgressStates when setFocusedJob is called with null', () => {
    store.nodeProgressStatesByJob = {
      'job-1': {
        'node-1': {
          value: 50,
          max: 100,
          state: 'running',
          node_id: 'node-1',
          prompt_id: 'job-1'
        }
      }
    }
    store.setFocusedJob('job-1')
    expect(store.nodeProgressStates).not.toEqual({})

    store.setFocusedJob(null)
    expect(store.focusedJobId).toBeNull()
    expect(store.nodeProgressStates).toEqual({})
  })

  it('should return undefined for focusedJob when no job is focused', () => {
    expect(store.focusedJob).toBeUndefined()
  })

  it('should return the focused QueuedJob from focusedJob computed', () => {
    store.queuedJobs = {
      'job-1': { nodes: { n1: false, n2: true } }
    }
    store.setFocusedJob('job-1')
    expect(store.focusedJob).toEqual({ nodes: { n1: false, n2: true } })
  })
})

describe('useExecutionStore - isConcurrentExecutionActive', () => {
  let store: ReturnType<typeof useExecutionStore>

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useExecutionStore()
  })

  it('should be false when no jobs are running', () => {
    expect(store.isConcurrentExecutionActive).toBe(false)
  })

  it('should be false when only one job is running', () => {
    store.nodeProgressStatesByJob = {
      'job-1': {
        'node-1': {
          value: 50,
          max: 100,
          state: 'running',
          node_id: 'node-1',
          prompt_id: 'job-1'
        }
      }
    }
    expect(store.isConcurrentExecutionActive).toBe(false)
  })

  it('should be true when multiple jobs are running', () => {
    store.nodeProgressStatesByJob = {
      'job-1': {
        'node-1': {
          value: 50,
          max: 100,
          state: 'running',
          node_id: 'node-1',
          prompt_id: 'job-1'
        }
      },
      'job-2': {
        'node-2': {
          value: 30,
          max: 100,
          state: 'running',
          node_id: 'node-2',
          prompt_id: 'job-2'
        }
      }
    }
    expect(store.isConcurrentExecutionActive).toBe(true)
  })
})

describe('useExecutionStore - isIdle with multi-job', () => {
  let store: ReturnType<typeof useExecutionStore>

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useExecutionStore()
  })

  it('should be true when no jobs are running', () => {
    expect(store.isIdle).toBe(true)
  })

  it('should be false when at least one job is running', () => {
    store.nodeProgressStatesByJob = {
      'job-1': {
        'node-1': {
          value: 0,
          max: 100,
          state: 'running',
          node_id: 'node-1',
          prompt_id: 'job-1'
        }
      }
    }
    expect(store.isIdle).toBe(false)
  })

  it('should be true when all jobs are finished (not running)', () => {
    store.nodeProgressStatesByJob = {
      'job-1': {
        'node-1': {
          value: 100,
          max: 100,
          state: 'finished',
          node_id: 'node-1',
          prompt_id: 'job-1'
        }
      }
    }
    expect(store.isIdle).toBe(true)
  })
})

describe('useExecutionStore - resetExecutionState auto-advance', () => {
  let store: ReturnType<typeof useExecutionStore>

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useExecutionStore()
  })

  it('should set focusedJobId to null when last running job finishes', () => {
    store.nodeProgressStatesByJob = {
      'job-1': {
        'node-1': {
          value: 50,
          max: 100,
          state: 'running',
          node_id: 'node-1',
          prompt_id: 'job-1'
        }
      }
    }
    store.activeJobId = 'job-1'
    store.setFocusedJob('job-1')

    // When the last job finishes, nodeProgressStatesByJob will be empty
    // and focusedJobId should become null
    store.nodeProgressStatesByJob = {}
    store.setFocusedJob(null)
    expect(store.focusedJobId).toBeNull()
    expect(store.nodeProgressStates).toEqual({})
  })

  it('should not change focusedJobId when a non-focused job finishes', () => {
    store.nodeProgressStatesByJob = {
      'job-1': {
        'node-1': {
          value: 50,
          max: 100,
          state: 'running',
          node_id: 'node-1',
          prompt_id: 'job-1'
        }
      },
      'job-2': {
        'node-2': {
          value: 30,
          max: 100,
          state: 'running',
          node_id: 'node-2',
          prompt_id: 'job-2'
        }
      }
    }
    store.setFocusedJob('job-1')

    // job-2 finishes — focusedJobId should stay on job-1
    const updated = { ...store.nodeProgressStatesByJob }
    delete updated['job-2']
    store.nodeProgressStatesByJob = updated

    // Focus should still be on job-1
    expect(store.focusedJobId).toBe('job-1')
    expect(store.nodeProgressStates).toEqual({
      'node-1': {
        value: 50,
        max: 100,
        state: 'running',
        node_id: 'node-1',
        prompt_id: 'job-1'
      }
    })
  })
})

describe('useExecutionStore - executionProgress from focusedJob', () => {
  let store: ReturnType<typeof useExecutionStore>

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useExecutionStore()
  })

  it('should compute executionProgress from focused job nodes', () => {
    store.queuedJobs = {
      'job-1': { nodes: { n1: true, n2: false, n3: false } },
      'job-2': { nodes: { n4: true, n5: true } }
    }
    store.setFocusedJob('job-1')
    // 1 out of 3 done
    expect(store.executionProgress).toBeCloseTo(1 / 3)

    store.setFocusedJob('job-2')
    // 2 out of 2 done
    expect(store.executionProgress).toBe(1)
  })

  it('should return 0 when no job is focused', () => {
    expect(store.executionProgress).toBe(0)
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

describe('useExecutionErrorStore - setMissingNodeTypes', () => {
  let store: ReturnType<typeof useExecutionErrorStore>

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useExecutionErrorStore()
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
