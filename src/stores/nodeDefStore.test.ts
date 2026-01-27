import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { SYSTEM_NODE_DEFS, useNodeDefStore } from '@/stores/nodeDefStore'
import type { NodeDefFilter } from '@/stores/nodeDefStore'

vi.mock('@/scripts/api', () => ({
  api: {
    getNodeDefs: vi.fn().mockResolvedValue({ TestNode: { name: 'TestNode' } }),
    apiURL: vi.fn((path: string) => `/api${path}`),
    addEventListener: vi.fn(),
    getUserData: vi.fn(),
    storeUserData: vi.fn(),
    listUserDataFullInfo: vi.fn()
  }
}))

const SYSTEM_NODE_COUNT = Object.keys(SYSTEM_NODE_DEFS).length

describe('useNodeDefStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.clearAllMocks()
  })

  const createMockNodeDef = (
    overrides: Partial<ComfyNodeDef> = {}
  ): ComfyNodeDef => ({
    name: 'TestNode',
    display_name: 'Test Node',
    category: 'test',
    python_module: 'test_module',
    description: 'Test node',
    input: {},
    output: [],
    output_is_list: [],
    output_name: [],
    output_node: false,
    deprecated: false,
    experimental: false,
    ...overrides
  })

  describe('load', () => {
    it('initializes with isReady false', () => {
      const store = useNodeDefStore()
      expect(store.isReady).toBe(false)
    })

    it('loads node definitions from API', async () => {
      const store = useNodeDefStore()
      const { api } = await import('@/scripts/api')

      await store.load()

      await vi.waitFor(() => {
        expect(store.isReady).toBe(true)
      })

      expect(api.getNodeDefs).toHaveBeenCalled()
    })

    it('does not reload if already ready', async () => {
      const store = useNodeDefStore()
      const { api } = await import('@/scripts/api')

      await store.load()
      await vi.waitFor(() => expect(store.isReady).toBe(true))

      vi.clearAllMocks()
      await store.load()

      expect(api.getNodeDefs).not.toHaveBeenCalled()
    })
  })

  describe('filter registry', () => {
    it('should register a new filter', () => {
      const store = useNodeDefStore()
      const filter: NodeDefFilter = {
        id: 'test.filter',
        name: 'Test Filter',
        predicate: () => true
      }

      store.registerNodeDefFilter(filter)
      expect(store.nodeDefFilters).toContainEqual(filter)
    })

    it('should unregister a filter by id', () => {
      const store = useNodeDefStore()
      const filter: NodeDefFilter = {
        id: 'test.filter',
        name: 'Test Filter',
        predicate: () => true
      }

      store.registerNodeDefFilter(filter)
      store.unregisterNodeDefFilter('test.filter')
      expect(store.nodeDefFilters).not.toContainEqual(filter)
    })

    it('should register core filters on initialization', () => {
      const store = useNodeDefStore()
      const deprecatedFilter = store.nodeDefFilters.find(
        (f) => f.id === 'core.deprecated'
      )
      const experimentalFilter = store.nodeDefFilters.find(
        (f) => f.id === 'core.experimental'
      )

      expect(deprecatedFilter).toBeDefined()
      expect(experimentalFilter).toBeDefined()
    })
  })

  describe('filter application', () => {
    const systemNodeFilter: NodeDefFilter = {
      id: 'test.no-system',
      name: 'Hide System Nodes',
      predicate: (node) => !(node.name in SYSTEM_NODE_DEFS)
    }

    function createFilterTestStore() {
      const store = useNodeDefStore()
      // Clear existing filters for isolated tests
      store.nodeDefFilters.splice(0)
      // Exclude system nodes from filter tests for cleaner assertions
      store.registerNodeDefFilter(systemNodeFilter)
      return store
    }

    it('should apply single filter to visible nodes', () => {
      const store = createFilterTestStore()
      const normalNode = createMockNodeDef({
        name: 'normal',
        deprecated: false
      })
      const deprecatedNode = createMockNodeDef({
        name: 'deprecated',
        deprecated: true
      })

      store.updateNodeDefs([normalNode, deprecatedNode])

      // Register filter that hides deprecated nodes
      store.registerNodeDefFilter({
        id: 'test.no-deprecated',
        name: 'Hide Deprecated',
        predicate: (node) => !node.deprecated
      })

      expect(store.visibleNodeDefs).toHaveLength(1)
      expect(store.visibleNodeDefs[0].name).toBe('normal')
    })

    it('should apply multiple filters with AND logic', () => {
      const store = createFilterTestStore()
      const node1 = createMockNodeDef({
        name: 'node1',
        deprecated: false,
        experimental: false
      })
      const node2 = createMockNodeDef({
        name: 'node2',
        deprecated: true,
        experimental: false
      })
      const node3 = createMockNodeDef({
        name: 'node3',
        deprecated: false,
        experimental: true
      })
      const node4 = createMockNodeDef({
        name: 'node4',
        deprecated: true,
        experimental: true
      })

      store.updateNodeDefs([node1, node2, node3, node4])

      // Register filters
      store.registerNodeDefFilter({
        id: 'test.no-deprecated',
        name: 'Hide Deprecated',
        predicate: (node) => !node.deprecated
      })

      store.registerNodeDefFilter({
        id: 'test.no-experimental',
        name: 'Hide Experimental',
        predicate: (node) => !node.experimental
      })

      // Only node1 should be visible (not deprecated AND not experimental)
      expect(store.visibleNodeDefs).toHaveLength(1)
      expect(store.visibleNodeDefs[0].name).toBe('node1')
    })

    it('should show all nodes when no filters are registered', () => {
      const store = createFilterTestStore()
      // Remove system node filter for this test
      store.unregisterNodeDefFilter('test.no-system')

      const nodes = [
        createMockNodeDef({ name: 'node1' }),
        createMockNodeDef({ name: 'node2' }),
        createMockNodeDef({ name: 'node3' })
      ]

      store.updateNodeDefs(nodes)
      // Includes 3 test nodes + 4 system nodes
      expect(store.visibleNodeDefs).toHaveLength(3 + SYSTEM_NODE_COUNT)
    })

    it('should update visibility when filter is removed', () => {
      const store = createFilterTestStore()
      const deprecatedNode = createMockNodeDef({
        name: 'deprecated',
        deprecated: true
      })
      store.updateNodeDefs([deprecatedNode])

      const filter: NodeDefFilter = {
        id: 'test.no-deprecated',
        name: 'Hide Deprecated',
        predicate: (node) => !node.deprecated
      }

      // Add filter - node should be hidden (only system nodes remain, but they're filtered too)
      store.registerNodeDefFilter(filter)
      expect(store.visibleNodeDefs).toHaveLength(0)

      // Remove filter - node should be visible
      store.unregisterNodeDefFilter('test.no-deprecated')
      expect(store.visibleNodeDefs).toHaveLength(1)
    })
  })

  describe('core filters behavior', () => {
    it('should hide deprecated nodes by default', () => {
      const store = useNodeDefStore()
      const normalNode = createMockNodeDef({
        name: 'normal',
        deprecated: false
      })
      const deprecatedNode = createMockNodeDef({
        name: 'deprecated',
        deprecated: true
      })

      store.updateNodeDefs([normalNode, deprecatedNode])

      // 1 normal test node + 4 system nodes
      expect(store.visibleNodeDefs).toHaveLength(1 + SYSTEM_NODE_COUNT)
      expect(
        store.visibleNodeDefs.find((n) => n.name === 'normal')
      ).toBeDefined()
      expect(
        store.visibleNodeDefs.find((n) => n.name === 'deprecated')
      ).toBeUndefined()
    })

    it('should show deprecated nodes when showDeprecated is true', () => {
      const store = useNodeDefStore()
      const normalNode = createMockNodeDef({
        name: 'normal',
        deprecated: false
      })
      const deprecatedNode = createMockNodeDef({
        name: 'deprecated',
        deprecated: true
      })

      store.updateNodeDefs([normalNode, deprecatedNode])
      store.showDeprecated = true

      // 2 test nodes + 4 system nodes
      expect(store.visibleNodeDefs).toHaveLength(2 + SYSTEM_NODE_COUNT)
    })

    it('should hide experimental nodes by default', () => {
      const store = useNodeDefStore()
      const normalNode = createMockNodeDef({
        name: 'normal',
        experimental: false
      })
      const experimentalNode = createMockNodeDef({
        name: 'experimental',
        experimental: true
      })

      store.updateNodeDefs([normalNode, experimentalNode])

      // 1 normal test node + 4 system nodes
      expect(store.visibleNodeDefs).toHaveLength(1 + SYSTEM_NODE_COUNT)
      expect(
        store.visibleNodeDefs.find((n) => n.name === 'normal')
      ).toBeDefined()
      expect(
        store.visibleNodeDefs.find((n) => n.name === 'experimental')
      ).toBeUndefined()
    })

    it('should show experimental nodes when showExperimental is true', () => {
      const store = useNodeDefStore()
      const normalNode = createMockNodeDef({
        name: 'normal',
        experimental: false
      })
      const experimentalNode = createMockNodeDef({
        name: 'experimental',
        experimental: true
      })

      store.updateNodeDefs([normalNode, experimentalNode])
      store.showExperimental = true

      // 2 test nodes + 4 system nodes
      expect(store.visibleNodeDefs).toHaveLength(2 + SYSTEM_NODE_COUNT)
    })

    it('should hide subgraph nodes by default', () => {
      const store = useNodeDefStore()
      const normalNode = createMockNodeDef({
        name: 'normal',
        category: 'conditioning',
        python_module: 'nodes'
      })
      const subgraphNode = createMockNodeDef({
        name: 'MySubgraph',
        category: 'subgraph',
        python_module: 'nodes'
      })

      store.updateNodeDefs([normalNode, subgraphNode])

      // 1 normal test node + 4 system nodes
      expect(store.visibleNodeDefs).toHaveLength(1 + SYSTEM_NODE_COUNT)
      expect(
        store.visibleNodeDefs.find((n) => n.name === 'normal')
      ).toBeDefined()
      expect(
        store.visibleNodeDefs.find((n) => n.name === 'MySubgraph')
      ).toBeUndefined()
    })

    it('should show non-subgraph nodes with subgraph category', () => {
      const store = useNodeDefStore()
      const normalNode = createMockNodeDef({
        name: 'normal',
        category: 'conditioning',
        python_module: 'custom_extension'
      })
      const fakeSubgraphNode = createMockNodeDef({
        name: 'FakeSubgraph',
        category: 'subgraph',
        python_module: 'custom_extension' // Different python_module
      })

      store.updateNodeDefs([normalNode, fakeSubgraphNode])

      // 2 test nodes + 4 system nodes
      expect(store.visibleNodeDefs).toHaveLength(2 + SYSTEM_NODE_COUNT)
      const testNodes = store.visibleNodeDefs
        .filter((n) => !(n.name in SYSTEM_NODE_DEFS))
        .map((n) => n.name)
      expect(testNodes).toEqual(['normal', 'FakeSubgraph'])
    })
  })

  describe('performance', () => {
    it('should perform single traversal for multiple filters', () => {
      const store = useNodeDefStore()
      let filterCallCount = 0
      const testFilterCount = 5

      // Register multiple filters that count their calls
      for (let i = 0; i < testFilterCount; i++) {
        store.registerNodeDefFilter({
          id: `test.counter-${i}`,
          name: `Counter ${i}`,
          predicate: () => {
            filterCallCount++
            return true
          }
        })
      }

      const testNodeCount = 10
      const nodes = Array.from({ length: testNodeCount }, (_, i) =>
        createMockNodeDef({ name: `node${i}` })
      )
      store.updateNodeDefs(nodes)

      // Force recomputation by accessing visibleNodeDefs
      expect(store.visibleNodeDefs).toBeDefined()

      // Each node (test nodes + system nodes) checked by each test filter
      const totalNodes = testNodeCount + SYSTEM_NODE_COUNT
      expect(filterCallCount).toBe(totalNodes * testFilterCount)
    })
  })
})
