import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  mockShowTextPreview,
  mockActiveWorkflow
} = vi.hoisted(() => ({
  mockNodeExecutionIdToNodeLocatorId: vi.fn(),
  mockNodeIdToNodeLocatorId: vi.fn(),
  mockNodeLocatorIdToNodeExecutionId: vi.fn(),
  mockShowTextPreview: vi.fn(),
  mockActiveWorkflow: {
    current: null as null | {
      activeState?: { id?: string }
      initialState?: { id?: string }
      path?: string
    }
  }
}))

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
        return mockActiveWorkflow.current
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

describe('useExecutionStore - active workflow gating of progress mirror', () => {
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
    nodes: Record<string, NodeProgressState>,
    workflowId?: string
  ) {
    const handler = apiEventHandlers.get('progress_state')
    if (!handler) throw new Error('progress_state handler not bound')
    handler(
      new CustomEvent('progress_state', {
        detail: { nodes, prompt_id: jobId, workflow_id: workflowId }
      })
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    apiEventHandlers.clear()
    mockActiveWorkflow.current = null
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useExecutionStore()
    store.bindExecutionEvents()
  })

  it('updates per-job progress regardless of active workflow', () => {
    mockActiveWorkflow.current = {
      activeState: { id: 'wf-active' },
      path: '/wf-active.json'
    }

    fireProgressState(
      'job-other',
      makeProgressNodes('1', 'job-other'),
      'wf-other'
    )

    expect(store.nodeProgressStatesByJob).toHaveProperty('job-other')
  })

  it('skips global mirror when message workflow_id mismatches active workflow', () => {
    mockActiveWorkflow.current = {
      activeState: { id: 'wf-active' },
      path: '/wf-active.json'
    }

    fireProgressState(
      'job-other',
      makeProgressNodes('1', 'job-other'),
      'wf-other'
    )

    expect(store.nodeProgressStates).toEqual({})
  })

  it('updates global mirror when message workflow_id matches active workflow', () => {
    mockActiveWorkflow.current = {
      activeState: { id: 'wf-active' },
      path: '/wf-active.json'
    }

    fireProgressState('job-1', makeProgressNodes('1', 'job-1'), 'wf-active')

    expect(store.nodeProgressStates).toEqual(makeProgressNodes('1', 'job-1'))
  })

  it('falls back to jobIdToWorkflowId mapping when message has no workflow_id', () => {
    mockActiveWorkflow.current = {
      activeState: { id: 'wf-active' },
      path: '/wf-active.json'
    }
    store.registerJobWorkflowIdMapping('job-other', 'wf-other')

    fireProgressState('job-other', makeProgressNodes('1', 'job-other'))

    expect(store.nodeProgressStates).toEqual({})
  })

  it('falls back to session path mapping when message has no workflow_id and no id mapping', () => {
    mockActiveWorkflow.current = {
      activeState: { id: 'wf-active' },
      path: '/wf-active.json'
    }
    store.ensureSessionWorkflowPath('job-other', '/wf-other.json')

    fireProgressState('job-other', makeProgressNodes('1', 'job-other'))

    expect(store.nodeProgressStates).toEqual({})
  })

  it('updates mirror when no resolution is available (preserves single-tab behaviour)', () => {
    mockActiveWorkflow.current = {
      activeState: { id: 'wf-active' },
      path: '/wf-active.json'
    }

    fireProgressState('job-unknown', makeProgressNodes('1', 'job-unknown'))

    expect(store.nodeProgressStates).toEqual(
      makeProgressNodes('1', 'job-unknown')
    )
  })

  it('updates mirror when there is no active workflow', () => {
    mockActiveWorkflow.current = null

    fireProgressState('job-1', makeProgressNodes('1', 'job-1'), 'wf-1')

    expect(store.nodeProgressStates).toEqual(makeProgressNodes('1', 'job-1'))
  })
})

describe('useExecutionStore - reconcileTerminalJobs', () => {
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

  function fireExecutionStart(jobId: string) {
    const handler = apiEventHandlers.get('execution_start')
    if (!handler) throw new Error('execution_start handler not bound')
    handler(
      new CustomEvent('execution_start', { detail: { prompt_id: jobId } })
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    apiEventHandlers.clear()
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useExecutionStore()
    store.bindExecutionEvents()
  })

  it('evicts a non-active terminal job without disturbing the active job', () => {
    fireExecutionStart('job-old')
    fireProgressState('job-old', makeProgressNodes('1', 'job-old'))

    fireExecutionStart('job-new')
    fireProgressState('job-new', makeProgressNodes('2', 'job-new'))

    expect(store.activeJobId).toBe('job-new')
    expect(store.nodeProgressStatesByJob).toHaveProperty('job-old')
    expect(store.nodeProgressStatesByJob).toHaveProperty('job-new')

    store.reconcileTerminalJobs(new Set(['job-new']), new Set(['job-old']))

    expect(store.nodeProgressStatesByJob).not.toHaveProperty('job-old')
    expect(store.nodeProgressStatesByJob).toHaveProperty('job-new')
    expect(store.activeJobId).toBe('job-new')
    expect(store.nodeProgressStates).toEqual(makeProgressNodes('2', 'job-new'))
  })

  it('evicts an active terminal job and clears global mirror', () => {
    fireExecutionStart('job-1')
    fireProgressState('job-1', makeProgressNodes('1', 'job-1'))

    expect(store.activeJobId).toBe('job-1')
    expect(Object.keys(store.nodeProgressStates)).toHaveLength(1)

    store.reconcileTerminalJobs(new Set(), new Set(['job-1']))

    expect(store.nodeProgressStatesByJob).not.toHaveProperty('job-1')
    expect(store.activeJobId).toBeNull()
    expect(store.nodeProgressStates).toEqual({})
  })

  it('clears stale global mirror when its owner job becomes terminal', () => {
    fireExecutionStart('job-old')
    fireProgressState('job-old', makeProgressNodes('1', 'job-old'))

    fireExecutionStart('job-new')
    expect(store.activeJobId).toBe('job-new')
    expect(store.nodeProgressStates['1']?.prompt_id).toBe('job-old')

    store.reconcileTerminalJobs(new Set(['job-new']), new Set(['job-old']))

    expect(store.nodeProgressStates).toEqual({})
    expect(store.activeJobId).toBe('job-new')
    expect(store.nodeProgressStatesByJob).not.toHaveProperty('job-old')
  })

  it('skips jobs that are still active even if also in terminal set', () => {
    fireExecutionStart('job-1')
    fireProgressState('job-1', makeProgressNodes('1', 'job-1'))

    store.reconcileTerminalJobs(new Set(['job-1']), new Set(['job-1']))

    expect(store.nodeProgressStatesByJob).toHaveProperty('job-1')
    expect(store.activeJobId).toBe('job-1')
  })

  it('skips jobs absent from the terminal set', () => {
    fireExecutionStart('job-1')
    fireProgressState('job-1', makeProgressNodes('1', 'job-1'))

    store.reconcileTerminalJobs(new Set(), new Set())

    expect(store.nodeProgressStatesByJob).toHaveProperty('job-1')
    expect(store.activeJobId).toBe('job-1')
  })

  it('is idempotent for an already-cleared job', () => {
    store.reconcileTerminalJobs(new Set(), new Set(['job-1']))
    store.reconcileTerminalJobs(new Set(), new Set(['job-1']))

    expect(store.nodeProgressStatesByJob).not.toHaveProperty('job-1')
    expect(store.activeJobId).toBeNull()
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

    it('clears initializing state for the starting job', () => {
      store.initializingJobIds = new Set([
        'job-1',
        'job-2'
      ]) as unknown as Set<string>
      fire('execution_start', { prompt_id: 'job-1', timestamp: 0 })

      expect(store.initializingJobIds.has('job-1')).toBe(false)
      expect(store.initializingJobIds.has('job-2')).toBe(true)
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
  })

  describe('executing', () => {
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
    const workflow = {
      activeState: { id: 'wf-1' },
      initialState: { id: 'wf-1' },
      path: '/workflows/foo.json'
    } as unknown as Parameters<typeof store.storeJob>[0]['workflow']

    store.storeJob({ nodes: ['a', 'b'], id: 'job-1', workflow })

    expect(store.queuedJobs['job-1']?.nodes).toEqual({ a: false, b: false })
    expect(store.queuedJobs['job-1']?.workflow).toStrictEqual(workflow)
    expect(store.jobIdToWorkflowId.get('job-1')).toBe('wf-1')
    expect(store.jobIdToSessionWorkflowPath.get('job-1')).toBe(
      '/workflows/foo.json'
    )
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
})
