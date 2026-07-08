import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import axios from 'axios'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { promoteValueWidgetViaSubgraphInput } from '@/core/graph/subgraph/promotionUtils'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraph, SubgraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import {
  ComfyNodeDefImpl,
  buildNodeDefTree,
  createDummyFolderNodeDef,
  useNodeDefStore,
  useNodeFrequencyStore
} from '@/stores/nodeDefStore'
import type { NodeDefFilter } from '@/stores/nodeDefStore'

describe('useNodeDefStore', () => {
  let store: ReturnType<typeof useNodeDefStore>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    store = useNodeDefStore()
  })

  afterEach(() => {
    vi.restoreAllMocks()
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

  describe('ComfyNodeDefImpl', () => {
    it('migrates defaultInput options and applies constructor fallbacks', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const nodeDef = createMockNodeDef({
        category: '_for_testing/coverage',
        deprecated: undefined,
        dev_only: undefined,
        experimental: undefined,
        help: undefined,
        input: {
          required: { prompt: ['STRING', { defaultInput: true }] },
          optional: { seed_override: ['INT', { defaultInput: true }] }
        }
      })

      const impl = new ComfyNodeDefImpl(nodeDef)

      expect(warn).toHaveBeenCalledTimes(2)
      expect(impl.help).toBe('')
      expect(impl.experimental).toBe(true)
      expect(impl.dev_only).toBe(false)
      expect(impl.inputs.seed_override.forceInput).toBe(true)
    })

    it('derives empty-category node paths and lifecycle badges', () => {
      const deprecated = new ComfyNodeDefImpl(
        createMockNodeDef({ category: '', deprecated: undefined })
      )
      const beta = new ComfyNodeDefImpl(
        createMockNodeDef({ experimental: true })
      )
      const dev = new ComfyNodeDefImpl(createMockNodeDef({ dev_only: true }))
      const normal = new ComfyNodeDefImpl(createMockNodeDef())

      expect(deprecated.nodePath).toBe('TestNode')
      expect(deprecated.isDummyFolder).toBe(false)
      expect(deprecated.nodeLifeCycleBadgeText).toBe('[DEPR]')
      expect(beta.nodeLifeCycleBadgeText).toBe('[BETA]')
      expect(dev.nodeLifeCycleBadgeText).toBe('[DEV]')
      expect(normal.nodeLifeCycleBadgeText).toBe('')
    })

    it('defaults missing legacy input and output fields', () => {
      const nodeDef = new ComfyNodeDefImpl(
        fromPartial<ComfyNodeDef>({
          name: 'FallbackNode',
          display_name: 'Fallback Node',
          category: 'test',
          python_module: 'test_module',
          description: 'Test node',
          output_node: false
        })
      )

      expect(nodeDef.input).toEqual({})
      expect(nodeDef.output).toEqual([])
    })

    it('post-processes search scores with node frequency', async () => {
      vi.spyOn(axios, 'get').mockResolvedValue({ data: { TestNode: 7 } })
      const frequencyStore = useNodeFrequencyStore()
      await frequencyStore.loadNodeFrequencies()
      const nodeDef = new ComfyNodeDefImpl(createMockNodeDef())

      expect(nodeDef.postProcessSearchScores([10, 4, 2])).toEqual([
        10, -7, 4, 2
      ])
    })
  })

  describe('tree helpers', () => {
    it('builds node definition trees from default and custom paths', () => {
      const nodeDef = new ComfyNodeDefImpl(
        createMockNodeDef({ name: 'TreeNode', category: 'root/branch' })
      )

      expect(buildNodeDefTree([nodeDef]).children?.[0].label).toBe('root')
      expect(
        buildNodeDefTree([nodeDef], {
          pathExtractor: (node) => ['custom', node.name]
        }).children?.[0].label
      ).toBe('custom')
    })

    it('normalizes dummy folder paths', () => {
      expect(createDummyFolderNodeDef('folder/').category).toBe('folder')
      expect(createDummyFolderNodeDef('folder').category).toBe('folder')
    })
  })

  describe('filter registry', () => {
    it('updates LiteGraph skip state for registered dev-only nodes', () => {
      const registeredNodeTypes = LiteGraph.registered_node_types
      try {
        LiteGraph.registered_node_types = {
          DevNode: {
            nodeData: { dev_only: true },
            skip_list: false
          } as typeof LGraphNode,
          NormalNode: { nodeData: {}, skip_list: false } as typeof LGraphNode
        }

        setActivePinia(createTestingPinia({ stubActions: false }))
        useNodeDefStore()

        expect(LiteGraph.registered_node_types.DevNode.skip_list).toBe(true)
        expect(LiteGraph.registered_node_types.NormalNode.skip_list).toBe(false)
      } finally {
        LiteGraph.registered_node_types = registeredNodeTypes
      }
    })

    it('should register a new filter', () => {
      const filter: NodeDefFilter = {
        id: 'test.filter',
        name: 'Test Filter',
        predicate: () => true
      }

      store.registerNodeDefFilter(filter)
      expect(store.nodeDefFilters).toContainEqual(filter)
    })

    it('should unregister a filter by id', () => {
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
    beforeEach(() => {
      // Clear existing filters for isolated tests
      store.nodeDefFilters.splice(0)
    })

    it('should apply single filter to visible nodes', () => {
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
      const nodes = [
        createMockNodeDef({ name: 'node1' }),
        createMockNodeDef({ name: 'node2' }),
        createMockNodeDef({ name: 'node3' })
      ]

      store.updateNodeDefs(nodes)
      expect(store.visibleNodeDefs).toHaveLength(3)
    })

    it('should update visibility when filter is removed', () => {
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

      // Add filter - node should be hidden
      store.registerNodeDefFilter(filter)
      expect(store.visibleNodeDefs).toHaveLength(0)

      // Remove filter - node should be visible
      store.unregisterNodeDefFilter('test.no-deprecated')
      expect(store.visibleNodeDefs).toHaveLength(1)
    })
  })

  describe('core filters behavior', () => {
    it('should hide deprecated nodes by default', () => {
      const normalNode = createMockNodeDef({
        name: 'normal',
        deprecated: false
      })
      const deprecatedNode = createMockNodeDef({
        name: 'deprecated',
        deprecated: true
      })

      store.updateNodeDefs([normalNode, deprecatedNode])

      expect(store.visibleNodeDefs).toHaveLength(1)
      expect(store.visibleNodeDefs[0].name).toBe('normal')
    })

    it('should show deprecated nodes when showDeprecated is true', () => {
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

      expect(store.visibleNodeDefs).toHaveLength(2)
    })

    it('should hide experimental nodes by default', () => {
      const normalNode = createMockNodeDef({
        name: 'normal',
        experimental: false
      })
      const experimentalNode = createMockNodeDef({
        name: 'experimental',
        experimental: true
      })

      store.updateNodeDefs([normalNode, experimentalNode])

      expect(store.visibleNodeDefs).toHaveLength(1)
      expect(store.visibleNodeDefs[0].name).toBe('normal')
    })

    it('should show experimental nodes when showExperimental is true', () => {
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

      expect(store.visibleNodeDefs).toHaveLength(2)
    })

    it('should hide subgraph nodes by default', () => {
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

      expect(store.visibleNodeDefs).toHaveLength(1)
      expect(store.visibleNodeDefs[0].name).toBe('normal')
    })

    it('should show non-subgraph nodes with subgraph category', () => {
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

      expect(store.visibleNodeDefs).toHaveLength(2)
      expect(store.visibleNodeDefs.map((n) => n.name)).toEqual([
        'normal',
        'FakeSubgraph'
      ])
    })
  })

  describe('allNodeDefsByName', () => {
    it('keeps existing ComfyNodeDefImpl instances during updates', () => {
      const nodeDef = new ComfyNodeDefImpl(
        createMockNodeDef({ name: 'ExistingImpl' })
      )

      store.updateNodeDefs([nodeDef])

      expect(store.nodeDefsByName.ExistingImpl.name).toBe('ExistingImpl')
      expect(store.nodeDefsByDisplayName['Test Node'].name).toBe('ExistingImpl')
    })

    it('adds one node definition to the name and display-name indexes', () => {
      store.addNodeDef(
        createMockNodeDef({ name: 'AddedNode', display_name: 'Added Node' })
      )

      expect(store.nodeDefsByName.AddedNode.name).toBe('AddedNode')
      expect(store.nodeDefsByDisplayName['Added Node'].name).toBe('AddedNode')
    })

    it('should include all node defs by name', () => {
      const node1 = createMockNodeDef({ name: 'Node1' })
      const node2 = createMockNodeDef({ name: 'Node2' })

      store.updateNodeDefs([node1, node2])

      expect(store.allNodeDefsByName).toHaveProperty('Node1')
      expect(store.allNodeDefsByName).toHaveProperty('Node2')
      expect(store.allNodeDefsByName['Node1'].name).toBe('Node1')
      expect(store.allNodeDefsByName['Node2'].name).toBe('Node2')
    })

    it('should include deprecated and experimental nodes', () => {
      const normal = createMockNodeDef({ name: 'Normal' })
      const deprecated = createMockNodeDef({
        name: 'Deprecated',
        deprecated: true
      })
      const experimental = createMockNodeDef({
        name: 'Experimental',
        experimental: true
      })

      store.updateNodeDefs([normal, deprecated, experimental])

      expect(store.allNodeDefsByName).toHaveProperty('Normal')
      expect(store.allNodeDefsByName).toHaveProperty('Deprecated')
      expect(store.allNodeDefsByName).toHaveProperty('Experimental')
    })

    it('should include nodes filtered out of visibleNodeDefs', () => {
      const normal = createMockNodeDef({
        name: 'Normal',
        deprecated: false
      })
      const deprecated = createMockNodeDef({
        name: 'Deprecated',
        deprecated: true
      })

      store.updateNodeDefs([normal, deprecated])

      // visibleNodeDefs filters out deprecated by default
      expect(store.visibleNodeDefs).toHaveLength(1)

      // allNodeDefsByName includes all
      expect(store.allNodeDefsByName).toHaveProperty('Normal')
      expect(store.allNodeDefsByName).toHaveProperty('Deprecated')
    })

    it('derives unique input and output data types', () => {
      store.updateNodeDefs([
        createMockNodeDef({
          input: {
            required: { image: ['IMAGE', {}] },
            optional: { mask: ['MASK', {}] }
          },
          output: ['IMAGE', 'LATENT'],
          output_is_list: [false, false],
          output_name: ['image', 'latent']
        })
      ])

      expect([...store.nodeDataTypes].sort()).toEqual([
        'IMAGE',
        'LATENT',
        'MASK'
      ])
    })

    it('looks up node definitions from graph nodes and returns null for misses', () => {
      store.updateNodeDefs([createMockNodeDef({ name: 'KnownNode' })])

      expect(
        store.fromLGraphNode(new LGraphNode('KnownNode', 'KnownNode'))?.name
      ).toBe('KnownNode')
      expect(store.fromLGraphNode(new LGraphNode('', ''))).toBeNull()
      expect(
        store.getInputSpecForWidget(new LGraphNode('Missing', 'Missing'), 'x')
      ).toBeUndefined()
      expect(store.nodeSearchService).toBeDefined()
    })
  })

  describe('subgraph widget input specs', () => {
    function setupPromotedPrompt(nodeDef: ComfyNodeDef): SubgraphNode {
      store.updateNodeDefs([nodeDef])
      const subgraph = createTestSubgraph()
      const host = createTestSubgraphNode(subgraph)
      const graph = host.graph as LGraph
      graph.add(host)

      const interior = new LGraphNode('PromptNode', 'PromptNode')
      const input = interior.addInput('prompt', 'STRING')
      const widget = interior.addWidget(
        'text',
        'prompt',
        'current edited value',
        () => undefined
      )
      input.widget = { name: widget.name }
      subgraph.add(interior)
      promoteValueWidgetViaSubgraphInput(host, interior, widget)
      return host
    }

    it('resolves the interior node definition spec, not the current value', () => {
      const host = setupPromotedPrompt(
        createMockNodeDef({
          name: 'PromptNode',
          input: {
            required: { prompt: ['STRING', { default: 'real default' }] }
          }
        })
      )

      expect(store.getInputSpecForWidget(host, 'prompt')).toMatchObject({
        name: 'prompt',
        type: 'STRING',
        default: 'real default'
      })
    })

    it('does not fabricate a default from the current promoted value', () => {
      const host = setupPromotedPrompt(
        createMockNodeDef({
          name: 'PromptNode',
          input: { required: { prompt: ['STRING', {}] } }
        })
      )

      const spec = store.getInputSpecForWidget(host, 'prompt')
      expect(spec?.type).toBe('STRING')
      expect(spec?.default).toBeUndefined()
    })

    it('returns undefined for missing promoted subgraph inputs', () => {
      const host = setupPromotedPrompt(
        createMockNodeDef({
          name: 'PromptNode',
          input: { required: { prompt: ['STRING', {}] } }
        })
      )

      expect(store.getInputSpecForWidget(host, 'missing')).toBeUndefined()
    })

    it('returns undefined when a subgraph input is not promoted', () => {
      const subgraph = createTestSubgraph()
      const host = createTestSubgraphNode(subgraph)
      host.addInput('raw', 'STRING')

      expect(store.getInputSpecForWidget(host, 'raw')).toBeUndefined()
    })

    it('returns undefined when a promoted source no longer resolves', () => {
      const host = setupPromotedPrompt(
        createMockNodeDef({
          name: 'PromptNode',
          input: { required: { prompt: ['STRING', {}] } }
        })
      )
      host.subgraph.nodes[0].widgets = []

      expect(store.getInputSpecForWidget(host, 'prompt')).toBeUndefined()
    })

    it('returns undefined when concrete promoted widget resolution fails', async () => {
      const resolver =
        await import('@/core/graph/subgraph/resolveConcretePromotedWidget')
      vi.spyOn(resolver, 'resolveConcretePromotedWidget').mockReturnValue({
        status: 'failure',
        failure: 'missing-widget'
      } as const)
      const host = setupPromotedPrompt(
        createMockNodeDef({
          name: 'PromptNode',
          input: { required: { prompt: ['STRING', {}] } }
        })
      )

      expect(store.getInputSpecForWidget(host, 'prompt')).toBeUndefined()
    })
  })

  describe('node frequency store', () => {
    it('loads frequencies once and exposes top matching node definitions', async () => {
      const get = vi.spyOn(axios, 'get').mockResolvedValue({
        data: { RankedNode: 10, MissingNode: 3 }
      })
      store.updateNodeDefs([createMockNodeDef({ name: 'RankedNode' })])
      const frequencyStore = useNodeFrequencyStore()

      await frequencyStore.loadNodeFrequencies()
      await frequencyStore.loadNodeFrequencies()

      expect(get).toHaveBeenCalledTimes(1)
      expect(frequencyStore.isLoaded).toBe(true)
      expect(frequencyStore.getNodeFrequencyByName('RankedNode')).toBe(10)
      expect(
        frequencyStore.getNodeFrequency(
          new ComfyNodeDefImpl(createMockNodeDef({ name: 'RankedNode' }))
        )
      ).toBe(10)
      expect(frequencyStore.getNodeFrequencyByName('Unknown')).toBe(0)
      expect(frequencyStore.topNodeDefs.map((nodeDef) => nodeDef.name)).toEqual(
        ['RankedNode']
      )
    })

    it('leaves frequency state unloaded when loading fails', async () => {
      const error = new Error('boom')
      vi.spyOn(axios, 'get').mockRejectedValue(error)
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const frequencyStore = useNodeFrequencyStore()

      await frequencyStore.loadNodeFrequencies()

      expect(frequencyStore.isLoaded).toBe(false)
      expect(errorSpy).toHaveBeenCalledWith(
        'Error loading node frequencies:',
        error
      )
    })
  })

  describe('performance', () => {
    it('should perform single traversal for multiple filters', () => {
      let filterCallCount = 0

      // Register multiple filters that count their calls
      for (let i = 0; i < 5; i++) {
        store.registerNodeDefFilter({
          id: `test.counter-${i}`,
          name: `Counter ${i}`,
          predicate: () => {
            filterCallCount++
            return true
          }
        })
      }

      const nodes = Array.from({ length: 10 }, (_, i) =>
        createMockNodeDef({ name: `node${i}` })
      )
      store.updateNodeDefs(nodes)

      // Force recomputation by accessing visibleNodeDefs
      expect(store.visibleNodeDefs).toBeDefined()

      // Each node (10) should be checked by each filter (5 test + 2 core = 7 total)
      expect(filterCallCount).toBe(10 * 5)
    })
  })
})
