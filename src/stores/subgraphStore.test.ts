import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { zComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'
import { ref } from 'vue'

vi.mock(import('@vueuse/router'), () => ({ useRouteHash: () => ref('') }))

import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode,
  enableSubgraphNodeCreation
} from '@comfyorg/litegraph/subgraph/__fixtures__/subgraphHelpers'
import { ChangeTracker } from '@/scripts/changeTracker'
import { ASSERTION_FAILURE_PREFIX } from '@comfyorg/shared-frontend-utils/assert'
import { useToast } from '@/components/ui/toast/toastStore'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { createCanvas } from '@comfyorg/litegraph/__fixtures__/canvasHarness'
import { TemplateIncludeOnDistributionEnum } from '@comfyorg/api-client/templateTypes'
import type { GlobalSubgraphData } from '@comfyorg/api-client/ComfyApi'
import type { UserDataFullInfo } from '@comfyorg/api-client/types'
import { resetReportedWorkflowStateAnomaliesForTests } from '@/platform/workflow/management/stores/comfyWorkflow'
import { api } from '@/scripts/api'
import { app as comfyApp } from '@/scripts/app'
import { useDialogService } from '@/services/dialogService'
import { useLitegraphService } from '@/services/litegraphService'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useSubgraphStore } from '@/stores/subgraphStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { BLUEPRINT_TYPE_PREFIX } from '@/utils/blueprintUtils'

const mockDistributionTypes = vi.hoisted(() => ({
  isCloud: false,
  isDesktop: false
}))
vi.mock(import('@/platform/distribution/types'), () => mockDistributionTypes)

vi.mock(import('@comfyorg/telemetry'))

vi.mock(import('@/scripts/api'))
vi.mock(import('@/services/dialogService'))

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: {
    canvas: {
      ds: { visible_area: [0, 0, 0, 0] },
      selected_nodes: null
    },
    loadGraphData: vi.fn()
  }
}))

const mockGraph = {
  nodes: [{ type: '123' }],
  definitions: { subgraphs: [{ id: '123' }] }
}

describe('useSubgraphStore', () => {
  let store: ReturnType<typeof useSubgraphStore>
  async function mockFetch(
    filenames: Record<string, unknown>,
    globalSubgraphs: Record<string, GlobalSubgraphData> = {}
  ) {
    vi.mocked(api.listUserDataFullInfo).mockResolvedValue(
      Object.keys(filenames).map((filename) => ({
        path: filename,
        modified: new Date().getTime(),
        size: 1 // size !== -1 for remote workflows
      }))
    )
    vi.mocked(api).getUserData = vi.fn((f) =>
      Promise.resolve({
        status: 200,
        text: () => Promise.resolve(JSON.stringify(filenames[f.slice(10)]))
      } as Response)
    )
    vi.mocked(api.getGlobalSubgraphs).mockResolvedValue(globalSubgraphs)
    return await store.fetchSubgraphs()
  }

  function userBlueprintNames() {
    return useNodeDefStore()
      .nodeDefs.filter((d) => d.category === 'Subgraph Blueprints/User')
      .map((d) => d.name)
  }

  beforeEach(() => {
    useWorkflowStore().provideChangeTracker(ChangeTracker)
    resetReportedWorkflowStateAnomaliesForTests()
    vi.mocked(useDialogService().prompt).mockResolvedValue('testname')
    vi.mocked(useDialogService().confirm).mockResolvedValue(true)
    mockDistributionTypes.isCloud = false
    mockDistributionTypes.isDesktop = false
    vi.mocked(useCanvasStore().getCanvas).mockImplementation(
      () => comfyApp.canvas
    )
    store = useSubgraphStore()
  })

  function selectSubgraphNodeToPublish() {
    const rootGraph = createTestRootGraph()
    const cleanup = enableSubgraphNodeCreation(rootGraph)
    onTestFinished(cleanup)
    const subgraph = rootGraph.createSubgraph(
      createTestSubgraph().asSerialisable()
    )
    const subgraphNode = createTestSubgraphNode(subgraph)
    const graph = subgraphNode.graph!
    graph.add(subgraphNode)
    const previousCanvas = comfyApp.canvas
    const canvas = createCanvas(graph)
    onTestFinished(() => {
      comfyApp.canvas = previousCanvas
      canvas.unbindEvents()
      canvas.canvas.remove()
    })
    comfyApp.canvas = canvas
    canvas.selectItems([subgraphNode])
    vi.mocked(api.storeUserData).mockResolvedValue(
      Response.json({
        path: 'subgraphs/testname.json',
        modified: Date.now(),
        size: 2
      })
    )
    return { subgraph, subgraphNode }
  }

  it.for([
    { confirmed: true, storeCalls: 1 },
    { confirmed: false, storeCalls: 0 }
  ])(
    'requires confirmation before replacing an unloaded blueprint (confirmed: $confirmed)',
    async ({ confirmed, storeCalls }) => {
      selectSubgraphNodeToPublish()
      vi.mocked(useDialogService().confirm).mockResolvedValue(confirmed)
      vi.mocked(api.listUserDataFullInfo).mockResolvedValue([
        { path: 'testname.json', modified: 1, size: 1 }
      ])
      vi.mocked(api.getUserData).mockImplementation(async () =>
        Response.json(mockGraph)
      )
      await store.publishSubgraph()
      expect(useDialogService().confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'overwriteBlueprint',
          itemList: ['testname']
        })
      )
      expect(api.storeUserData).toHaveBeenCalledTimes(storeCalls)
    }
  )
  it('publishes a new filename without overwrite confirmation', async () => {
    const { subgraph } = selectSubgraphNodeToPublish()
    vi.mocked(api.listUserDataFullInfo).mockResolvedValue([
      { path: 'another-blueprint.json', modified: 1, size: 1 }
    ])
    vi.mocked(api.getUserData).mockImplementation(async () =>
      Response.json(mockGraph)
    )

    await store.publishSubgraph()

    expect(useDialogService().confirm).not.toHaveBeenCalled()
    expect(api.storeUserData).toHaveBeenCalledExactlyOnceWith(
      'subgraphs/testname.json',
      expect.any(String),
      expect.anything()
    )
    const saved = zComfyWorkflow.parse(
      JSON.parse(String(vi.mocked(api.storeUserData).mock.calls[0][1]))
    )
    expect(saved.nodes).toEqual([
      expect.objectContaining({ type: subgraph.id, title: 'testname' })
    ])
    expect(saved.definitions?.subgraphs).toEqual([
      expect.objectContaining({ id: subgraph.id })
    ])
  })

  it('does not publish when existing filenames cannot be checked', async () => {
    selectSubgraphNodeToPublish()
    const listingError = new Error('Blueprint listing unavailable')
    vi.mocked(api.listUserDataFullInfo).mockRejectedValue(listingError)

    await store.publishSubgraph()

    expect(reportError).toHaveBeenCalledExactlyOnceWith(listingError, {
      errorType: 'error_checking_blueprint_overwrite',
      surface: 'graph'
    })
    expect(api.storeUserData).not.toHaveBeenCalled()
    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        kind: 'error',
        description: 'Blueprint listing unavailable'
      })
    ])
  })

  it('should display published nodes in the node library', async () => {
    await mockFetch({ 'test.json': mockGraph })
    expect(userBlueprintNames()).toEqual(['SubgraphBlueprint.test'])
  })
  it.for([false, true])(
    'loads blueprint boundary inputs when object info is trusted: %s',
    async (isTrusted) => {
      mockDistributionTypes.isCloud = isTrusted

      await mockFetch({
        'dynamic-boundaries.json': {
          ...mockGraph,
          nodes: [
            {
              type: '123',
              inputs: [
                { name: 'autogrow', type: 'COMFY_AUTOGROW_V3', link: null },
                { name: 'match', type: 'COMFY_MATCHTYPE_V3', link: null },
                { name: 'group', type: 'COMFY_DYNAMICGROUP_V3', link: null },
                { name: 'image', type: 'IMAGE', link: null }
              ],
              outputs: [
                { name: 'matched', type: 'COMFY_MATCHTYPE_V3', links: null },
                { name: 'image', type: 'IMAGE', links: null }
              ]
            }
          ]
        }
      })

      const blueprintDef = useNodeDefStore().nodeDefs.find(
        (def) => def.name === 'SubgraphBlueprint.dynamic-boundaries'
      )
      expect(blueprintDef).toBeDefined()
      expect(blueprintDef?.inputTypes).toEqual(['IMAGE'])
      expect(blueprintDef?.outputTypes).toEqual(['IMAGE'])
    }
  )
  it('should remove deleted blueprints from the node library', async () => {
    await mockFetch({ 'test.json': mockGraph })
    await store.deleteBlueprint('SubgraphBlueprint.test')
    expect(api.deleteUserData).toHaveBeenCalledWith('subgraphs/test.json')
    expect(userBlueprintNames()).toEqual([])
  })
  it('should allow subgraphs to be edited', async () => {
    await mockFetch({ 'test.json': mockGraph })
    await store.editBlueprint(BLUEPRINT_TYPE_PREFIX + 'test')
    //check active graph
    expect(comfyApp.loadGraphData).toHaveBeenCalled()
  })
  it('should allow subgraphs to be added to graph', async () => {
    const { subgraphNode } = selectSubgraphNodeToPublish()
    const graph = subgraphNode.graph!
    await mockFetch({ 'test.json': graph.serialize() })
    graph.remove(subgraphNode)
    const nodeDef = useNodeDefStore().nodeDefs.find(
      (definition) => definition.name === 'SubgraphBlueprint.test'
    )
    assert.exists(nodeDef)

    const inserted = useLitegraphService().addNodeOnGraph(nodeDef)

    assert.exists(inserted)
    expect(graph.nodes).toEqual([inserted])
    expect(inserted.title).toBe('test')
  })
  it('should return a deep copy from getBlueprint so mutations do not corrupt the cache', async () => {
    await mockFetch({ 'test.json': mockGraph })
    const first = store.getBlueprint(BLUEPRINT_TYPE_PREFIX + 'test')
    first.nodes[0].id = -1
    first.definitions!.subgraphs[0].id = 'corrupted'

    const second = store.getBlueprint(BLUEPRINT_TYPE_PREFIX + 'test')
    expect(second.nodes[0].id).not.toBe(-1)
    expect(second.definitions!.subgraphs[0].id).toBe('123')
  })
  it('should identify user blueprints as non-global', async () => {
    await mockFetch({ 'test.json': mockGraph })
    expect(store.isGlobalBlueprint('test')).toBe(false)
  })
  it('should identify global blueprints loaded from getGlobalSubgraphs', async () => {
    await mockFetch(
      {},
      {
        global_test: {
          name: 'Global Test Blueprint',
          info: { node_pack: 'comfy_essentials' },
          data: JSON.stringify(mockGraph)
        }
      }
    )
    expect(store.isGlobalBlueprint('global_test')).toBe(true)
  })
  it('should return false for non-existent blueprints', async () => {
    await mockFetch({ 'test.json': mockGraph })
    expect(store.isGlobalBlueprint('nonexistent')).toBe(false)
  })

  describe('isUserBlueprint', () => {
    it('should return true for user blueprints', async () => {
      await mockFetch({ 'test.json': mockGraph })
      expect(store.isUserBlueprint('SubgraphBlueprint.test')).toBe(true)
    })

    it('should return false for global blueprints', async () => {
      await mockFetch(
        {},
        {
          global_bp: {
            name: 'Global Blueprint',
            info: { node_pack: 'comfy_essentials' },
            data: JSON.stringify(mockGraph)
          }
        }
      )
      expect(store.isUserBlueprint('SubgraphBlueprint.global_bp')).toBe(false)
    })

    it('should return false for non-blueprint node types', () => {
      expect(store.isUserBlueprint('KSampler')).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(store.isUserBlueprint(undefined)).toBe(false)
    })
  })

  describe('blueprint badge display', () => {
    it('should set isGlobal flag on global blueprints', async () => {
      await mockFetch(
        {},
        {
          global_bp: {
            name: 'Global Blueprint',
            info: { node_pack: 'some-uuid-string' },
            data: JSON.stringify(mockGraph)
          }
        }
      )
      const nodeDef = useNodeDefStore().nodeDefs.find(
        (d) => d.name === 'SubgraphBlueprint.global_bp'
      )
      expect(nodeDef).toBeDefined()
      expect(nodeDef?.isGlobal).toBe(true)
    })

    it('should not set isGlobal flag on user blueprints', async () => {
      await mockFetch({ 'user-blueprint.json': mockGraph })
      const nodeDef = useNodeDefStore().nodeDefs.find(
        (d) => d.name === 'SubgraphBlueprint.user-blueprint'
      )
      expect(nodeDef).toBeDefined()
      expect(nodeDef?.isGlobal).toBeUndefined()
    })

    it('should use blueprint python_module for global blueprints to show Blueprint badge', async () => {
      await mockFetch(
        {},
        {
          global_bp: {
            name: 'Global Blueprint',
            info: { node_pack: 'comfyui-ltx-video-0fbc55c6-long-uuid' },
            data: JSON.stringify(mockGraph)
          }
        }
      )
      const nodeDef = useNodeDefStore().nodeDefs.find(
        (d) => d.name === 'SubgraphBlueprint.global_bp'
      )
      expect(nodeDef).toBeDefined()
      expect(nodeDef?.python_module).toBe('blueprint')
      expect(nodeDef?.nodeSource.displayText).toBe('Blueprint')
    })
  })

  it('should handle global blueprint with empty data gracefully', async () => {
    await mockFetch(
      {},
      {
        broken_blueprint: {
          name: 'Broken Blueprint',
          info: { node_pack: 'test_pack' },
          data: ''
        }
      }
    )
    expect(console.error).toHaveBeenCalledWith(
      'Failed to load subgraph blueprint',
      expect.any(Error)
    )
    expect(useNodeDefStore().blueprintNodeDefsByName.size).toBe(0)
  })

  it.for([
    {
      source: 'user',
      failedListing: 'listUserDataFullInfo',
      survivingBlueprint: 'SubgraphBlueprint.installed_test'
    },
    {
      source: 'installed',
      failedListing: 'getGlobalSubgraphs',
      survivingBlueprint: 'SubgraphBlueprint.user_test'
    }
  ] as const)(
    'loads the other blueprint source and reports a failed $source listing',
    async ({ failedListing, survivingBlueprint }) => {
      vi.mocked(api[failedListing]).mockRejectedValueOnce(
        new Error('Listing failed')
      )

      await mockFetch(
        { 'user_test.json': mockGraph },
        {
          installed_test: {
            name: 'Installed Test',
            info: { node_pack: 'test_pack' },
            data: JSON.stringify(mockGraph)
          }
        }
      )

      expect([...useNodeDefStore().blueprintNodeDefsByName.keys()]).toEqual([
        survivingBlueprint
      ])
      expect(useToast().toasts).toEqual([
        expect.objectContaining({
          description: 'Listing failed',
          kind: 'error'
        })
      ])
    }
  )

  it('does not report an empty user blueprint as a load failure', async () => {
    const userBlueprints = [
      {
        path: 'Image Edit.json/move/subgraphs/my subgraph.json',
        content: ''
      },
      { path: 'corrupt.json', content: '{' },
      { path: 'kept.json', content: JSON.stringify(mockGraph) },
      {
        path: 'unsized.json',
        content: JSON.stringify(mockGraph),
        listsSize: false
      }
    ]
    vi.mocked(api.listUserDataFullInfo).mockResolvedValue(
      userBlueprints.map(({ path, content, listsSize }) =>
        listsSize === false
          ? fromPartial<UserDataFullInfo>({ path, modified: Date.now() })
          : { path, modified: Date.now(), size: content.length }
      )
    )
    vi.mocked(api.getUserData).mockImplementation(async (file) => {
      const blueprint = userBlueprints.find(
        ({ path }) => `subgraphs/${path}` === file
      )
      return new Response(blueprint?.content ?? '', { status: 200 })
    })
    vi.mocked(api.getGlobalSubgraphs).mockResolvedValue({})

    await store.fetchSubgraphs()

    expect(userBlueprintNames()).toEqual(
      expect.arrayContaining([
        'SubgraphBlueprint.kept',
        'SubgraphBlueprint.unsized'
      ])
    )
    expect(userBlueprintNames()).toHaveLength(2)
    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        kind: 'error',
        description: 'Workflow content is not valid JSON'
      })
    ])
    expect(console.error).toHaveBeenCalledWith(
      `${ASSERTION_FAILURE_PREFIX}Workflow content is not valid JSON`
    )
    expect(console.error).not.toHaveBeenCalledWith(
      `${ASSERTION_FAILURE_PREFIX}Workflow content is missing or empty`
    )
  })

  it('should handle global blueprint with rejected data promise gracefully', async () => {
    await mockFetch(
      {},
      {
        failing_blueprint: {
          name: 'Failing Blueprint',
          info: { node_pack: 'test_pack' },
          data: fromAny<string, unknown>(
            Promise.reject(new Error('Network error'))
          )
        }
      }
    )
    expect(console.error).toHaveBeenCalledWith(
      'Failed to load subgraph blueprint',
      expect.any(Error)
    )
    expect(useToast().toasts).toEqual([
      expect.objectContaining({ description: 'Network error', kind: 'error' })
    ])
    expect(useNodeDefStore().blueprintNodeDefsByName.size).toBe(0)
  })

  it('should load valid global blueprints even when others fail', async () => {
    await mockFetch(
      {},
      {
        broken: {
          name: 'Broken',
          info: { node_pack: 'test_pack' },
          data: ''
        },
        valid: {
          name: 'Valid Blueprint',
          info: { node_pack: 'test_pack' },
          data: JSON.stringify(mockGraph)
        }
      }
    )
    expect(console.error).toHaveBeenCalled()
    expect(useNodeDefStore().blueprintNodeDefsByName.size).toBe(1)
  })

  describe('search_aliases support', () => {
    it('should include search_aliases from workflow extra', async () => {
      const mockGraphWithAliases = {
        nodes: [{ type: '123' }],
        definitions: {
          subgraphs: [{ id: '123' }]
        },
        extra: {
          BlueprintSearchAliases: ['alias1', 'alias2', 'my workflow']
        }
      }
      await mockFetch({ 'test-with-aliases.json': mockGraphWithAliases })

      const nodeDef = useNodeDefStore().nodeDefs.find(
        (d) => d.name === 'SubgraphBlueprint.test-with-aliases'
      )
      expect(nodeDef).toBeDefined()
      expect(nodeDef?.search_aliases).toEqual([
        'alias1',
        'alias2',
        'my workflow'
      ])
    })

    it('should include search_aliases from global blueprint info', async () => {
      await mockFetch(
        {},
        {
          global_with_aliases: {
            name: 'Global With Aliases',
            info: {
              node_pack: 'comfy_essentials',
              search_aliases: ['global alias', 'test alias']
            },
            data: JSON.stringify(mockGraph)
          }
        }
      )

      const nodeDef = useNodeDefStore().nodeDefs.find(
        (d) => d.name === 'SubgraphBlueprint.global_with_aliases'
      )
      expect(nodeDef).toBeDefined()
      expect(nodeDef?.search_aliases).toEqual(['global alias', 'test alias'])
    })

    it('should not have search_aliases if not provided', async () => {
      await mockFetch({ 'test.json': mockGraph })

      const nodeDef = useNodeDefStore().nodeDefs.find(
        (d) => d.name === 'SubgraphBlueprint.test'
      )
      expect(nodeDef).toBeDefined()
      expect(nodeDef?.search_aliases).toBeUndefined()
    })

    it('should include description from workflow extra', async () => {
      const mockGraphWithDescription = {
        nodes: [{ type: '123' }],
        definitions: {
          subgraphs: [{ id: '123' }]
        },
        extra: {
          BlueprintDescription: 'This is a test blueprint'
        }
      }
      await mockFetch({
        'test-with-description.json': mockGraphWithDescription
      })

      const nodeDef = useNodeDefStore().nodeDefs.find(
        (d) => d.name === 'SubgraphBlueprint.test-with-description'
      )
      expect(nodeDef).toBeDefined()
      expect(nodeDef?.description).toBe('This is a test blueprint')
    })

    it('should not duplicate metadata in both workflow extra and subgraph extra when publishing', async () => {
      const { subgraph } = selectSubgraphNodeToPublish()
      subgraph.extra = {
        BlueprintDescription: 'Test description',
        BlueprintSearchAliases: ['alias1', 'alias2']
      }

      await mockFetch({ 'testname.json': mockGraph })
      await store.publishSubgraph()

      expect(api.storeUserData).toHaveBeenCalledOnce()
      const savedWorkflowData = zComfyWorkflow.parse(
        JSON.parse(String(vi.mocked(api.storeUserData).mock.calls[0][1]))
      )
      expect(savedWorkflowData.extra).toEqual({
        BlueprintDescription: 'Test description',
        BlueprintSearchAliases: ['alias1', 'alias2']
      })

      const subgraphExtra = savedWorkflowData.definitions?.subgraphs[0]?.extra
      expect(subgraphExtra?.BlueprintDescription).toBeUndefined()
      expect(subgraphExtra?.BlueprintSearchAliases).toBeUndefined()
    })
  })

  describe('subgraph definition category', () => {
    it('should use category from subgraph definition as default', async () => {
      const mockGraphWithCategory = {
        nodes: [{ type: '123' }],
        definitions: {
          subgraphs: [{ id: '123', category: 'Image Processing' }]
        }
      }
      await mockFetch(
        {},
        {
          categorized: {
            name: 'Categorized Blueprint',
            info: { node_pack: 'test_pack' },
            data: JSON.stringify(mockGraphWithCategory)
          }
        }
      )

      const nodeDef = useNodeDefStore().nodeDefs.find(
        (d) => d.name === 'SubgraphBlueprint.categorized'
      )
      expect(nodeDef).toBeDefined()
      expect(nodeDef?.category).toBe('Subgraph Blueprints/Image Processing')
    })

    it('should use User override for user blueprints even with definition category', async () => {
      const mockGraphWithCategory = {
        nodes: [{ type: '123' }],
        definitions: {
          subgraphs: [{ id: '123', category: 'Image Processing' }]
        }
      }
      await mockFetch({ 'user-bp.json': mockGraphWithCategory })

      const nodeDef = useNodeDefStore().nodeDefs.find(
        (d) => d.name === 'SubgraphBlueprint.user-bp'
      )
      expect(nodeDef).toBeDefined()
      expect(nodeDef?.category).toBe('Subgraph Blueprints/User')
    })

    it('should fallback to bare Subgraph Blueprints when no category anywhere', async () => {
      await mockFetch(
        {},
        {
          no_cat_global: {
            name: 'No Category Global',
            info: { node_pack: 'test_pack' },
            data: JSON.stringify(mockGraph)
          }
        }
      )

      const nodeDef = useNodeDefStore().nodeDefs.find(
        (d) => d.name === 'SubgraphBlueprint.no_cat_global'
      )
      expect(nodeDef).toBeDefined()
      expect(nodeDef?.category).toBe('Subgraph Blueprints')
    })

    it('should let overrides take precedence over definition category', async () => {
      const mockGraphWithCategory = {
        nodes: [{ type: '123' }],
        definitions: {
          subgraphs: [{ id: '123', category: 'Image Processing' }]
        }
      }
      await mockFetch(
        {},
        {
          bp_override: {
            name: 'Override Blueprint',
            info: {
              node_pack: 'test_pack',
              category: 'Custom Category'
            },
            data: JSON.stringify(mockGraphWithCategory)
          }
        }
      )

      const nodeDef = useNodeDefStore().nodeDefs.find(
        (d) => d.name === 'SubgraphBlueprint.bp_override'
      )
      expect(nodeDef).toBeDefined()
      expect(nodeDef?.category).toBe('Subgraph Blueprints/Custom Category')
    })
  })

  describe('essentials_category passthrough', () => {
    it('should prefer GlobalSubgraphData essentials_category over definition fallback', async () => {
      const graphWithEssentials = {
        ...mockGraph,
        definitions: {
          subgraphs: [
            {
              ...mockGraph.definitions.subgraphs[0],
              essentials_category: 'Image Tools'
            }
          ]
        }
      }
      await mockFetch(
        {},
        {
          bp_precedence: {
            name: 'Precedence Blueprint',
            info: { node_pack: 'test_pack' },
            data: JSON.stringify(graphWithEssentials),
            essentials_category: 'Video Generation'
          }
        }
      )
      const nodeDef = useNodeDefStore().nodeDefs.find(
        (d) => d.name === 'SubgraphBlueprint.bp_precedence'
      )
      expect(nodeDef?.essentials_category).toBe('Video Generation')
    })

    it('should pass essentials_category from GlobalSubgraphData to node def', async () => {
      await mockFetch(
        {},
        {
          bp_essentials: {
            name: 'Test Essentials Blueprint',
            info: { node_pack: 'test_pack', category: 'Test Category' },
            data: JSON.stringify(mockGraph),
            essentials_category: 'Image Generation'
          }
        }
      )
      const nodeDef = useNodeDefStore().nodeDefs.find(
        (d) => d.name === 'SubgraphBlueprint.bp_essentials'
      )
      expect(nodeDef).toBeDefined()
      expect(nodeDef?.essentials_category).toBe('Image Generation')
    })
  })

  describe('global blueprint filtering', () => {
    function globalBlueprint(
      overrides: Partial<GlobalSubgraphData['info']> = {}
    ): GlobalSubgraphData {
      return {
        name: 'Filtered Blueprint',
        info: { node_pack: 'test_pack', ...overrides },
        data: JSON.stringify(mockGraph)
      }
    }

    it('should exclude blueprints with requiresCustomNodes on non-cloud', async () => {
      await mockFetch(
        {},
        {
          bp: globalBlueprint({ requiresCustomNodes: ['custom-node-pack'] })
        }
      )
      expect(store.isGlobalBlueprint('bp')).toBe(false)
    })

    it('should include blueprints with requiresCustomNodes on cloud', async () => {
      mockDistributionTypes.isCloud = true
      await mockFetch(
        {},
        {
          bp: globalBlueprint({ requiresCustomNodes: ['custom-node-pack'] })
        }
      )
      expect(store.isGlobalBlueprint('bp')).toBe(true)
    })

    it('should include blueprints with empty requiresCustomNodes everywhere', async () => {
      await mockFetch({}, { bp: globalBlueprint({ requiresCustomNodes: [] }) })
      expect(store.isGlobalBlueprint('bp')).toBe(true)
    })

    it('should exclude blueprints whose includeOnDistributions does not match', async () => {
      await mockFetch(
        {},
        {
          bp: globalBlueprint({
            includeOnDistributions: [TemplateIncludeOnDistributionEnum.Cloud]
          })
        }
      )
      expect(store.isGlobalBlueprint('bp')).toBe(false)
    })

    it('should include blueprints whose includeOnDistributions matches current distribution', async () => {
      await mockFetch(
        {},
        {
          bp: globalBlueprint({
            includeOnDistributions: [TemplateIncludeOnDistributionEnum.Local]
          })
        }
      )
      expect(store.isGlobalBlueprint('bp')).toBe(true)
    })

    it('should include blueprints on desktop when includeOnDistributions has desktop', async () => {
      mockDistributionTypes.isDesktop = true
      await mockFetch(
        {},
        {
          bp: globalBlueprint({
            includeOnDistributions: [TemplateIncludeOnDistributionEnum.Desktop]
          })
        }
      )
      expect(store.isGlobalBlueprint('bp')).toBe(true)
    })

    it('should include blueprints with no filtering fields', async () => {
      await mockFetch({}, { bp: globalBlueprint() })
      expect(store.isGlobalBlueprint('bp')).toBe(true)
    })
  })
})
