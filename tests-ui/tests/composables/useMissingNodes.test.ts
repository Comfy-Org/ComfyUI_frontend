import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { useMissingNodes } from '@/composables/nodePack/useMissingNodes'
import { useWorkflowPacks } from '@/composables/nodePack/useWorkflowPacks'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { collectAllNodes } from '@/utils/graphTraversalUtil'

// Mock Vue's onMounted to execute immediately for testing
vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...actual,
    onMounted: (cb: () => void) => cb()
  }
})

// Mock the dependencies
vi.mock('@/composables/nodePack/useWorkflowPacks', () => ({
  useWorkflowPacks: vi.fn()
}))

vi.mock('@/stores/comfyManagerStore', () => ({
  useComfyManagerStore: vi.fn()
}))

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: vi.fn()
}))

vi.mock('@/scripts/app', () => ({
  app: {
    graph: {
      nodes: []
    }
  }
}))

vi.mock('@/utils/graphTraversalUtil', () => ({
  collectAllNodes: vi.fn()
}))

const mockUseWorkflowPacks = vi.mocked(useWorkflowPacks)
const mockUseComfyManagerStore = vi.mocked(useComfyManagerStore)
const mockUseNodeDefStore = vi.mocked(useNodeDefStore)
const mockCollectAllNodes = vi.mocked(collectAllNodes)

describe('useMissingNodes', () => {
  const mockWorkflowPacks = [
    {
      id: 'pack-1',
      name: 'Test Pack 1',
      latest_version: { version: '1.0.0' }
    },
    {
      id: 'pack-2',
      name: 'Test Pack 2',
      latest_version: { version: '2.0.0' }
    },
    {
      id: 'pack-3',
      name: 'Installed Pack',
      latest_version: { version: '1.5.0' }
    }
  ]

  const mockStartFetchWorkflowPacks = vi.fn()
  const mockIsPackInstalled = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Default setup: pack-3 is installed, others are not
    mockIsPackInstalled.mockImplementation((id: string) => id === 'pack-3')

    // @ts-expect-error - Mocking partial ComfyManagerStore for testing.
    // We only need isPackInstalled method for these tests.
    mockUseComfyManagerStore.mockReturnValue({
      isPackInstalled: mockIsPackInstalled
    })

    mockUseWorkflowPacks.mockReturnValue({
      workflowPacks: ref([]),
      isLoading: ref(false),
      error: ref(null),
      startFetchWorkflowPacks: mockStartFetchWorkflowPacks,
      isReady: ref(false),
      filterWorkflowPack: vi.fn()
    })

    // Reset node def store mock
    // @ts-expect-error - Mocking partial NodeDefStore for testing.
    // We only need nodeDefsByName for these tests.
    mockUseNodeDefStore.mockReturnValue({
      nodeDefsByName: {}
    })

    // Reset app.graph.nodes
    // @ts-expect-error - app.graph.nodes is readonly, but we need to modify it for testing.
    app.graph.nodes = []

    // Default mock for collectAllNodes - returns empty array
    mockCollectAllNodes.mockReturnValue([])
  })

  describe('core filtering logic', () => {
    it('filters out installed packs correctly', () => {
      mockUseWorkflowPacks.mockReturnValue({
        workflowPacks: ref(mockWorkflowPacks),
        isLoading: ref(false),
        error: ref(null),
        startFetchWorkflowPacks: mockStartFetchWorkflowPacks,
        isReady: ref(true),
        filterWorkflowPack: vi.fn()
      })

      const { missingNodePacks } = useMissingNodes()

      // Should only include packs that are not installed (pack-1, pack-2)
      expect(missingNodePacks.value).toHaveLength(2)
      expect(missingNodePacks.value[0].id).toBe('pack-1')
      expect(missingNodePacks.value[1].id).toBe('pack-2')
      expect(
        missingNodePacks.value.find((pack) => pack.id === 'pack-3')
      ).toBeUndefined()
    })

    it('returns empty array when all packs are installed', () => {
      mockUseWorkflowPacks.mockReturnValue({
        workflowPacks: ref(mockWorkflowPacks),
        isLoading: ref(false),
        error: ref(null),
        startFetchWorkflowPacks: mockStartFetchWorkflowPacks,
        isReady: ref(true),
        filterWorkflowPack: vi.fn()
      })

      // Mock all packs as installed
      mockIsPackInstalled.mockReturnValue(true)

      const { missingNodePacks } = useMissingNodes()

      expect(missingNodePacks.value).toEqual([])
    })

    it('returns all packs when none are installed', () => {
      mockUseWorkflowPacks.mockReturnValue({
        workflowPacks: ref(mockWorkflowPacks),
        isLoading: ref(false),
        error: ref(null),
        startFetchWorkflowPacks: mockStartFetchWorkflowPacks,
        isReady: ref(true),
        filterWorkflowPack: vi.fn()
      })

      // Mock no packs as installed
      mockIsPackInstalled.mockReturnValue(false)

      const { missingNodePacks } = useMissingNodes()

      expect(missingNodePacks.value).toHaveLength(3)
      expect(missingNodePacks.value).toEqual(mockWorkflowPacks)
    })

    it('returns empty array when no workflow packs exist', () => {
      const { missingNodePacks } = useMissingNodes()

      expect(missingNodePacks.value).toEqual([])
    })
  })

  describe('automatic data fetching', () => {
    it('fetches workflow packs automatically when none exist', async () => {
      useMissingNodes()

      expect(mockStartFetchWorkflowPacks).toHaveBeenCalledOnce()
    })

    it('does not fetch when packs already exist', async () => {
      mockUseWorkflowPacks.mockReturnValue({
        workflowPacks: ref(mockWorkflowPacks),
        isLoading: ref(false),
        error: ref(null),
        startFetchWorkflowPacks: mockStartFetchWorkflowPacks,
        isReady: ref(true),
        filterWorkflowPack: vi.fn()
      })

      useMissingNodes()

      expect(mockStartFetchWorkflowPacks).not.toHaveBeenCalled()
    })

    it('does not fetch when already loading', async () => {
      mockUseWorkflowPacks.mockReturnValue({
        workflowPacks: ref([]),
        isLoading: ref(true),
        error: ref(null),
        startFetchWorkflowPacks: mockStartFetchWorkflowPacks,
        isReady: ref(false),
        filterWorkflowPack: vi.fn()
      })

      useMissingNodes()

      expect(mockStartFetchWorkflowPacks).not.toHaveBeenCalled()
    })
  })

  describe('state management', () => {
    it('exposes loading state from useWorkflowPacks', () => {
      mockUseWorkflowPacks.mockReturnValue({
        workflowPacks: ref([]),
        isLoading: ref(true),
        error: ref(null),
        startFetchWorkflowPacks: mockStartFetchWorkflowPacks,
        isReady: ref(false),
        filterWorkflowPack: vi.fn()
      })

      const { isLoading } = useMissingNodes()

      expect(isLoading.value).toBe(true)
    })

    it('exposes error state from useWorkflowPacks', () => {
      const testError = 'Failed to fetch workflow packs'
      mockUseWorkflowPacks.mockReturnValue({
        workflowPacks: ref([]),
        isLoading: ref(false),
        error: ref(testError),
        startFetchWorkflowPacks: mockStartFetchWorkflowPacks,
        isReady: ref(false),
        filterWorkflowPack: vi.fn()
      })

      const { error } = useMissingNodes()

      expect(error.value).toBe(testError)
    })
  })

  describe('reactivity', () => {
    it('updates when workflow packs change', async () => {
      const workflowPacksRef = ref([])
      mockUseWorkflowPacks.mockReturnValue({
        workflowPacks: workflowPacksRef,
        isLoading: ref(false),
        error: ref(null),
        startFetchWorkflowPacks: mockStartFetchWorkflowPacks,
        isReady: ref(true),
        filterWorkflowPack: vi.fn()
      })

      const { missingNodePacks } = useMissingNodes()

      // Initially empty
      expect(missingNodePacks.value).toEqual([])

      // Update workflow packs
      // @ts-expect-error - mockWorkflowPacks is a simplified version without full WorkflowPack interface.
      workflowPacksRef.value = mockWorkflowPacks
      await nextTick()

      // Should update missing packs (2 missing since pack-3 is installed)
      expect(missingNodePacks.value).toHaveLength(2)
    })
  })

  describe('missing core nodes detection', () => {
    const createMockNode = (
      type: string,
      packId?: string,
      version?: string
    ): LGraphNode =>
      // @ts-expect-error - Creating a partial mock of LGraphNode for testing.
      // We only need specific properties for our tests, not the full LGraphNode interface.
      ({
        type,
        properties: { cnr_id: packId, ver: version },
        id: 1,
        title: type,
        pos: [0, 0],
        size: [100, 100],
        flags: {},
        graph: null,
        mode: 0,
        inputs: [],
        outputs: []
      })

    it('identifies missing core nodes not in nodeDefStore', () => {
      const coreNode1 = createMockNode('CoreNode1', 'comfy-core', '1.2.0')
      const coreNode2 = createMockNode('CoreNode2', 'comfy-core', '1.2.0')

      // Mock collectAllNodes to return only the filtered nodes (missing core nodes)
      mockCollectAllNodes.mockReturnValue([coreNode1, coreNode2])

      mockUseNodeDefStore.mockReturnValue({
        nodeDefsByName: {
          // @ts-expect-error - Creating minimal mock of ComfyNodeDefImpl for testing.
          // Only including required properties for our test assertions.
          RegisteredNode: { name: 'RegisteredNode' }
        }
      })

      const { missingCoreNodes } = useMissingNodes()

      expect(Object.keys(missingCoreNodes.value)).toHaveLength(1)
      expect(missingCoreNodes.value['1.2.0']).toHaveLength(2)
      expect(missingCoreNodes.value['1.2.0'][0].type).toBe('CoreNode1')
      expect(missingCoreNodes.value['1.2.0'][1].type).toBe('CoreNode2')
    })

    it('groups missing core nodes by version', () => {
      const node120 = createMockNode('Node120', 'comfy-core', '1.2.0')
      const node130 = createMockNode('Node130', 'comfy-core', '1.3.0')
      const nodeNoVer = createMockNode('NodeNoVer', 'comfy-core')

      // Mock collectAllNodes to return these nodes
      mockCollectAllNodes.mockReturnValue([node120, node130, nodeNoVer])

      // @ts-expect-error - Mocking partial NodeDefStore for testing.
      mockUseNodeDefStore.mockReturnValue({
        nodeDefsByName: {}
      })

      const { missingCoreNodes } = useMissingNodes()

      expect(Object.keys(missingCoreNodes.value)).toHaveLength(3)
      expect(missingCoreNodes.value['1.2.0']).toHaveLength(1)
      expect(missingCoreNodes.value['1.3.0']).toHaveLength(1)
      expect(missingCoreNodes.value['']).toHaveLength(1)
    })

    it('ignores non-core nodes', () => {
      const coreNode = createMockNode('CoreNode', 'comfy-core', '1.2.0')

      // Mock collectAllNodes to return only the filtered nodes (core nodes only)
      mockCollectAllNodes.mockReturnValue([coreNode])

      // @ts-expect-error - Mocking partial NodeDefStore for testing.
      mockUseNodeDefStore.mockReturnValue({
        nodeDefsByName: {}
      })

      const { missingCoreNodes } = useMissingNodes()

      expect(Object.keys(missingCoreNodes.value)).toHaveLength(1)
      expect(missingCoreNodes.value['1.2.0']).toHaveLength(1)
      expect(missingCoreNodes.value['1.2.0'][0].type).toBe('CoreNode')
    })

    it('returns empty object when no core nodes are missing', () => {
      // Mock collectAllNodes to return empty array (no missing nodes after filtering)
      mockCollectAllNodes.mockReturnValue([])

      mockUseNodeDefStore.mockReturnValue({
        nodeDefsByName: {
          // @ts-expect-error - Creating minimal mock of ComfyNodeDefImpl for testing.
          // Only including required properties for our test assertions.
          RegisteredNode1: { name: 'RegisteredNode1' },
          // @ts-expect-error - Creating minimal mock of ComfyNodeDefImpl for testing.
          RegisteredNode2: { name: 'RegisteredNode2' }
        }
      })

      const { missingCoreNodes } = useMissingNodes()

      expect(Object.keys(missingCoreNodes.value)).toHaveLength(0)
    })
  })

  describe('subgraph support', () => {
    const createMockNode = (
      type: string,
      packId?: string,
      version?: string
    ): LGraphNode =>
      // @ts-expect-error - Creating a partial mock of LGraphNode for testing.
      // We only need specific properties for our tests, not the full LGraphNode interface.
      ({
        type,
        properties: { cnr_id: packId, ver: version },
        id: 1,
        title: type,
        pos: [0, 0],
        size: [100, 100],
        flags: {},
        graph: null,
        mode: 0,
        inputs: [],
        outputs: []
      })

    it('detects missing core nodes from subgraphs via collectAllNodes', () => {
      const mainNode = createMockNode('MainNode', 'comfy-core', '1.0.0')
      const subgraphNode1 = createMockNode(
        'SubgraphNode1',
        'comfy-core',
        '1.0.0'
      )
      const subgraphNode2 = createMockNode(
        'SubgraphNode2',
        'comfy-core',
        '1.1.0'
      )

      // Mock collectAllNodes to return all nodes including subgraph nodes
      mockCollectAllNodes.mockReturnValue([
        mainNode,
        subgraphNode1,
        subgraphNode2
      ])

      // Mock none of the nodes as registered
      // @ts-expect-error - Mocking partial NodeDefStore for testing.
      mockUseNodeDefStore.mockReturnValue({
        nodeDefsByName: {}
      })

      const { missingCoreNodes } = useMissingNodes()

      // Should detect all 3 nodes as missing
      expect(Object.keys(missingCoreNodes.value)).toHaveLength(2) // 2 versions: 1.0.0, 1.1.0
      expect(missingCoreNodes.value['1.0.0']).toHaveLength(2) // MainNode + SubgraphNode1
      expect(missingCoreNodes.value['1.1.0']).toHaveLength(1) // SubgraphNode2
    })

    it('calls collectAllNodes with the app graph and filter function', () => {
      const mockGraph = { nodes: [], subgraphs: new Map() }
      // @ts-expect-error - Mocking app.graph for testing
      app.graph = mockGraph

      const { missingCoreNodes } = useMissingNodes()
      // Access the computed to trigger the function
      void missingCoreNodes.value

      expect(mockCollectAllNodes).toHaveBeenCalledWith(
        mockGraph,
        expect.any(Function)
      )
    })

    it('handles collectAllNodes returning empty array', () => {
      mockCollectAllNodes.mockReturnValue([])

      const { missingCoreNodes } = useMissingNodes()

      expect(Object.keys(missingCoreNodes.value)).toHaveLength(0)
    })

    it('filter function correctly identifies missing core nodes', () => {
      const mockGraph = { nodes: [], subgraphs: new Map() }
      // @ts-expect-error - Mocking app.graph for testing
      app.graph = mockGraph

      mockUseNodeDefStore.mockReturnValue({
        nodeDefsByName: {
          // @ts-expect-error - Creating minimal mock of ComfyNodeDefImpl for testing.
          RegisteredCore: { name: 'RegisteredCore' }
        }
      })

      let capturedFilterFunction: ((node: LGraphNode) => boolean) | undefined

      mockCollectAllNodes.mockImplementation((_graph, filter) => {
        capturedFilterFunction = filter
        return []
      })

      const { missingCoreNodes } = useMissingNodes()
      void missingCoreNodes.value

      expect(capturedFilterFunction).toBeDefined()

      if (capturedFilterFunction) {
        const missingCoreNode = createMockNode(
          'MissingCore',
          'comfy-core',
          '1.0.0'
        )
        const registeredCoreNode = createMockNode(
          'RegisteredCore',
          'comfy-core',
          '1.0.0'
        )
        const customNode = createMockNode('CustomNode', 'custom-pack', '1.0.0')
        const nodeWithoutPack = createMockNode('NodeWithoutPack')

        expect(capturedFilterFunction(missingCoreNode)).toBe(true)
        expect(capturedFilterFunction(registeredCoreNode)).toBe(false)
        expect(capturedFilterFunction(customNode)).toBe(false)
        expect(capturedFilterFunction(nodeWithoutPack)).toBe(false)
      }
    })

    it('integrates with collectAllNodes to find nodes from subgraphs', () => {
      mockCollectAllNodes.mockImplementation((graph, filter) => {
        const allNodes: LGraphNode[] = []

        for (const node of graph.nodes) {
          if (node.isSubgraphNode?.() && node.subgraph) {
            for (const subNode of node.subgraph.nodes) {
              if (!filter || filter(subNode)) {
                allNodes.push(subNode)
              }
            }
          }

          if (!filter || filter(node)) {
            allNodes.push(node)
          }
        }

        return allNodes
      })

      const mainMissingNode = createMockNode(
        'MainMissing',
        'comfy-core',
        '1.0.0'
      )
      const subgraphMissingNode = createMockNode(
        'SubgraphMissing',
        'comfy-core',
        '1.1.0'
      )
      const subgraphRegisteredNode = createMockNode(
        'SubgraphRegistered',
        'comfy-core',
        '1.0.0'
      )

      const mockSubgraph = {
        nodes: [subgraphMissingNode, subgraphRegisteredNode]
      }

      const mockSubgraphNode = {
        isSubgraphNode: () => true,
        subgraph: mockSubgraph,
        type: 'SubgraphContainer',
        properties: { cnr_id: 'custom-pack' }
      }

      const mockMainGraph = {
        nodes: [mainMissingNode, mockSubgraphNode]
      }

      // @ts-expect-error - Mocking app.graph for testing
      app.graph = mockMainGraph

      mockUseNodeDefStore.mockReturnValue({
        nodeDefsByName: {
          // @ts-expect-error - Creating minimal mock of ComfyNodeDefImpl for testing.
          SubgraphRegistered: { name: 'SubgraphRegistered' }
        }
      })

      const { missingCoreNodes } = useMissingNodes()

      expect(Object.keys(missingCoreNodes.value)).toHaveLength(2)
      expect(missingCoreNodes.value['1.0.0']).toHaveLength(1)
      expect(missingCoreNodes.value['1.1.0']).toHaveLength(1)
      expect(missingCoreNodes.value['1.0.0'][0].type).toBe('MainMissing')
      expect(missingCoreNodes.value['1.1.0'][0].type).toBe('SubgraphMissing')
    })
  })
})
