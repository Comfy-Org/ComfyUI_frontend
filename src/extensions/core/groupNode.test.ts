import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { assert, describe, expect, it, test, vi } from 'vitest'

import { t } from '@/i18n'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestRootGraph,
  createTestSubgraph
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { ComfyNode } from '@comfyorg/graph-model/workflowSchema'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import type { ComfyNodeDef } from '@comfyorg/object-info-parser'
import { reportError } from '@comfyorg/telemetry/reportError'
import { app } from '@/scripts/app'
import { ComfyWidgets } from '@/scripts/widgets'
import { useLitegraphService } from '@/services/litegraphService'
import { useSubgraphService } from '@/services/subgraphService'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useWidgetStore } from '@/stores/widgetStore'

import type { MissingNodeType } from '@/platform/workflowErrors/nodeReplacement/types'

import type { GroupNodeLink, GroupNodeWorkflowData } from './groupNode'

vi.mock(import('@/scripts/app'))

const {
  GroupNodeConfig,
  GroupNodeHandler,
  findUnconsumedWidgetIndex,
  replaceLegacySeparators,
  groupNodeExtension
} = await import('./groupNode')

function makeNode(type: string) {
  return {
    id: 1,
    type,
    pos: [0, 0],
    size: [1, 1],
    flags: {},
    order: 0,
    mode: 0,
    properties: {}
  } satisfies ComfyNode
}

describe('replaceLegacySeparators', () => {
  it('rewrites the legacy "workflow/" prefix to "workflow>"', () => {
    const nodes = [makeNode('workflow/My Group')]
    replaceLegacySeparators(nodes)
    expect(nodes[0].type).toBe('workflow>My Group')
  })

  it('leaves already-migrated and non-group types untouched', () => {
    const nodes = [makeNode('workflow>My Group'), makeNode('KSampler')]
    replaceLegacySeparators(nodes)
    expect(nodes.map((n) => n.type)).toEqual(['workflow>My Group', 'KSampler'])
  })

  it('only strips the leading prefix, preserving inner "workflow/" text', () => {
    const nodes = [makeNode('workflow/nested/workflow/name')]
    replaceLegacySeparators(nodes)
    expect(nodes[0].type).toBe('workflow>nested/workflow/name')
  })
})

describe('GroupNodeConfig.getLinks', () => {
  function configFrom(
    links: GroupNodeLink[],
    external: (number | string)[][] = []
  ) {
    const nodeData: GroupNodeWorkflowData = {
      nodes: [
        { index: 0, type: 'EmptyLatentImage' },
        { index: 1, type: 'CheckpointLoaderSimple' },
        { index: 2, type: 'CLIPTextEncode' },
        { index: 3, type: 'CLIPTextEncode' },
        { index: 4, type: 'KSampler' }
      ],
      links,
      external
    }
    return new GroupNodeConfig('group', nodeData)
  }

  it('indexes outgoing links by [origin index][origin slot]', () => {
    const clip = [1, 1, 2, 0, 4, 'CLIP'] satisfies GroupNodeLink
    const model = [1, 0, 4, 0, 4, 'MODEL'] satisfies GroupNodeLink
    const config = configFrom([clip, model])

    expect(config.linksFrom).toEqual({ 1: { 1: [clip], 0: [model] } })
  })

  it('indexes incoming links by [target index][target slot]', () => {
    const clip = [1, 1, 2, 0, 4, 'CLIP'] satisfies GroupNodeLink
    const cond = [2, 0, 4, 1, 6, 'CONDITIONING'] satisfies GroupNodeLink
    const config = configFrom([clip, cond])

    expect(config.linksTo).toEqual({ 2: { 0: clip }, 4: { 1: cond } })
  })

  it('accumulates multiple fan-out links from the same origin slot', () => {
    const toPos = [1, 1, 2, 0, 4, 'CLIP'] satisfies GroupNodeLink
    const toNeg = [1, 1, 3, 0, 5, 'CLIP'] satisfies GroupNodeLink
    const config = configFrom([toPos, toNeg])

    expect(config.linksFrom).toEqual({ 1: { 1: [toPos, toNeg] } })
  })

  it('skips links that have a null endpoint', () => {
    const valid = [1, 1, 2, 0, 4, 'CLIP'] satisfies GroupNodeLink
    const broken = [null, 1, 2, 0, 4, 'CLIP'] satisfies GroupNodeLink
    const config = configFrom([valid, broken])

    expect(config.linksFrom).toEqual({ 1: { 1: [valid] } })
  })

  it('maps external links by [node index][slot] to their type', () => {
    const config = configFrom([], [[0, 1, 'IMAGE']])
    expect(config.externalFrom).toEqual({ 0: { 1: 'IMAGE' } })
  })

  it('normalizes a missing primitive link type to null', () => {
    const linkWithoutType = [0, 0, 1, 0, 1] satisfies GroupNodeLink
    const config = configFrom([linkWithoutType])

    expect(
      config.getNodeDef({ index: 0, type: 'PrimitiveNode' })?.output
    ).toEqual([null])
  })

  test.for([
    { case: 'an object', invalidType: { unexpected: true } },
    { case: 'a non-string array', invalidType: ['IMAGE', 42] }
  ])(
    'normalizes an invalid primitive link type given as $case to null',
    ({ invalidType }) => {
      const link = [0, 0, 1, 0, 1, invalidType] satisfies GroupNodeLink
      const config = configFrom([link])

      expect(
        config.getNodeDef({ index: 0, type: 'PrimitiveNode' })?.output
      ).toEqual([null])
    }
  )
})

describe('findUnconsumedWidgetIndex', () => {
  it('pairs same-named widgets to distinct originating nodes in request order', () => {
    // Two inner nodes (e.g. two CLIPTextEncode nodes both exposing `text`)
    // that end up sharing an outer widget name. A plain `findIndex` by name
    // would resolve both to the first "text" widget, copying that node's
    // value into both inner nodes.
    const outerWidgets = [
      { name: 'text' },
      { name: 'text' },
      { name: 'denoise' }
    ]
    const consumed = new Set<number>()

    const firstMatch = findUnconsumedWidgetIndex(outerWidgets, 'text', consumed)
    expect(firstMatch).toBe(0)
    consumed.add(firstMatch)

    const secondMatch = findUnconsumedWidgetIndex(
      outerWidgets,
      'text',
      consumed
    )
    expect(secondMatch).toBe(1)
  })

  it('never re-matches an index already recorded as consumed, even for a genuine name collision', () => {
    const outerWidgets = [{ name: 'text' }, { name: 'text' }, { name: 'text' }]
    const consumed = new Set<number>()

    const indices = [0, 1, 2].map(() => {
      const index = findUnconsumedWidgetIndex(outerWidgets, 'text', consumed)
      consumed.add(index)
      return index
    })

    expect(indices).toEqual([0, 1, 2])

    // A fourth request has nothing left to consume.
    expect(findUnconsumedWidgetIndex(outerWidgets, 'text', consumed)).toBe(-1)
  })

  it('ignores consumed indices and matches by name otherwise', () => {
    const outerWidgets = [{ name: 'denoise' }, { name: 'filename_prefix' }]

    expect(
      findUnconsumedWidgetIndex(outerWidgets, 'filename_prefix', new Set())
    ).toBe(1)
    expect(
      findUnconsumedWidgetIndex(outerWidgets, 'denoise', new Set([0]))
    ).toBe(-1)
    expect(findUnconsumedWidgetIndex(undefined, 'denoise', new Set())).toBe(-1)
  })
})

describe('GroupNodeConfig.processInputSlots', () => {
  it('maps exposed inputs by name instead of definition index', () => {
    const config = new GroupNodeConfig('group', {
      nodes: [{ index: 0, type: 'KSampler' }],
      links: [],
      external: []
    })
    const inputMap: Record<string, number> = {}

    config.processInputSlots(
      {
        model: ['MODEL', {}],
        latent_image: ['LATENT', {}]
      },
      { index: 0, type: 'KSampler' },
      ['model', 'latent_image'],
      {},
      inputMap,
      {}
    )

    expect(inputMap).toEqual({ model: 0, latent_image: 1 })
  })

  it('falls back to the positional slot index when the synthesized input name matches no real input name (e.g. Reroute)', () => {
    // A Reroute's def is keyed by type (e.g. 'MODEL'), but its real slot is
    // unnamed (`addInput('', '*')`), so the name lookup always misses.
    const config = new GroupNodeConfig('group', {
      nodes: [{ index: 0, type: 'Reroute' }],
      links: [],
      external: []
    })
    const inputMap: Record<string, number> = {}
    const link: GroupNodeLink = [null, 0, 0, 0, 0, 'MODEL']

    config.processInputSlots(
      { MODEL: ['MODEL', {}] },
      fromPartial({ index: 0, type: 'Reroute', inputs: [{ name: '' }] }),
      ['MODEL'],
      { 0: link },
      inputMap,
      {}
    )

    // Recognized as internally linked via the positional fallback, so it's
    // skipped rather than wrongly exposed as an external group input.
    expect(inputMap).toEqual({})
  })
})

describe('GroupNodeConfig.processWidgetInputs', () => {
  it('keeps a forceInput combo as a slot, never a widget', () => {
    const config = new GroupNodeConfig('group', {
      nodes: [{ index: 0, type: 'KSampler' }],
      links: [],
      external: []
    })

    const { slots, converted } = config.processWidgetInputs(
      {
        sampler_name: [['euler', 'ddim'], { forceInput: true }],
        steps: ['INT', {}]
      },
      { index: 0, type: 'KSampler' },
      ['sampler_name', 'steps'],
      {}
    )

    expect(slots).toEqual(['sampler_name'])
    expect(converted.size).toBe(0)
  })
})

describe('GroupNodeConfig.processConvertedWidgets', () => {
  it('orders converted widgets by numeric slot index, not lexically', () => {
    const config = new GroupNodeConfig('group', {
      nodes: [{ index: 0, type: 'KSampler' }],
      links: [],
      external: []
    })
    const inputMap: Record<string, number> = {}

    config.processConvertedWidgets(
      { seed: ['INT', {}], steps: ['INT', {}], cfg: ['FLOAT', {}] },
      { index: 0, type: 'KSampler' },
      new Map([
        [10, 'cfg'],
        [2, 'steps'],
        [1, 'seed']
      ]),
      {},
      inputMap,
      {}
    )

    expect(inputMap).toEqual({ seed: 0, steps: 1, cfg: 2 })
  })

  it('resolves a converted widget link by its own serialized slot index, not its position among converted widgets', () => {
    const config = new GroupNodeConfig('group', {
      nodes: [{ index: 0, type: 'KSampler' }],
      links: [],
      external: []
    })
    const inputMap: Record<string, number> = {}
    const link: GroupNodeLink = [null, 0, 0, 0, 0, 'INT']

    config.processConvertedWidgets(
      { b: ['INT', {}] },
      { index: 0, type: 'KSampler' },
      // The converted widget's real slot index is 5 (the map key), which
      // doesn't equal `slots.length + i` for any plausible `slots` this
      // node could have had.
      new Map([[5, 'b']]),
      { 5: link },
      inputMap,
      {}
    )

    // Recognized as internally linked by its real slot index, so it's
    // skipped rather than wrongly exposed as an external group input.
    expect(inputMap).toEqual({})
  })
})

describe('GroupNodeConfig.registerFromWorkflow', () => {
  function groupWithMissingInnerNodes(
    types: string[] = ['NotInstalledNode']
  ): Record<string, GroupNodeWorkflowData> {
    return fromPartial({
      MyGroup: {
        nodes: types.map((type, index) => ({ index, type })),
        links: [],
        external: []
      }
    })
  }

  it('backs each report with a canvas instance id when the map is provided', async () => {
    const missing: MissingNodeType[] = []

    await GroupNodeConfig.registerFromWorkflow(
      groupWithMissingInnerNodes(),
      missing,
      new Map([['MyGroup', [7, 9]]])
    )

    expect(missing).toStrictEqual([
      expect.objectContaining({
        type: 'workflow>MyGroup',
        nodeId: '7',
        hint: t('g.missingNodeTypesInGroup', { types: 'NotInstalledNode' })
      }),
      expect.objectContaining({
        type: 'workflow>MyGroup',
        nodeId: '9',
        hint: t('g.missingNodeTypesInGroup', { types: 'NotInstalledNode' })
      })
    ])
  })

  it('deduplicates repeated missing inner types in each report', async () => {
    const missing: MissingNodeType[] = []

    await GroupNodeConfig.registerFromWorkflow(
      groupWithMissingInnerNodes([
        'NotInstalledNode',
        'AnotherMissingNode',
        'NotInstalledNode'
      ]),
      missing,
      new Map([['MyGroup', [7]]])
    )

    expect(missing).toStrictEqual([
      expect.objectContaining({
        type: 'workflow>MyGroup',
        nodeId: '7',
        hint: t('g.missingNodeTypesInGroup', {
          types: 'NotInstalledNode, AnotherMissingNode'
        })
      })
    ])
  })

  it('emits nothing for a missing group with no canvas instances when the map is provided', async () => {
    const missing: MissingNodeType[] = []

    await GroupNodeConfig.registerFromWorkflow(
      groupWithMissingInnerNodes(),
      missing,
      new Map()
    )

    expect(missing).toStrictEqual([])
  })

  it('removes a prior same-name group type before reporting missing nodes', async () => {
    const groupType = 'workflow>MyGroup'
    const missing: MissingNodeType[] = []
    vi.mocked(app.registerNodeDef).mockImplementation(
      async (typeName, nodeDef) => {
        class PreviousGroupNode extends LGraphNode {
          static override nodeData = nodeDef
        }
        LiteGraph.registerNodeType(typeName, PreviousGroupNode)
      }
    )

    await GroupNodeConfig.registerFromWorkflow(
      {
        MyGroup: {
          nodes: [],
          links: [],
          external: []
        }
      },
      []
    )
    const previousGroupNode = LiteGraph.createNode(groupType)
    if (!previousGroupNode) throw new Error('group type not registered')
    expect(GroupNodeHandler.isGroupNode(previousGroupNode)).toBe(true)
    expect(LiteGraph.Nodes.PreviousGroupNode).toBeDefined()
    expect(useNodeDefStore().nodeDefsByName[groupType]).toBeDefined()

    await GroupNodeConfig.registerFromWorkflow(
      groupWithMissingInnerNodes(),
      missing,
      new Map([['MyGroup', [7]]])
    )

    expect(LiteGraph.registered_node_types[groupType]).toBeUndefined()
    expect(LiteGraph.Nodes.PreviousGroupNode).toBeUndefined()
    expect(useNodeDefStore().nodeDefsByName[groupType]).toBeUndefined()
    expect(missing).toStrictEqual([
      expect.objectContaining({ type: groupType, nodeId: '7' })
    ])
  })

  it('keeps the legacy unbacked entries when no instance map is given', async () => {
    const missing: MissingNodeType[] = []

    await GroupNodeConfig.registerFromWorkflow(
      groupWithMissingInnerNodes(),
      missing
    )

    expect(missing).toStrictEqual([
      expect.objectContaining({
        type: 'NotInstalledNode',
        hint: " (In group node 'workflow>MyGroup')"
      }),
      expect.objectContaining({ type: 'workflow>MyGroup' })
    ])
    expect(
      missing.every((entry) => typeof entry === 'string' || !entry.nodeId)
    ).toBe(true)
  })
})

describe('group node extension beforeConfigureGraph', () => {
  it('wires serialized instance positions per group into registerFromWorkflow', async () => {
    const ext = groupNodeExtension
    if (!ext.beforeConfigureGraph) throw new Error('extension not registered')
    const spy = vi
      .spyOn(GroupNodeConfig, 'registerFromWorkflow')
      .mockResolvedValue()
    const groupNodes = {
      MyGroup: fromPartial<GroupNodeWorkflowData>({
        nodes: [{ index: 0, type: 'NotInstalledNode' }],
        links: [],
        external: []
      })
    }
    const graphData = fromPartial<
      Parameters<typeof ext.beforeConfigureGraph>[0]
    >({
      nodes: [
        { id: 7, type: 'workflow>MyGroup' },
        { id: 9, type: 'workflow>MyGroup' },
        { id: 3, type: 'KSampler' }
      ],
      extra: { groupNodes }
    })

    try {
      await ext.beforeConfigureGraph(graphData, [], fromPartial({}), {
        graph: app.rootGraph,
        workflow: null
      })

      expect(spy).toHaveBeenCalledWith(
        groupNodes,
        [],
        new Map([['MyGroup', [0, 1]]])
      )
    } finally {
      spy.mockRestore()
    }
  })

  it('binds duplicate serialized ids to distinct configured graph ids', async () => {
    const ext = groupNodeExtension
    if (!ext.beforeConfigureGraph || !ext.afterConfigureGraph) {
      throw new Error('extension not registered')
    }
    const groupNodes = {
      MyGroup: fromPartial<GroupNodeWorkflowData>({
        nodes: [{ index: 0, type: 'NotInstalledNode' }],
        links: [],
        external: []
      })
    }
    const graphData = fromPartial<
      Parameters<typeof ext.beforeConfigureGraph>[0]
    >({
      nodes: [
        { id: 7, type: 'workflow>MyGroup' },
        { id: 7, type: 'workflow>MyGroup' }
      ],
      extra: { groupNodes }
    })
    const missingNodeTypes: MissingNodeType[] = []
    vi.mocked(app).rootGraph = fromAny({
      extra: {},
      nodes: [{ id: 7 }, { id: 8 }]
    })

    try {
      await ext.beforeConfigureGraph(
        graphData,
        missingNodeTypes,
        fromPartial({}),
        { graph: app.rootGraph, workflow: null }
      )
      await ext.afterConfigureGraph(missingNodeTypes, fromPartial({}), {
        graph: app.rootGraph,
        workflow: null
      })

      expect(missingNodeTypes).toStrictEqual([
        expect.objectContaining({ nodeId: '7', type: 'workflow>MyGroup' }),
        expect.objectContaining({ nodeId: '8', type: 'workflow>MyGroup' })
      ])

      const store = useMissingNodesErrorStore()
      store.setMissingNodeTypes(missingNodeTypes)
      store.removeMissingNodesByNodeId('7')
      expect(store.missingNodesError?.nodeTypes).toStrictEqual([
        expect.objectContaining({ nodeId: '8', type: 'workflow>MyGroup' })
      ])
    } finally {
      vi.mocked(app).rootGraph = fromAny({ extra: {}, nodes: [] })
    }
  })

  it('does not reinterpret reports appended by concurrent extensions', async () => {
    const ext = groupNodeExtension
    if (!ext.beforeConfigureGraph || !ext.afterConfigureGraph) {
      throw new Error('extension not registered')
    }
    const missingNodeTypes: MissingNodeType[] = []
    const unrelatedReport = { type: 'OtherMissingNode', nodeId: '99' }
    const spy = vi
      .spyOn(GroupNodeConfig, 'registerFromWorkflow')
      .mockImplementation(async (_groupNodes, groupNodeReports) => {
        groupNodeReports.push({
          type: 'workflow>MyGroup',
          nodeId: '0'
        })
        missingNodeTypes.push(unrelatedReport)
      })
    const graphData = fromPartial<
      Parameters<typeof ext.beforeConfigureGraph>[0]
    >({
      nodes: [{ id: 7, type: 'workflow>MyGroup' }],
      extra: {
        groupNodes: {
          MyGroup: fromPartial<GroupNodeWorkflowData>({
            nodes: [{ index: 0, type: 'NotInstalledNode' }],
            links: [],
            external: []
          })
        }
      }
    })
    vi.mocked(app).rootGraph = fromAny({ extra: {}, nodes: [{ id: 7 }] })

    try {
      await ext.beforeConfigureGraph(
        graphData,
        missingNodeTypes,
        fromPartial({}),
        { graph: app.rootGraph, workflow: null }
      )
      await ext.afterConfigureGraph(missingNodeTypes, fromPartial({}), {
        graph: app.rootGraph,
        workflow: null
      })

      expect(missingNodeTypes).toStrictEqual([
        unrelatedReport,
        expect.objectContaining({
          type: 'workflow>MyGroup',
          nodeId: '7'
        })
      ])
    } finally {
      vi.mocked(app).rootGraph = fromAny({ extra: {}, nodes: [] })
      spy.mockRestore()
    }
  })

  it('skips stray conversion while configuring and converts afterwards', async () => {
    const ext = groupNodeExtension
    if (!ext.nodeCreated) throw new Error('extension not registered')
    const convertToNodes = vi.fn(() => ({ refused: false, nodes: [] }))
    const isGroupNode = vi
      .spyOn(GroupNodeHandler, 'isGroupNode')
      .mockReturnValue(true)
    const getHandler = vi
      .spyOn(GroupNodeHandler, 'getHandler')
      .mockReturnValue(fromPartial({ convertToNodes }))
    const graph = fromPartial<LGraph>({ convertToSubgraph: vi.fn() })
    const failedLoadNode = new LGraphNode('Failed load')
    const pastedNode = new LGraphNode('Pasted')
    failedLoadNode.graph = graph
    pastedNode.graph = graph

    try {
      vi.mocked(app).configuringGraph = true
      ext.nodeCreated(failedLoadNode, fromPartial({}))
      vi.mocked(app).configuringGraph = false
      ext.nodeCreated(pastedNode, fromPartial({}))
      await Promise.resolve()

      expect(convertToNodes).toHaveBeenCalledOnce()
    } finally {
      vi.mocked(app).configuringGraph = false
      isGroupNode.mockRestore()
      getHandler.mockRestore()
    }
  })
})

describe('GroupNodeHandler.convertToNodes', () => {
  function nodeDef(
    def: Partial<ComfyNodeDef> & { name: string }
  ): ComfyNodeDef {
    return fromPartial<ComfyNodeDef>({
      display_name: def.name,
      category: 'testing',
      python_module: 'nodes',
      description: '',
      output: [],
      output_name: [],
      output_node: false,
      input: { required: {} },
      ...def
    })
  }

  // Real ComfyUI node defs for the inner nodes of
  // browser_tests/assets/groupnodes/group_node_v1.3.3.json, trimmed to the
  // inputs that matter for widget/slot classification.
  const REAL_NODE_DEFS: Record<string, ComfyNodeDef> = {
    EmptyLatentImage: nodeDef({
      name: 'EmptyLatentImage',
      input: {
        required: {
          width: ['INT', { default: 512 }],
          height: ['INT', { default: 512 }],
          batch_size: ['INT', { default: 1 }]
        }
      },
      output: ['LATENT'],
      output_name: ['LATENT']
    }),
    CheckpointLoaderSimple: nodeDef({
      name: 'CheckpointLoaderSimple',
      input: { required: { ckpt_name: [['v1-5-pruned-emaonly.ckpt'], {}] } },
      output: ['MODEL', 'CLIP', 'VAE'],
      output_name: ['MODEL', 'CLIP', 'VAE']
    }),
    CLIPTextEncode: nodeDef({
      name: 'CLIPTextEncode',
      input: {
        required: {
          text: ['STRING', { multiline: true }],
          clip: ['CLIP', {}]
        }
      },
      output: ['CONDITIONING'],
      output_name: ['CONDITIONING']
    }),
    KSampler: nodeDef({
      name: 'KSampler',
      input: {
        required: {
          model: ['MODEL', {}],
          seed: ['INT', { default: 0 }],
          steps: ['INT', { default: 20 }],
          cfg: ['FLOAT', { default: 8.0 }],
          sampler_name: [['euler', 'euler_ancestral', 'dpmpp_2m'], {}],
          scheduler: [['normal', 'karras'], {}],
          positive: ['CONDITIONING', {}],
          negative: ['CONDITIONING', {}],
          latent_image: ['LATENT', {}],
          denoise: ['FLOAT', { default: 1.0 }]
        }
      },
      output: ['LATENT'],
      output_name: ['LATENT']
    }),
    VAEDecode: nodeDef({
      name: 'VAEDecode',
      input: {
        required: { samples: ['LATENT', {}], vae: ['VAE', {}] }
      },
      output: ['IMAGE'],
      output_name: ['IMAGE']
    }),
    SaveImage: nodeDef({
      name: 'SaveImage',
      input: {
        required: {
          images: ['IMAGE', {}],
          filename_prefix: ['STRING', { default: 'ComfyUI' }]
        }
      }
    })
  }

  async function registerRealNodeDefs() {
    useWidgetStore().registerCustomWidgets(ComfyWidgets)
    vi.mocked(app.registerNodeDef).mockImplementation(async (id, def) => {
      await useLitegraphService().registerNodeDef(id, def)
    })
    await groupNodeExtension.addCustomNodeDefs?.(REAL_NODE_DEFS, app)
    for (const [name, def] of Object.entries(REAL_NODE_DEFS)) {
      await useLitegraphService().registerNodeDef(name, def)
    }
  }

  it('migrates legacy group nodes in the configured graph and leaves the visible root untouched', async () => {
    await registerRealNodeDefs()
    const fixture = JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          'browser_tests',
          'assets',
          'groupnodes',
          'group_node_v1.3.3.json'
        ),
        'utf-8'
      )
    )
    await new GroupNodeConfig(
      'group_node',
      fixture.extra.groupNodes.group_node
    ).registerType()
    const addGroupNode = (graph: LGraph) => {
      const node = LiteGraph.createNode(fixture.nodes[0].type)
      assert(node)
      node.configure(structuredClone(fixture.nodes[0]))
      graph.add(node)
      graph.extra.groupNodes = fixture.extra.groupNodes
      return node
    }
    const visibleGroupNode = addGroupNode(app.rootGraph)
    const background = new LGraph()
    background.events.addEventListener('subgraph-created', (e) =>
      useSubgraphService().registerNewSubgraph(e.detail.subgraph, e.detail.data)
    )
    addGroupNode(background)

    await groupNodeExtension.afterConfigureGraph?.([], app, {
      graph: background,
      workflow: null
    })

    expect(app.rootGraph.nodes).toHaveLength(1)
    expect(app.rootGraph.nodes[0]).toBe(visibleGroupNode)
    expect(app.rootGraph.extra.groupNodes).toBe(fixture.extra.groupNodes)
    expect(background.nodes.map((node) => node.isSubgraphNode())).toEqual([
      true
    ])
    expect(background.extra.groupNodes).toBeUndefined()
  })

  // QA found this broken on 2026-09-10 while running the 1.54 test plan (see
  // the e2e regression test in browser_tests/tests/groupNode.spec.ts): a
  // KSampler's combo widgets (sampler_name, scheduler) were misclassified as
  // plain input slots, which then shifted every widget value after them by
  // two positions on conversion, so denoise received sampler_name's value
  // ('euler') and filename_prefix received scheduler's ('normal').
  it('preserves KSampler widget values through the real v1.3.3 fixture', async () => {
    await registerRealNodeDefs()

    const fixture = JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          'browser_tests',
          'assets',
          'groupnodes',
          'group_node_v1.3.3.json'
        ),
        'utf-8'
      )
    )
    const groupNodeData: GroupNodeWorkflowData =
      fixture.extra.groupNodes.group_node

    const config = new GroupNodeConfig('group_node', groupNodeData)
    await config.registerType()

    const outerNodeInfo = fixture.nodes[0]
    const outerNode = LiteGraph.createNode(outerNodeInfo.type)
    if (!outerNode) throw new Error('Failed to create outer group node')
    outerNode.configure(outerNodeInfo)
    app.rootGraph.add(outerNode)

    // Every asserted value in this fixture (steps, cfg, sampler_name,
    // scheduler, denoise, filename_prefix) happens to equal that widget's
    // own node-def default, so the test can't tell a real copy from the
    // value simply being left untouched. Overwrite the *live* outer widget
    // values - as if the user had edited them on canvas after the group
    // was created - to values that differ from both the node-def defaults
    // and the fixture's original recorded values, so only a real copy can
    // produce a match.
    const setOuterWidget = (name: string, value: string | number) => {
      const widget = outerNode.widgets?.find((w) => w.name === name)
      if (!widget) throw new Error(`Outer widget '${name}' not found`)
      widget.value = value
    }
    setOuterWidget('steps', 999)
    setOuterWidget('cfg', 4.5)
    setOuterWidget('text', 'edited_positive_prompt')
    setOuterWidget('CLIPTextEncode text', 'edited_negative_prompt')
    setOuterWidget('sampler_name', 'dpmpp_2m')
    setOuterWidget('scheduler', 'karras')
    setOuterWidget('denoise', 0.42)
    setOuterWidget('filename_prefix', 'edited_prefix')

    const handler = GroupNodeHandler.getHandler(outerNode)
    if (!handler) throw new Error('No GroupNodeHandler for outer node')

    const result = handler.convertToNodes()
    assert(!result.refused)
    const innerNodes = result.nodes
    const widgetValues = (node: (typeof innerNodes)[number] | undefined) =>
      Object.fromEntries((node?.widgets ?? []).map((w) => [w.name, w.value]))

    const ksampler = innerNodes.find((n) => n.comfyClass === 'KSampler')
    const saveImage = innerNodes.find((n) => n.comfyClass === 'SaveImage')

    expect(innerNodes[2]?.widgets?.find((w) => w.name === 'text')?.value).toBe(
      'edited_positive_prompt'
    )
    expect(innerNodes[3]?.widgets?.find((w) => w.name === 'text')?.value).toBe(
      'edited_negative_prompt'
    )

    expect(widgetValues(ksampler)).toMatchObject({
      seed: 156680208700286,
      steps: 999,
      cfg: 4.5,
      sampler_name: 'dpmpp_2m',
      scheduler: 'karras',
      denoise: 0.42
    })
    expect(widgetValues(saveImage)).toMatchObject({
      filename_prefix: 'edited_prefix'
    })
  })

  it('refuses to unpack a group whose later member has a subgraph type absent from the receiving graph, leaving the group and its valid prefix untouched', () => {
    const definitionGraph = new LGraph()
    const definition = createTestSubgraph({
      id: crypto.randomUUID()
    }).asSerialisable()
    const ownedSubgraph = definitionGraph.createSubgraph(definition)
    useSubgraphService().registerNewSubgraph(ownedSubgraph, definition)

    const validType = `Valid${crypto.randomUUID()}`
    const constructed = vi.fn()
    class ValidMember extends LGraphNode {
      constructor() {
        super('Valid member')
        constructed()
      }
    }
    LiteGraph.registerNodeType(validType, ValidMember)

    const receivingGraph = new LGraph()
    const outerNode = new LGraphNode('Multi member group')
    outerNode.pos = [0, 0]
    outerNode.addInput('in', '*')
    outerNode.addOutput('out', '*')
    outerNode.addWidget('text', 'label', 'retained value', () => {})
    receivingGraph.add(outerNode)

    const upstreamNode = new LGraphNode('Upstream')
    upstreamNode.addOutput('out', '*')
    receivingGraph.add(upstreamNode)
    const downstreamNode = new LGraphNode('Downstream')
    downstreamNode.addInput('in', '*')
    receivingGraph.add(downstreamNode)
    upstreamNode.connect(0, outerNode, 0)
    outerNode.connect(0, downstreamNode, 0)

    const groupData = new GroupNodeConfig('multiMember', {
      nodes: [{ type: validType }, { type: definition.id }],
      links: []
    })
    const handler = new GroupNodeHandler(outerNode, groupData)

    const result = handler.convertToNodes()
    expect(result).toEqual({ refused: true, memberType: definition.id })
    expect(constructed).not.toHaveBeenCalled()
    expect(receivingGraph.nodes).toEqual([
      outerNode,
      upstreamNode,
      downstreamNode
    ])
    expect(outerNode.getInputLink(0)?.origin_id).toBe(upstreamNode.id)
    expect(outerNode.outputs[0].links).toEqual([
      downstreamNode.getInputLink(0)?.id
    ])
    expect(outerNode.widgets?.[0]?.value).toBe('retained value')
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'failure_creating_subgraph_node_target_missing',
        context: {
          subgraphId: definition.id,
          rootGraphId: receivingGraph.rootGraph.id
        }
      })
    )
  })

  it('does not refuse a member registered under an alias of a type the receiving graph owns', () => {
    const receivingGraph = createTestRootGraph()
    const definition = createTestSubgraph({
      id: crypto.randomUUID()
    }).asSerialisable()
    const ownedSubgraph = receivingGraph.createSubgraph(definition)
    useSubgraphService().registerNewSubgraph(ownedSubgraph, definition)

    const Registered = LiteGraph.registered_node_types[definition.id]
    assert.exists(Registered)
    class AliasOfRegistered extends Registered {}
    const aliasType = `Alias${crypto.randomUUID()}`
    LiteGraph.registerNodeType(aliasType, AliasOfRegistered)

    const outerNode = new LGraphNode('Aliased member group')
    outerNode.pos = [0, 0]
    receivingGraph.add(outerNode)

    const groupData = new GroupNodeConfig('aliasedMember', {
      nodes: [makeNode(aliasType)],
      links: []
    })
    const handler = new GroupNodeHandler(outerNode, groupData)

    const result = handler.convertToNodes()
    assert(!result.refused)
    const created = result.nodes
    expect(created).toHaveLength(1)
    const [alias] = created
    assert(alias.isSubgraphNode())
    expect(alias.subgraph).toBe(ownedSubgraph)
    expect(alias.graph).toBe(receivingGraph)
    expect(receivingGraph.nodes).toEqual(created)
  })

  it('stops updating an abandoned subgraph prefix when a later member fails', () => {
    const graph = createTestRootGraph()
    const definitionData = createTestSubgraph({
      id: crypto.randomUUID()
    }).asSerialisable()
    const definition = graph.createSubgraph(definitionData)
    useSubgraphService().registerNewSubgraph(definition, definitionData)
    useLitegraphService().registerSubgraphNodeDef(
      nodeDef({ name: definition.id, output: [] }),
      definition,
      fromAny({
        id: -1,
        type: definition.id,
        pos: [0, 0],
        size: [100, 100],
        inputs: [],
        outputs: [],
        flags: {},
        order: 0,
        mode: 0
      })
    )
    const Registered = LiteGraph.registered_node_types[definition.id]
    assert.exists(Registered)
    const constructed: LGraphNode[] = []
    class CapturingSubgraphNode extends Registered {
      constructor(title: string) {
        super(title)
        constructed.push(this)
      }
    }
    LiteGraph.registerNodeType(definition.id, CapturingSubgraphNode)
    const sibling = LiteGraph.createNode(definition.id, undefined, {
      targetGraph: graph
    })
    assert.exists(sibling)
    graph.add(sibling)

    const throwingType = `Throwing${crypto.randomUUID()}`
    class ThrowingMember extends LGraphNode {
      constructor() {
        super('Throwing member')
        throw new Error('construction failed')
      }
    }
    LiteGraph.registerNodeType(throwingType, ThrowingMember)
    const group = new LGraphNode('Group')
    graph.add(group)
    const handler = new GroupNodeHandler(
      group,
      new GroupNodeConfig('abandonedPrefix', {
        nodes: [makeNode(definition.id), makeNode(throwingType)],
        links: []
      })
    )

    expect(handler.convertToNodes()).toMatchObject({
      refused: true,
      memberType: throwingType,
      interference: { phase: 'construction', cleanupErrors: [] }
    })
    const abandoned = constructed.at(-1)
    assert.exists(abandoned)

    definition.addOutput('afterFailure', 'MASK')

    expect(abandoned.outputs).toEqual([])
    expect(sibling.outputs.map(({ name }) => name)).toEqual(['afterFailure'])
  })

  it('keeps definitions for refused groups while migrating a sibling group, using the real handler', async () => {
    await registerRealNodeDefs()
    const fixture = JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          'browser_tests',
          'assets',
          'groupnodes',
          'group_node_v1.3.3.json'
        ),
        'utf-8'
      )
    )
    const convertibleData: GroupNodeWorkflowData =
      fixture.extra.groupNodes.group_node
    const nestedData: GroupNodeWorkflowData = structuredClone(convertibleData)
    const refusedData: GroupNodeWorkflowData = structuredClone(convertibleData)

    const definitionGraph = new LGraph()
    const foreign = createTestSubgraph({
      id: crypto.randomUUID()
    }).asSerialisable()
    const foreignSubgraph = definitionGraph.createSubgraph(foreign)
    useSubgraphService().registerNewSubgraph(foreignSubgraph, foreign)
    refusedData.nodes.push({ type: 'workflow>nested_group' })
    refusedData.nodes.push({ type: 'workflow>constructor' })
    refusedData.nodes.push({ type: foreign.id })

    await new GroupNodeConfig(
      'convertible_group',
      convertibleData
    ).registerType()
    await new GroupNodeConfig('nested_group', nestedData).registerType()
    await new GroupNodeConfig('refused_group', refusedData).registerType()

    const graph = new LGraph()
    graph.events.addEventListener('subgraph-created', (e) =>
      useSubgraphService().registerNewSubgraph(e.detail.subgraph, e.detail.data)
    )
    for (const name of ['convertible_group', 'refused_group']) {
      const node = LiteGraph.createNode(`workflow>${name}`)
      assert(node)
      node.configure({
        ...structuredClone(fixture.nodes[0]),
        type: `workflow>${name}`
      })
      graph.add(node)
    }
    graph.extra.groupNodes = {
      convertible_group: convertibleData,
      nested_group: nestedData,
      refused_group: refusedData
    }

    await groupNodeExtension.afterConfigureGraph?.([], app, {
      graph,
      workflow: null
    })

    expect(graph.nodes.filter((n) => n.isSubgraphNode())).toHaveLength(1)
    const remaining = graph.nodes.filter((n) => !n.isSubgraphNode())
    expect(remaining.map((n) => n.type)).toEqual(['workflow>refused_group'])
    expect(graph.serialize().extra?.groupNodes).toEqual({
      nested_group: nestedData,
      refused_group: refusedData
    })
  })
})

describe('legacy group lifecycle ownership', () => {
  function groupWithMembers(graph: LGraph, types: string[]) {
    const group = new LGraphNode('Retained legacy group')
    graph.add(group)
    const handler = new GroupNodeHandler(
      group,
      new GroupNodeConfig('lifecycle', {
        nodes: types.map(makeNode),
        links: []
      })
    )
    return { group, handler }
  }

  it.for([
    { hook: 'onConfigure', order: [1, 0], phase: 'configure' },
    { hook: 'onAdded', order: [0, 1], phase: 'attach' }
  ] as const)(
    'retains the original when $hook invalidates another member',
    ({ hook, order, phase }) => {
      const graph = new LGraph()
      const definition = createTestSubgraph({
        id: crypto.randomUUID()
      }).asSerialisable()
      const owned = graph.createSubgraph(definition)
      useSubgraphService().registerNewSubgraph(owned, definition)
      class ReplacingMember extends LGraphNode {}
      ReplacingMember.prototype[hook] = () => {
        graph.releaseSubgraphs([owned])
        const replacement = graph.createSubgraph(definition)
        useSubgraphService().registerNewSubgraph(replacement, definition)
      }
      const type = `test/group-replacing-${hook}`
      LiteGraph.registerNodeType(type, ReplacingMember)
      const types = [definition.id, type]
      const { group, handler } = groupWithMembers(
        graph,
        order.map((index) => types[index])
      )

      const result = handler.convertToNodes()

      expect(result).toMatchObject({
        refused: true,
        interference: { phase }
      })
      expect(graph.nodes).toEqual([group])
      expect(graph.subgraphs.get(definition.id)).not.toBe(owned)
    }
  )

  it('does not attach a draft released by normal last-host removal', () => {
    const graph = new LGraph()
    const definition = createTestSubgraph({
      id: crypto.randomUUID()
    }).asSerialisable()
    const owned = graph.createSubgraph(definition)
    useSubgraphService().registerNewSubgraph(owned, definition)
    const liveHost = LiteGraph.createNode(definition.id, undefined, {
      targetGraph: graph
    })
    assert(liveHost)
    graph.add(liveHost)
    const attachedHost = liveHost
    class RemovingMember extends LGraphNode {
      override onConfigure() {
        graph.remove(attachedHost)
      }
    }
    const type = 'test/group-removes-last-host'
    LiteGraph.registerNodeType(type, RemovingMember)
    const { group, handler } = groupWithMembers(graph, [type, definition.id])

    const result = handler.convertToNodes()

    expect(result).toMatchObject({
      refused: true,
      interference: { phase: 'configure' }
    })
    expect(graph.nodes).toEqual([group])
    expect(graph.subgraphs.has(definition.id)).toBe(false)
  })

  it('preserves serialized graph and original links when a later constructor throws', () => {
    class ValidMember extends LGraphNode {}
    class ThrowingMember extends LGraphNode {
      constructor() {
        super('Throwing member')
        throw new Error('later construction failed')
      }
    }
    LiteGraph.registerNodeType('test/group-valid-prefix', ValidMember)
    LiteGraph.registerNodeType('test/group-throwing-suffix', ThrowingMember)
    const graph = new LGraph()
    const { group, handler } = groupWithMembers(graph, [
      'test/group-valid-prefix',
      'test/group-throwing-suffix'
    ])
    group.addInput('in', '*')
    const upstream = new LGraphNode('Upstream')
    upstream.addOutput('out', '*')
    graph.add(upstream)
    upstream.connect(0, group, 0)
    const before = graph.serialize()

    const result = handler.convertToNodes()

    expect(result).toEqual({
      refused: true,
      memberType: 'test/group-throwing-suffix',
      interference: {
        phase: 'construction',
        cause: new Error('later construction failed'),
        cleanupErrors: []
      }
    })
    expect(graph.serialize()).toEqual(before)
  })

  it.for(['construction', 'configure'] as const)(
    'abandons a registration replaced during %s and only removes attached members',
    (phase) => {
      const removed = vi.fn()
      class OriginalMember extends LGraphNode {
        override onRemoved = removed
      }
      class ReplacementMember extends LGraphNode {}
      const replaceRegistration = () =>
        LiteGraph.registerNodeType(
          'test/group-replaced-constructor',
          ReplacementMember
        )
      class ReplacingMember extends LGraphNode {
        constructor() {
          super('Replacing member')
          if (phase === 'construction') replaceRegistration()
        }

        override onConfigure() {
          if (phase === 'configure') replaceRegistration()
        }
      }
      LiteGraph.registerNodeType(
        'test/group-replaced-constructor',
        OriginalMember
      )
      LiteGraph.registerNodeType(
        'test/group-replacing-constructor',
        ReplacingMember
      )
      const graph = new LGraph()
      const { group, handler } = groupWithMembers(graph, [
        'test/group-replaced-constructor',
        'test/group-replacing-constructor'
      ])
      const before = graph.serialize()

      const result = handler.convertToNodes()

      expect(result).toMatchObject({
        refused: true,
        interference: { phase, cleanupErrors: [] }
      })
      expect(graph.nodes).toEqual([group])
      if (phase === 'construction') {
        expect(graph.serialize()).toEqual(before)
        expect(removed).not.toHaveBeenCalled()
      } else {
        expect(removed).toHaveBeenCalledOnce()
      }
    }
  )

  it.for(['configure', 'attach'] as const)(
    'cleans up the owned prefix when %s throws without releasing shared definitions',
    (phase) => {
      const graph = new LGraph()
      const definition = createTestSubgraph({
        id: crypto.randomUUID()
      }).asSerialisable()
      const owned = graph.createSubgraph(definition)
      useSubgraphService().registerNewSubgraph(owned, definition)
      const cause = new Error(`${phase} failed`)
      class ThrowingMember extends LGraphNode {
        override onConfigure() {
          if (phase === 'configure') throw cause
        }

        override onAdded() {
          if (phase === 'attach') throw cause
        }
      }
      LiteGraph.registerNodeType('test/group-throwing-add', ThrowingMember)
      const { group, handler } = groupWithMembers(graph, [
        definition.id,
        'test/group-throwing-add'
      ])

      const result = handler.convertToNodes()

      expect(result).toMatchObject({
        refused: true,
        interference: { phase, cause, cleanupErrors: [] }
      })
      expect(graph.nodes).toEqual([group])
      expect(graph.subgraphs.get(definition.id)).toBe(owned)
    }
  )

  it('detects invalidation during original removal instead of reporting success', () => {
    const graph = new LGraph()
    const definition = createTestSubgraph({
      id: crypto.randomUUID()
    }).asSerialisable()
    const owned = graph.createSubgraph(definition)
    useSubgraphService().registerNewSubgraph(owned, definition)
    const { group, handler } = groupWithMembers(graph, [definition.id])
    group.onRemoved = () => graph.releaseSubgraphs([owned])

    const result = handler.convertToNodes()

    expect(result).toMatchObject({
      refused: true,
      interference: { phase: 'remove' }
    })
    expect(graph.nodes).toEqual([])
  })

  it('retains the group when copying a live widget invalidates a member', () => {
    const graph = new LGraph()
    const definition = createTestSubgraph({
      id: crypto.randomUUID()
    }).asSerialisable()
    const owned = graph.createSubgraph(definition)
    useSubgraphService().registerNewSubgraph(owned, definition)
    class WidgetMember extends LGraphNode {
      constructor() {
        super('Widget member')
        const widget = this.addWidget('text', 'label', 'inner', () => {})
        Object.defineProperty(widget, 'value', {
          get: () => 'inner',
          set: () => graph.releaseSubgraphs([owned])
        })
      }
    }
    LiteGraph.registerNodeType('test/group-widget-interference', WidgetMember)
    const { group, handler } = groupWithMembers(graph, [
      'test/group-widget-interference',
      definition.id
    ])
    group.addWidget('text', 'label', 'edited outer value', () => {})
    handler.groupData.oldToNewWidgetMap[0] = { label: 'label' }

    const result = handler.convertToNodes()

    expect(result).toMatchObject({
      refused: true,
      interference: { phase: 'widgets' }
    })
    expect(graph.nodes).toEqual([group])
  })

  it('retains the group when an internal connection invalidates a member', () => {
    const graph = new LGraph()
    const definition = createTestSubgraph({
      id: crypto.randomUUID()
    }).asSerialisable()
    const owned = graph.createSubgraph(definition)
    useSubgraphService().registerNewSubgraph(owned, definition)
    class SourceMember extends LGraphNode {
      constructor() {
        super('Source member')
        this.addOutput('out', '*')
      }

      override onConnectionsChange() {
        graph.releaseSubgraphs([owned])
      }
    }
    class SinkMember extends LGraphNode {
      constructor() {
        super('Sink member')
        this.addInput('in', '*')
      }
    }
    LiteGraph.registerNodeType('test/group-link-source', SourceMember)
    LiteGraph.registerNodeType('test/group-link-sink', SinkMember)
    const { group, handler } = groupWithMembers(graph, [
      definition.id,
      'test/group-link-source',
      'test/group-link-sink'
    ])
    handler.groupData.nodeData.links = [[1, 0, 2, 0, 0]]

    const result = handler.convertToNodes()

    expect(result).toMatchObject({
      refused: true,
      interference: { phase: 'links' }
    })
    expect(graph.nodes).toEqual([group])
    expect(graph.links.size).toBe(0)
  })

  it('preserves a callback-owned same-id replacement when expansion fails', () => {
    const graph = new LGraph()
    let firstMemberId: LGraphNode['id'] | undefined
    const replacement = new LGraphNode('Callback replacement')
    class FirstMember extends LGraphNode {
      override onAdded() {
        firstMemberId = this.id
      }
    }
    class ReplacingMember extends LGraphNode {
      override onAdded() {
        assert.exists(firstMemberId)
        const firstMember = graph.getNodeById(firstMemberId)
        assert.exists(firstMember)
        graph.remove(firstMember)
        replacement.id = firstMemberId
        graph.add(replacement)
      }
    }
    LiteGraph.registerNodeType('test/group-first-member', FirstMember)
    LiteGraph.registerNodeType('test/group-replacing-member', ReplacingMember)
    const { group, handler } = groupWithMembers(graph, [
      'test/group-first-member',
      'test/group-replacing-member'
    ])

    const result = handler.convertToNodes()

    expect(result).toMatchObject({
      refused: true,
      interference: { phase: 'attach', cleanupErrors: [] }
    })
    expect(graph.nodes).toEqual([group, replacement])
    expect(graph.getNodeById(replacement.id)).toBe(replacement)
  })

  it('restores an external group output when reconnection invalidates a member', () => {
    const graph = createTestRootGraph()
    const definitionData = createTestSubgraph({
      id: crypto.randomUUID(),
      outputs: [{ name: 'result', type: 'MASK' }]
    }).asSerialisable()
    const definition = graph.createSubgraph(definitionData)
    useSubgraphService().registerNewSubgraph(definition, definitionData)
    const { group, handler } = groupWithMembers(graph, [definition.id])
    group.addOutput('result', 'MASK')
    const target = new LGraphNode('External target')
    target.addInput('result', 'MASK')
    graph.add(target)
    group.connect(0, target, 0)
    handler.groupData.newToOldOutputMap[0] = {
      node: handler.groupData.nodeData.nodes[0],
      slot: 0
    }
    target.onConnectionsChange = () => graph.releaseSubgraphs([definition])

    const result = handler.convertToNodes()

    expect(result).toMatchObject({
      refused: true,
      interference: { phase: 'reconnect', cleanupErrors: [] }
    })
    expect(graph.nodes).toEqual([group, target])
    expect(target.getInputLink(0)?.origin_id).toBe(group.id)
  })

  it('preserves a callback-owned disconnection when reconnection invalidates another member', () => {
    const graph = createTestRootGraph()
    const sourceData = createTestSubgraph({
      id: crypto.randomUUID(),
      outputs: [{ name: 'result', type: 'MASK' }]
    }).asSerialisable()
    const requiredData = createTestSubgraph({
      id: crypto.randomUUID()
    }).asSerialisable()
    const source = graph.createSubgraph(sourceData)
    const required = graph.createSubgraph(requiredData)
    useSubgraphService().registerNewSubgraph(source, sourceData)
    useSubgraphService().registerNewSubgraph(required, requiredData)
    const { group, handler } = groupWithMembers(graph, [source.id, required.id])
    group.addOutput('result', 'MASK')
    const target = new LGraphNode('External target')
    target.addInput('result', 'MASK')
    graph.add(target)
    group.connect(0, target, 0)
    handler.groupData.newToOldOutputMap[0] = {
      node: handler.groupData.nodeData.nodes[0],
      slot: 0
    }
    target.onConnectionsChange = (_side, _slot, connected) => {
      if (!connected) return
      target.disconnectInput(0)
      graph.releaseSubgraphs([required])
    }

    const result = handler.convertToNodes()

    expect(result).toMatchObject({
      refused: true,
      interference: { phase: 'reconnect', cleanupErrors: [] }
    })
    expect(graph.nodes).toEqual([group, target])
    expect(target.getInputLink(0)).toBeNull()
  })

  it('does not remove an unrelated node replacing the original during configuration', () => {
    const graph = new LGraph()
    const { group, handler } = groupWithMembers(graph, [
      'test/group-original-replacement'
    ])
    const replacement = new LGraphNode('Replacement')
    class ReplacingMember extends LGraphNode {
      override onConfigure() {
        graph.remove(group)
        replacement.id = group.id
        graph.add(replacement)
      }
    }
    LiteGraph.registerNodeType(
      'test/group-original-replacement',
      ReplacingMember
    )

    const result = handler.convertToNodes()

    expect(result).toMatchObject({
      refused: true,
      interference: { phase: 'configure' }
    })
    expect(graph.nodes).toEqual([replacement])
  })
})

describe('convertLoadedGroupNodes via groupNodeExtension.afterConfigureGraph', () => {
  it('rejects repackaging when its closing callback invalidates a newly constructed nested host', async () => {
    const graph = new LGraph()
    graph.events.addEventListener('subgraph-created', (event) =>
      useSubgraphService().registerNewSubgraph(
        event.detail.subgraph,
        event.detail.data
      )
    )
    const definition = createTestSubgraph({
      id: crypto.randomUUID()
    }).asSerialisable()
    const owned = graph.createSubgraph(definition)
    const group = new LGraphNode('Migrating group')
    graph.add(group)
    const config = new GroupNodeConfig('migrationInterference', {
      nodes: [makeNode(definition.id)],
      links: []
    })
    graph.extra.groupNodes = { migrationInterference: config.nodeData }
    const handler = new GroupNodeHandler(group, config)
    vi.spyOn(GroupNodeHandler, 'isGroupNode').mockImplementation(
      (node) => node === group
    )
    vi.spyOn(GroupNodeHandler, 'getHandler').mockReturnValue(handler)
    const callbackOwned = new LGraphNode('Callback-owned member')
    graph.events.addEventListener('convert-to-subgraph', (event) => {
      event.detail.subgraph.add(callbackOwned)
      graph.onAfterChange = () => graph.releaseSubgraphs([owned])
    })

    await groupNodeExtension.afterConfigureGraph?.([], app, {
      graph,
      workflow: null
    })

    expect(graph.nodes).toEqual([])
    expect(callbackOwned.graph?.getNodeById(callbackOwned.id)).toBe(
      callbackOwned
    )
    expect(graph.extra.groupNodes).toEqual({
      migrationInterference: config.nodeData
    })
    expect(reportError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ errorType: 'failure_migrating_legacy_group' })
    )
  })

  it('leaves a refused group node in place instead of removing it', async () => {
    const convertToNodes = vi.fn(() => ({
      refused: true,
      memberType: 'some/subgraphId'
    }))
    vi.spyOn(GroupNodeHandler, 'isGroupNode').mockReturnValue(true)
    vi.spyOn(GroupNodeHandler, 'getHandler').mockReturnValue(
      fromPartial({ convertToNodes })
    )

    const graph = new LGraph()
    const groupNode = new LGraphNode('Refused group')
    graph.add(groupNode)
    const removeSpy = vi.spyOn(graph, 'remove')

    const missingNodeTypes: MissingNodeType[] = []
    await groupNodeExtension.afterConfigureGraph?.(
      missingNodeTypes,
      fromPartial({}),
      {
        graph,
        workflow: null
      }
    )

    expect(removeSpy).not.toHaveBeenCalled()
    expect(graph.nodes).toEqual([groupNode])
    expect(missingNodeTypes).toEqual([
      { type: 'some/subgraphId', nodeId: String(groupNode.id) }
    ])
  })

  it('keeps a group node when conversion throws before replacing it', async () => {
    const convertToNodes = vi.fn(() => {
      throw new Error('unrelated failure')
    })
    vi.spyOn(GroupNodeHandler, 'isGroupNode').mockReturnValue(true)
    vi.spyOn(GroupNodeHandler, 'getHandler').mockReturnValue(
      fromPartial({ convertToNodes })
    )

    const graph = new LGraph()
    const groupNode = new LGraphNode('Broken group')
    graph.add(groupNode)

    await groupNodeExtension.afterConfigureGraph?.([], fromPartial({}), {
      graph,
      workflow: null
    })

    expect(graph.nodes).toEqual([groupNode])
  })
})
