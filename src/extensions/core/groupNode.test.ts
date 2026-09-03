import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { getActivePinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'

import { t } from '@/i18n'

import type { SerialisedLLinkArray } from '@/lib/litegraph/src/LLink'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyNode } from '@/platform/workflow/validation/schemas/workflowSchema'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { useNodeDefStore } from '@/stores/nodeDefStore'

import type { ComfyExtension, MissingNodeType } from '@/types/comfy'

import type { GroupNodeWorkflowData } from './groupNode'

const extensionState = vi.hoisted(() => ({
  ext: undefined as ComfyExtension | undefined,
  configuringGraph: false,
  rootGraph: {
    extra: {} as Record<string, unknown>,
    nodes: [] as { id: string | number }[]
  },
  registerNodeDef:
    vi.fn<(typeName: string, nodeDef: ComfyNodeDef) => Promise<void>>()
}))

vi.mock('@/scripts/app', () => ({
  app: {
    get configuringGraph() {
      return extensionState.configuringGraph
    },
    rootGraph: extensionState.rootGraph,
    registerNodeDef: extensionState.registerNodeDef,
    registerExtension: (ext: ComfyExtension) => {
      extensionState.ext = ext
    }
  }
}))

import {
  GroupNodeConfig,
  GroupNodeHandler,
  replaceLegacySeparators
} from './groupNode'

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
    links: SerialisedLLinkArray[],
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
    const clip = [1, 1, 2, 0, 4, 'CLIP'] satisfies SerialisedLLinkArray
    const model = [1, 0, 4, 0, 4, 'MODEL'] satisfies SerialisedLLinkArray
    const config = configFrom([clip, model])

    expect(config.linksFrom[1][1]).toEqual([clip])
    expect(config.linksFrom[1][0]).toEqual([model])
  })

  it('indexes incoming links by [target index][target slot]', () => {
    const clip = [1, 1, 2, 0, 4, 'CLIP'] satisfies SerialisedLLinkArray
    const cond = [2, 0, 4, 1, 6, 'CONDITIONING'] satisfies SerialisedLLinkArray
    const config = configFrom([clip, cond])

    expect(config.linksTo[2][0]).toEqual(clip)
    expect(config.linksTo[4][1]).toEqual(cond)
  })

  it('accumulates multiple fan-out links from the same origin slot', () => {
    const toPos = [1, 1, 2, 0, 4, 'CLIP'] satisfies SerialisedLLinkArray
    const toNeg = [1, 1, 3, 0, 5, 'CLIP'] satisfies SerialisedLLinkArray
    const config = configFrom([toPos, toNeg])

    expect(config.linksFrom[1][1]).toEqual([toPos, toNeg])
  })

  it('skips links that have a null endpoint', () => {
    const valid = [1, 1, 2, 0, 4, 'CLIP'] satisfies SerialisedLLinkArray
    const broken = [null, 1, 2, 0, 4, 'CLIP'] as unknown as SerialisedLLinkArray
    const config = configFrom([valid, broken])

    expect(config.linksFrom[1][1]).toEqual([valid])
    expect(Object.keys(config.linksFrom)).toEqual(['1'])
  })

  it('maps external links by [node index][slot] to their type', () => {
    const config = configFrom([], [[0, 1, 'IMAGE']])
    expect(config.externalFrom[0][1]).toBe('IMAGE')
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
    const previousPinia = getActivePinia()
    setActivePinia(createTestingPinia({ stubActions: false }))
    extensionState.registerNodeDef.mockImplementation(
      async (typeName, nodeDef) => {
        class PreviousGroupNode extends LGraphNode {
          static override nodeData = nodeDef
        }
        LiteGraph.registerNodeType(typeName, PreviousGroupNode)
      }
    )

    try {
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
    } finally {
      extensionState.registerNodeDef.mockReset()
      setActivePinia(previousPinia)
      if (groupType in LiteGraph.registered_node_types) {
        LiteGraph.unregisterNodeType(groupType)
      }
    }
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
    const ext = extensionState.ext
    if (!ext?.beforeConfigureGraph) throw new Error('extension not registered')
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
    const ext = extensionState.ext
    if (!ext?.beforeConfigureGraph || !ext.afterConfigureGraph) {
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
    extensionState.rootGraph.nodes = [{ id: 7 }, { id: 8 }]

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

      const previousPinia = getActivePinia()
      setActivePinia(createTestingPinia({ stubActions: false }))
      try {
        const store = useMissingNodesErrorStore()
        store.setMissingNodeTypes(missingNodeTypes)
        store.removeMissingNodesByNodeId('7')

        expect(store.missingNodesError?.nodeTypes).toStrictEqual([
          expect.objectContaining({ nodeId: '8', type: 'workflow>MyGroup' })
        ])
      } finally {
        setActivePinia(previousPinia)
      }
    } finally {
      extensionState.rootGraph.nodes = []
    }
  })

  it('does not reinterpret reports appended by concurrent extensions', async () => {
    const ext = extensionState.ext
    if (!ext?.beforeConfigureGraph || !ext.afterConfigureGraph) {
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
    extensionState.rootGraph.nodes = [{ id: 7 }]

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
      extensionState.rootGraph.nodes = []
      spy.mockRestore()
    }
  })

  it('skips stray conversion while configuring and converts afterwards', async () => {
    const ext = extensionState.ext
    if (!ext?.nodeCreated) throw new Error('extension not registered')
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
      extensionState.configuringGraph = true
      ext.nodeCreated(failedLoadNode, fromPartial({}))
      extensionState.configuringGraph = false
      ext.nodeCreated(pastedNode, fromPartial({}))
      await Promise.resolve()

      expect(convertToNodes).toHaveBeenCalledOnce()
    } finally {
      extensionState.configuringGraph = false
      isGroupNode.mockRestore()
      getHandler.mockRestore()
    }
  })
})
