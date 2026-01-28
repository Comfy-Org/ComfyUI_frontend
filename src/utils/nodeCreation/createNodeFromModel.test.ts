// oxlint-disable no-misused-spread
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type * as LitegraphModule from '@/lib/litegraph/src/litegraph'
import type * as ModelToNodeStoreModule from '@/stores/modelToNodeStore'
import type * as WorkflowStoreModule from '@/platform/workflow/management/stores/workflowStore'
import type * as LitegraphServiceModule from '@/services/litegraphService'
import { createNodeFromModel } from '@/utils/nodeCreation/createNodeFromModel'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { useLitegraphService } from '@/services/litegraphService'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'

// Mock dependencies
vi.mock('@/stores/modelToNodeStore', async (importOriginal) => {
  const actual = await importOriginal<typeof ModelToNodeStoreModule>()
  return {
    ...actual,
    useModelToNodeStore: vi.fn()
  }
})
vi.mock(
  '@/platform/workflow/management/stores/workflowStore',
  async (importOriginal) => {
    const actual = await importOriginal<typeof WorkflowStoreModule>()
    return {
      ...actual,
      useWorkflowStore: vi.fn()
    }
  }
)
vi.mock('@/services/litegraphService', async (importOriginal) => {
  const actual = await importOriginal<typeof LitegraphServiceModule>()
  return {
    ...actual,
    useLitegraphService: vi.fn()
  }
})
vi.mock('@/lib/litegraph/src/litegraph', async (importOriginal) => {
  const actual = await importOriginal<typeof LitegraphModule>()
  return {
    ...actual,
    LiteGraph: {
      ...actual.LiteGraph,
      createNode: vi.fn()
    }
  }
})
vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      graph: {
        add: vi.fn()
      }
    }
  }
}))

async function createMockNode(overrides?: {
  widgetName?: string
  widgetValue?: string
  hasWidgets?: boolean
}): Promise<LGraphNode> {
  const {
    widgetName = 'ckpt_name',
    widgetValue = '',
    hasWidgets = true
  } = overrides || {}

  const { LGraphNode: ActualLGraphNode } = await vi.importActual<
    typeof LitegraphModule
  >('@/lib/litegraph/src/litegraph')

  if (!hasWidgets) {
    return Object.create(ActualLGraphNode.prototype)
  }

  type Widget = NonNullable<LGraphNode['widgets']>[number]
  const mockWidget: Widget = {
    name: widgetName,
    value: widgetValue,
    type: 'combo',
    y: 0,
    options: {},
    callback: vi.fn(),
    computeSize: vi.fn()
  }

  const mockNode = Object.create(ActualLGraphNode.prototype)
  mockNode.widgets = [mockWidget]
  return mockNode
}

function createMockProvider(widgetName = 'ckpt_name') {
  return {
    nodeDef: {
      name: 'CheckpointLoaderSimple',
      display_name: 'Load Checkpoint',
      category: 'loaders'
    },
    key: widgetName
  }
}

describe('createNodeFromModel', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mocks
    vi.mocked(useModelToNodeStore).mockReturnValue({
      getNodeProvider: vi.fn().mockReturnValue(createMockProvider())
    } as unknown as ReturnType<typeof useModelToNodeStore>)

    vi.mocked(useLitegraphService).mockReturnValue({
      getCanvasCenter: vi.fn().mockReturnValue([100, 100])
    } as unknown as ReturnType<typeof useLitegraphService>)

    vi.mocked(useWorkflowStore).mockReturnValue({
      isSubgraphActive: false,
      activeSubgraph: null
    } as unknown as ReturnType<typeof useWorkflowStore>)
  })

  describe('successful node creation', () => {
    it('should create node with correct category and filename', async () => {
      const mockNode = await createMockNode()
      vi.mocked(LiteGraph.createNode).mockReturnValue(mockNode)

      const result = createNodeFromModel(
        'checkpoints',
        'test-model.safetensors',
        'model-123'
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value).toBe(mockNode)
        expect(mockNode.widgets![0].value).toBe('test-model.safetensors')
      }
    })

    it('should use provided position', async () => {
      const mockNode = await createMockNode()
      vi.mocked(LiteGraph.createNode).mockReturnValue(mockNode)

      const customPosition = [200, 300] as [number, number]
      createNodeFromModel(
        'checkpoints',
        'test-model.safetensors',
        'model-123',
        { position: customPosition }
      )

      expect(LiteGraph.createNode).toHaveBeenCalledWith(
        'CheckpointLoaderSimple',
        'Load Checkpoint',
        { pos: customPosition }
      )
    })

    it('should use canvas center when position not provided', async () => {
      const mockNode = await createMockNode()
      vi.mocked(LiteGraph.createNode).mockReturnValue(mockNode)

      createNodeFromModel('checkpoints', 'test-model.safetensors', 'model-123')

      expect(LiteGraph.createNode).toHaveBeenCalledWith(
        'CheckpointLoaderSimple',
        'Load Checkpoint',
        { pos: [100, 100] }
      )
    })

    it('should add node to main graph', async () => {
      const mockNode = await createMockNode()
      vi.mocked(LiteGraph.createNode).mockReturnValue(mockNode)

      createNodeFromModel('checkpoints', 'test-model.safetensors', 'model-123')

      expect(app.canvas.graph?.add).toHaveBeenCalledWith(mockNode)
    })

    it('should add node to active subgraph when subgraph is active', async () => {
      const mockNode = await createMockNode()
      const mockSubgraph = { add: vi.fn() }
      vi.mocked(LiteGraph.createNode).mockReturnValue(mockNode)
      vi.mocked(useWorkflowStore).mockReturnValue({
        isSubgraphActive: true,
        activeSubgraph: mockSubgraph
      } as unknown as ReturnType<typeof useWorkflowStore>)

      createNodeFromModel('checkpoints', 'test-model.safetensors', 'model-123')

      expect(mockSubgraph.add).toHaveBeenCalledWith(mockNode)
      expect(app.canvas.graph?.add).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should return NO_PROVIDER error when provider not found', () => {
      vi.mocked(useModelToNodeStore).mockReturnValue({
        getNodeProvider: vi.fn().mockReturnValue(undefined)
      } as unknown as ReturnType<typeof useModelToNodeStore>)

      const result = createNodeFromModel(
        'unknown-type',
        'test-model.safetensors',
        'model-123'
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NO_PROVIDER')
        expect(result.error.message).toContain('unknown-type')
        expect(result.error.itemId).toBe('model-123')
      }
    })

    it('should return NODE_CREATION_FAILED error when createNode fails', () => {
      vi.mocked(LiteGraph.createNode).mockReturnValue(null)

      const result = createNodeFromModel(
        'checkpoints',
        'test-model.safetensors',
        'model-123'
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NODE_CREATION_FAILED')
        expect(result.error.itemId).toBe('model-123')
      }
    })

    it('should return NO_GRAPH error when no graph available', async () => {
      const mockNode = await createMockNode()
      vi.mocked(LiteGraph.createNode).mockReturnValue(mockNode)
      vi.mocked(useWorkflowStore).mockReturnValue({
        isSubgraphActive: false,
        activeSubgraph: null
      } as unknown as ReturnType<typeof useWorkflowStore>)

      // Mock app.canvas.graph to be null
      const originalGraph = app.canvas.graph
      app.canvas.graph = null

      const result = createNodeFromModel(
        'checkpoints',
        'test-model.safetensors',
        'model-123'
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NO_GRAPH')
        expect(result.error.itemId).toBe('model-123')
      }

      // Restore original graph
      app.canvas.graph = originalGraph
    })

    it('should return MISSING_WIDGET error when widget not found', async () => {
      const mockNode = await createMockNode({ hasWidgets: false })
      vi.mocked(LiteGraph.createNode).mockReturnValue(mockNode)

      const result = createNodeFromModel(
        'checkpoints',
        'test-model.safetensors',
        'model-123'
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('MISSING_WIDGET')
        expect(result.error.itemId).toBe('model-123')
      }
    })

    it('should return MISSING_WIDGET error when widget name does not match', async () => {
      const mockNode = await createMockNode({ widgetName: 'wrong_name' })
      vi.mocked(LiteGraph.createNode).mockReturnValue(mockNode)

      const result = createNodeFromModel(
        'checkpoints',
        'test-model.safetensors',
        'model-123'
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('MISSING_WIDGET')
        expect(result.error.details?.widgetName).toBe('ckpt_name')
      }
    })
  })

  describe('widget value setting', () => {
    it('should set widget value before adding to graph', async () => {
      const mockNode = await createMockNode()
      const addSpy = vi.fn()
      vi.mocked(LiteGraph.createNode).mockReturnValue(mockNode)
      if (app.canvas.graph) {
        app.canvas.graph.add = addSpy
      }

      createNodeFromModel('checkpoints', 'test-model.safetensors', 'model-123')

      // Widget value should be set
      expect(mockNode.widgets![0].value).toBe('test-model.safetensors')
      // And node should be added to graph
      expect(addSpy).toHaveBeenCalledWith(mockNode)
    })
  })

  describe('different model types', () => {
    it('should handle lora models', async () => {
      vi.mocked(useModelToNodeStore).mockReturnValue({
        getNodeProvider: vi
          .fn()
          .mockReturnValue(createMockProvider('lora_name'))
      } as unknown as ReturnType<typeof useModelToNodeStore>)

      const mockNode = await createMockNode({ widgetName: 'lora_name' })
      vi.mocked(LiteGraph.createNode).mockReturnValue(mockNode)

      const result = createNodeFromModel(
        'loras',
        'my-lora.safetensors',
        'lora-456'
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value.widgets![0].value).toBe('my-lora.safetensors')
      }
    })

    it('should handle controlnet models', async () => {
      vi.mocked(useModelToNodeStore).mockReturnValue({
        getNodeProvider: vi
          .fn()
          .mockReturnValue(createMockProvider('control_net_name'))
      } as unknown as ReturnType<typeof useModelToNodeStore>)

      const mockNode = await createMockNode({
        widgetName: 'control_net_name'
      })
      vi.mocked(LiteGraph.createNode).mockReturnValue(mockNode)

      const result = createNodeFromModel(
        'controlnet',
        'my-controlnet.pth',
        'cn-789'
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value.widgets![0].value).toBe('my-controlnet.pth')
      }
    })
  })
})
