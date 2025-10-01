import { beforeEach, describe, expect, it, vi } from 'vitest'

import { type LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { createModelNodeFromAsset } from '@/platform/assets/utils/createModelNodeFromAsset'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { app } from '@/scripts/app'
import { useLitegraphService } from '@/services/litegraphService'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'

// Type definitions for type-safe mocks
type ModelToNodeStoreMock = Pick<
  ReturnType<typeof useModelToNodeStore>,
  'getNodeProvider'
>

type LitegraphServiceMock = Pick<
  ReturnType<typeof useLitegraphService>,
  'getCanvasCenter'
>

type WorkflowStoreMock = Pick<
  ReturnType<typeof useWorkflowStore>,
  'activeSubgraph' | 'isSubgraphActive'
>

// Mock dependencies
vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: vi.fn((path: string) => `http://localhost:8188${path}`)
  }
}))
vi.mock('@/stores/modelToNodeStore')
vi.mock('@/platform/workflow/management/stores/workflowStore')
vi.mock('@/services/litegraphService')
vi.mock('@/lib/litegraph/src/litegraph', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/litegraph/src/litegraph')>()
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

function createMockAsset(overrides: Partial<AssetItem> = {}): AssetItem {
  return {
    id: 'asset-123',
    name: 'test-model.safetensors',
    size: 1024,
    created_at: '2025-10-01T00:00:00Z',
    tags: ['models', 'checkpoints'],
    user_metadata: {
      filename: 'models/checkpoints/test-model.safetensors'
    },
    ...overrides
  }
}

function createMockNode(overrides?: {
  widgetName?: string
  widgetValue?: string
  hasWidgets?: boolean
}) {
  const {
    widgetName = 'ckpt_name',
    widgetValue = '',
    hasWidgets = true
  } = overrides || {}

  if (!hasWidgets) {
    return {}
  }

  type Widget = NonNullable<LGraphNode['widgets']>[number]

  const widget: Pick<Widget, 'name' | 'value' | 'type' | 'options' | 'y'> = {
    name: widgetName,
    value: widgetValue,
    type: 'string',
    options: {},
    y: 0
  }

  return {
    widgets: [widget]
  }
}

function createMockNodeProvider() {
  return {
    nodeDef: {
      name: 'CheckpointLoaderSimple',
      display_name: 'Load Checkpoint'
    },
    key: 'ckpt_name'
  }
}

function getMockApp() {
  return app as unknown as {
    canvas: { graph: { add: ReturnType<typeof vi.fn> } }
  }
}

function getMockRootGraph() {
  return getMockApp().canvas.graph
}

/**
 * Configures all mocked dependencies with sensible defaults.
 * Returns mock references for spying on method calls in assertions.
 * For error paths or edge cases, set up mocks explicitly instead of using this helper.
 */
function setupMocks(
  overrides: {
    node?: ReturnType<typeof createMockNode>
    position?: [number, number]
    activeSubgraph?: { add: ReturnType<typeof vi.fn> }
  } = {}
) {
  const {
    node = createMockNode(),
    position = [100, 200],
    activeSubgraph = undefined
  } = overrides

  const mockModelToNodeStore: ModelToNodeStoreMock = {
    getNodeProvider: vi.fn().mockReturnValue(createMockNodeProvider())
  }
  const mockLitegraphService: LitegraphServiceMock = {
    getCanvasCenter: vi.fn().mockReturnValue(position)
  }
  const mockWorkflowStore: WorkflowStoreMock = {
    activeSubgraph: activeSubgraph as ReturnType<
      typeof useWorkflowStore
    >['activeSubgraph'],
    isSubgraphActive: !!activeSubgraph
  }

  vi.mocked(useModelToNodeStore).mockReturnValue(
    mockModelToNodeStore as ReturnType<typeof useModelToNodeStore>
  )
  vi.mocked(useLitegraphService).mockReturnValue(
    mockLitegraphService as ReturnType<typeof useLitegraphService>
  )
  vi.mocked(useWorkflowStore).mockReturnValue(
    mockWorkflowStore as ReturnType<typeof useWorkflowStore>
  )
  vi.mocked(LiteGraph.createNode).mockReturnValue(node as LGraphNode)

  return { mockModelToNodeStore, mockLitegraphService, mockWorkflowStore }
}

describe('createModelNodeFromAsset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  describe('input validation', () => {
    describe('when asset metadata is invalid', () => {
      it.each([
        {
          case: 'missing user_metadata',
          overrides: { user_metadata: undefined },
          errorPattern: 'Asset asset-123 missing required user_metadata'
        },
        {
          case: 'missing filename property',
          overrides: { user_metadata: {} },
          errorPattern:
            /Asset asset-123 has invalid user_metadata\.filename.*expected non-empty string, got undefined/
        },
        {
          case: 'non-string filename',
          overrides: { user_metadata: { filename: 123 } },
          errorPattern:
            /Asset asset-123 has invalid user_metadata\.filename.*expected non-empty string, got number/
        },
        {
          case: 'empty filename',
          overrides: { user_metadata: { filename: '' } },
          errorPattern:
            /Asset asset-123 has invalid user_metadata\.filename.*expected non-empty string/
        }
      ])('rejects assets with $case', ({ overrides, errorPattern }) => {
        const asset = createMockAsset(overrides)
        expect(() => createModelNodeFromAsset(asset)).toThrow(errorPattern)
      })
    })

    describe('when asset tags are invalid', () => {
      it.each([
        {
          case: 'without tags',
          overrides: { tags: undefined },
          errorPattern:
            'Asset asset-123 has no tags defined (expected at least one category tag)'
        },
        {
          case: 'with only excluded tags',
          overrides: { tags: ['models', 'missing'] },
          errorPattern:
            /Asset asset-123 has no valid category tag.*Available tags: models, missing/
        },
        {
          case: 'with only the models tag',
          overrides: { tags: ['models'] },
          errorPattern:
            /Asset asset-123 has no valid category tag.*Available tags: models/
        }
      ])('rejects assets $case', ({ overrides, errorPattern }) => {
        const asset = createMockAsset(overrides)
        expect(() => createModelNodeFromAsset(asset)).toThrow(errorPattern)
      })
    })

    describe('when node provider is unavailable', () => {
      it('throws error when no provider registered for category', () => {
        const asset = createMockAsset()
        const mockModelToNodeStore: ModelToNodeStoreMock = {
          getNodeProvider: vi.fn().mockReturnValue(null)
        }

        vi.mocked(useModelToNodeStore).mockReturnValue(
          mockModelToNodeStore as ReturnType<typeof useModelToNodeStore>
        )

        expect(() => createModelNodeFromAsset(asset)).toThrow(
          'No node provider registered for category: checkpoints'
        )
      })
    })
  })

  describe('node creation', () => {
    describe('when LiteGraph fails to create node', () => {
      it('throws error identifying the failed node type', () => {
        const asset = createMockAsset()
        const mockModelToNodeStore: ModelToNodeStoreMock = {
          getNodeProvider: vi.fn().mockReturnValue(createMockNodeProvider())
        }
        const mockLitegraphService: LitegraphServiceMock = {
          getCanvasCenter: vi.fn().mockReturnValue([100, 200])
        }

        vi.mocked(useModelToNodeStore).mockReturnValue(
          mockModelToNodeStore as ReturnType<typeof useModelToNodeStore>
        )
        vi.mocked(useLitegraphService).mockReturnValue(
          mockLitegraphService as ReturnType<typeof useLitegraphService>
        )
        vi.mocked(LiteGraph.createNode).mockReturnValue(null)

        expect(() => createModelNodeFromAsset(asset)).toThrow(
          'Failed to create node for type: CheckpointLoaderSimple'
        )
      })
    })

    describe('node type selection', () => {
      it('selects loader node by querying provider for asset category', () => {
        const asset = createMockAsset()
        const { mockModelToNodeStore } = setupMocks()

        createModelNodeFromAsset(asset)

        expect(mockModelToNodeStore.getNodeProvider).toHaveBeenCalledWith(
          'checkpoints'
        )
        expect(LiteGraph.createNode).toHaveBeenCalledWith(
          'CheckpointLoaderSimple',
          'Load Checkpoint',
          { pos: [100, 200] }
        )
      })
    })

    describe('node positioning', () => {
      it('positions node at canvas center by default', () => {
        const asset = createMockAsset()
        const { mockLitegraphService } = setupMocks({
          position: [150, 250]
        })

        createModelNodeFromAsset(asset)

        expect(mockLitegraphService.getCanvasCenter).toHaveBeenCalled()
        expect(LiteGraph.createNode).toHaveBeenCalledWith(
          'CheckpointLoaderSimple',
          'Load Checkpoint',
          { pos: [150, 250] }
        )
      })

      it('uses custom position when explicitly provided', () => {
        const asset = createMockAsset()
        const { mockLitegraphService } = setupMocks()

        createModelNodeFromAsset(asset, { position: [300, 400] })

        expect(mockLitegraphService.getCanvasCenter).not.toHaveBeenCalled()
        expect(LiteGraph.createNode).toHaveBeenCalledWith(
          'CheckpointLoaderSimple',
          'Load Checkpoint',
          { pos: [300, 400] }
        )
      })
    })
  })

  describe('widget configuration', () => {
    it('configures widget with asset file path', () => {
      const asset = createMockAsset()
      const mockNode = createMockNode()
      setupMocks({ node: mockNode })

      createModelNodeFromAsset(asset)

      expect(mockNode.widgets?.[0].value).toBe(
        'models/checkpoints/test-model.safetensors'
      )
    })

    it('warns when expected widget is missing from node', () => {
      const asset = createMockAsset()
      const mockNode = createMockNode({ widgetName: 'wrong_widget' })
      setupMocks({ node: mockNode })

      createModelNodeFromAsset(asset)

      expect(console.warn).toHaveBeenCalledWith(
        'Widget ckpt_name not found on node CheckpointLoaderSimple'
      )
    })

    it('warns when node has no widgets array', () => {
      const asset = createMockAsset()
      const mockNode = createMockNode({ hasWidgets: false })
      setupMocks({ node: mockNode })

      createModelNodeFromAsset(asset)

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Widget ckpt_name not found')
      )
    })
  })

  describe('graph placement', () => {
    it('adds node to root graph when no subgraph is active', () => {
      const asset = createMockAsset()
      const mockNode = createMockNode()
      setupMocks({ node: mockNode })

      createModelNodeFromAsset(asset)

      expect(getMockRootGraph().add).toHaveBeenCalledWith(mockNode)
    })

    it('adds node to active subgraph when present', () => {
      const asset = createMockAsset()
      const mockNode = createMockNode()
      const mockSubgraph = { add: vi.fn() }
      setupMocks({
        node: mockNode,
        activeSubgraph: mockSubgraph
      })

      createModelNodeFromAsset(asset)

      expect(mockSubgraph.add).toHaveBeenCalledWith(mockNode)
      expect(getMockRootGraph().add).not.toHaveBeenCalled()
    })

    it('throws error when neither root graph nor subgraph is available', () => {
      const asset = createMockAsset()
      const mockNode = createMockNode()
      const mockModelToNodeStore: ModelToNodeStoreMock = {
        getNodeProvider: vi.fn().mockReturnValue(createMockNodeProvider())
      }
      const mockLitegraphService: LitegraphServiceMock = {
        getCanvasCenter: vi.fn().mockReturnValue([100, 200])
      }
      const mockWorkflowStore: WorkflowStoreMock = {
        activeSubgraph: null as unknown as ReturnType<
          typeof useWorkflowStore
        >['activeSubgraph'],
        isSubgraphActive: false
      }

      vi.mocked(useModelToNodeStore).mockReturnValue(
        mockModelToNodeStore as ReturnType<typeof useModelToNodeStore>
      )
      vi.mocked(useLitegraphService).mockReturnValue(
        mockLitegraphService as ReturnType<typeof useLitegraphService>
      )
      vi.mocked(useWorkflowStore).mockReturnValue(
        mockWorkflowStore as ReturnType<typeof useWorkflowStore>
      )
      vi.mocked(LiteGraph.createNode).mockReturnValue(mockNode as LGraphNode)

      const mockApp = getMockApp()
      const originalGraph = mockApp.canvas.graph
      mockApp.canvas.graph = null as unknown as {
        add: ReturnType<typeof vi.fn>
      }

      expect(() => createModelNodeFromAsset(asset)).toThrow(
        'No active graph available'
      )

      mockApp.canvas.graph = originalGraph
    })
  })
})
