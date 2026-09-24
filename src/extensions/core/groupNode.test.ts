import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { t } from '@/i18n'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyNode } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { app } from '@/scripts/app'
import { ComfyWidgets } from '@/scripts/widgets'
import { useLitegraphService } from '@/services/litegraphService'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { useWidgetStore } from '@/stores/widgetStore'

import type { MissingNodeType } from '@/types/comfy'

import type { GroupNodeLink, GroupNodeWorkflowData } from './groupNode'

vi.mock(import('@/scripts/app'))

const {
  GroupNodeConfig,
  GroupNodeHandler,
  findUnconsumedWidgetIndex,
  replaceLegacySeparators
} = await import('./groupNode')
const groupNodeExtension = vi
  .mocked(app.registerExtension)
  .mock.calls.find(([extension]) => extension.name === 'Comfy.GroupNode')?.[0]
if (!groupNodeExtension) throw new Error('Comfy.GroupNode was not registered')

function makeNode(type: string): ComfyNode {
  return {
    id: 1,
    type,
    pos: [0, 0],
    size: [1, 1],
    flags: {},
    order: 0,
    mode: 0,
    properties: {}
  }
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
        model: ['MODEL'],
        latent_image: ['LATENT']
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
      { seed: ['INT'], steps: ['INT'], cfg: ['FLOAT'] },
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
      { b: ['INT'] },
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
      await ext.beforeConfigureGraph(graphData, [], fromPartial({}))

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
        fromPartial({})
      )
      await ext.afterConfigureGraph(missingNodeTypes, fromPartial({}))

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
        fromPartial({})
      )
      await ext.afterConfigureGraph(missingNodeTypes, fromPartial({}))

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
    const convertToNodes = vi.fn(() => [])
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
    await groupNodeExtension!.addCustomNodeDefs?.(REAL_NODE_DEFS, app)
    for (const [name, def] of Object.entries(REAL_NODE_DEFS)) {
      await useLitegraphService().registerNodeDef(name, def)
    }
  }

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

    // The app mock stubs out selectItems/selectNodes; make it behave like
    // the real LGraphCanvas so deserialiseAndCreate's selection is visible
    // to convertToNodes via app.canvas.selected_nodes.
    Object.assign(app.canvas, {
      selectNodes(nodes: { id: number | string }[]) {
        app.canvas.selected_nodes = {}
        for (const n of nodes) {
          vi.mocked(app.canvas).selected_nodes[n.id] = fromAny(n)
        }
      }
    })

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
    setOuterWidget('sampler_name', 'dpmpp_2m')
    setOuterWidget('scheduler', 'karras')
    setOuterWidget('denoise', 0.42)
    setOuterWidget('filename_prefix', 'edited_prefix')

    const handler = GroupNodeHandler.getHandler(outerNode)
    if (!handler) throw new Error('No GroupNodeHandler for outer node')

    const innerNodes = handler.convertToNodes()
    const widgetValues = (node: (typeof innerNodes)[number] | undefined) =>
      Object.fromEntries((node?.widgets ?? []).map((w) => [w.name, w.value]))

    const ksampler = innerNodes.find((n) => n.comfyClass === 'KSampler')
    const saveImage = innerNodes.find((n) => n.comfyClass === 'SaveImage')

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
})
