import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SerialisedLLinkArray } from '@/lib/litegraph/src/LLink'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ComfyNode } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import type { ComfyApp } from '@/scripts/app'
import type { ComfyExtension } from '@/types/comfy'

import type { GroupNodeWorkflowData } from './groupNode'

const appMock = vi.hoisted(() => ({
  canvas: {
    emitAfterChange: vi.fn(),
    emitBeforeChange: vi.fn(),
    selected_nodes: {}
  },
  registerExtension: vi.fn(),
  registerNodeDef: vi.fn(),
  rootGraph: {
    convertToSubgraph: vi.fn(),
    extra: {},
    getNodeById: vi.fn(),
    links: {},
    nodes: [],
    remove: vi.fn()
  }
}))

const widgetStoreMock = vi.hoisted(() => ({
  inputIsWidget: vi.fn((spec: unknown[]) =>
    ['BOOLEAN', 'COMBO', 'FLOAT', 'INT', 'STRING'].includes(String(spec[0]))
  )
}))

vi.mock('@/scripts/app', () => ({
  app: appMock
}))

vi.mock('@/stores/widgetStore', () => ({
  useWidgetStore: () => widgetStoreMock
}))

import { GroupNodeConfig, replaceLegacySeparators } from './groupNode'

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

function makeNodeDef(overrides: Partial<ComfyNodeDef> = {}): ComfyNodeDef {
  return {
    name: 'TestNode',
    display_name: 'Test Node',
    description: '',
    category: 'test',
    input: { required: {}, optional: {} },
    output: [],
    output_name: [],
    output_is_list: [],
    output_node: false,
    python_module: 'test',
    ...overrides
  } as ComfyNodeDef
}

function extension(): ComfyExtension {
  const groupExtension = appMock.registerExtension.mock.calls.find(
    ([registered]) => registered.name === 'Comfy.GroupNode'
  )?.[0]
  if (!groupExtension) throw new Error('GroupNode extension was not registered')
  return groupExtension as ComfyExtension
}

function addCustomNodeDefs(defs: Record<string, ComfyNodeDef>) {
  const groupExtension = extension()
  if (!groupExtension.addCustomNodeDefs) {
    throw new Error('GroupNode extension does not implement addCustomNodeDefs')
  }
  groupExtension.addCustomNodeDefs(defs, fromPartial<ComfyApp>(appMock))
}

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  appMock.registerNodeDef.mockReset()
  widgetStoreMock.inputIsWidget.mockClear()
  LiteGraph.registered_node_types = {}
  addCustomNodeDefs({})
})

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
    external: (number | string | null)[][] = []
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

  it('ignores external links without a type and accumulates multiple slots', () => {
    const config = configFrom(
      [],
      [
        [0, 1, null],
        [0, 2, 'LATENT'],
        [0, 3, 'IMAGE']
      ]
    )

    expect(config.externalFrom[0]).toEqual({ 2: 'LATENT', 3: 'IMAGE' })
  })
})

describe('GroupNodeConfig.getNodeDef', () => {
  const imageNodeDef = makeNodeDef({
    name: 'ImageNode',
    input: {
      required: {
        image: ['IMAGE', {}],
        mode: [['fast', 'slow'], {}]
      },
      optional: {
        strength: ['FLOAT', { default: 1 }]
      }
    },
    output: ['IMAGE'],
    output_name: ['image'],
    output_is_list: [false]
  })

  beforeEach(() => {
    addCustomNodeDefs({ ImageNode: imageNodeDef })
  })

  it('returns registered definitions for normal node types', () => {
    const config = new GroupNodeConfig('group', {
      nodes: [{ index: 0, type: 'ImageNode' }],
      links: [],
      external: []
    })

    expect(config.getNodeDef({ index: 0, type: 'ImageNode' })).toBe(
      imageNodeDef
    )
  })

  it('returns undefined for nodes without an index or a known type', () => {
    const config = new GroupNodeConfig('group', {
      nodes: [{ type: 'UnknownNode' }],
      links: [],
      external: []
    })

    expect(config.getNodeDef({ type: 'UnknownNode' })).toBeUndefined()
  })

  it('skips unlinked primitive nodes', () => {
    const config = new GroupNodeConfig('group', {
      nodes: [{ index: 0, type: 'PrimitiveNode' }],
      links: [],
      external: []
    })

    expect(
      config.getNodeDef({ index: 0, type: 'PrimitiveNode' })
    ).toBeUndefined()
  })

  it('derives primitive node type from the outgoing link type', () => {
    const config = new GroupNodeConfig('group', {
      nodes: [
        { index: 0, type: 'PrimitiveNode' },
        { index: 1, type: 'ImageNode' }
      ],
      links: [[0, 0, 1, 0, 1, 'IMAGE'] as SerialisedLLinkArray],
      external: []
    })

    expect(
      config.getNodeDef({ index: 0, type: 'PrimitiveNode' })
    ).toMatchObject({
      input: { required: { value: ['IMAGE', {}] } },
      output: ['IMAGE']
    })
  })

  it('falls back to null when primitive combo target spec is not primitive', () => {
    const config = new GroupNodeConfig('group', {
      nodes: [
        {
          index: 0,
          type: 'PrimitiveNode',
          outputs: [{ name: 'mode', widget: { name: 'mode' } }]
        },
        { index: 1, type: 'ImageNode' }
      ],
      links: [[0, 0, 1, 0, 1, 'COMBO'] as SerialisedLLinkArray],
      external: []
    })

    expect(config.getNodeDef(config.nodeData.nodes[0])).toMatchObject({
      input: { required: { value: [null, {}] } },
      output: [null]
    })
  })

  it('returns null for reroutes used only inside the group', () => {
    const config = new GroupNodeConfig('group', {
      nodes: [
        { index: 0, type: 'ImageNode' },
        { index: 1, type: 'Reroute' },
        { index: 2, type: 'ImageNode' }
      ],
      links: [
        [0, 0, 1, 0, 1, 'IMAGE'],
        [1, 0, 2, 0, 2, 'IMAGE']
      ] as SerialisedLLinkArray[],
      external: []
    })

    expect(config.getNodeDef({ index: 1, type: 'Reroute' })).toBeNull()
  })

  it('derives reroute type from outgoing target inputs', () => {
    const config = new GroupNodeConfig('group', {
      nodes: [
        { index: 0, type: 'Reroute' },
        {
          index: 1,
          type: 'ImageNode',
          inputs: [{ name: 'image', type: 'IMAGE' }]
        }
      ],
      links: [[0, 0, 1, 0, 1, 'IMAGE'] as SerialisedLLinkArray],
      external: [[0, 0, 'IMAGE']]
    })

    expect(config.getNodeDef({ index: 0, type: 'Reroute' })).toMatchObject({
      input: { required: { IMAGE: ['IMAGE', { forceInput: true }] } },
      output: ['IMAGE']
    })
  })

  it('derives reroute type from incoming output metadata', () => {
    const config = new GroupNodeConfig('group', {
      nodes: [
        { index: 0, type: 'ImageNode', outputs: [{ type: 'LATENT' }] },
        { index: 1, type: 'Reroute' }
      ],
      links: [[0, 0, 1, 0, 1, 'LATENT'] as SerialisedLLinkArray],
      external: [[1, 0, 'LATENT']]
    })

    expect(config.getNodeDef({ index: 1, type: 'Reroute' })).toMatchObject({
      input: { required: { LATENT: ['LATENT', { forceInput: true }] } },
      output: ['LATENT']
    })
  })

  it('derives pipe reroute type from external metadata when links omit it', () => {
    const config = new GroupNodeConfig('group', {
      nodes: [{ index: 0, type: 'Reroute' }],
      links: [],
      external: [[0, 0, 'MASK']]
    })

    expect(config.getNodeDef({ index: 0, type: 'Reroute' })).toMatchObject({
      input: { required: { MASK: ['MASK', { forceInput: true }] } },
      output: ['MASK']
    })
  })
})

describe('GroupNodeConfig input and output mapping', () => {
  function configWithNode(node: GroupNodeWorkflowData['nodes'][number]) {
    const config = new GroupNodeConfig('group', {
      nodes: [node],
      links: [],
      external: [],
      config: {
        0: {
          input: {
            hidden: { visible: false },
            renamed: { name: 'Custom Name' }
          },
          output: {
            1: { name: 'Custom Output' },
            2: { visible: false }
          }
        }
      }
    })
    config.nodeDef = makeNodeDef({
      input: { required: {} },
      output: [],
      output_name: [],
      output_is_list: []
    })
    return config
  }

  it('renames duplicate inputs and adds seed control metadata', () => {
    const config = configWithNode({
      index: 0,
      type: 'Sampler',
      title: 'Sampler A',
      inputs: [{ name: 'seed', label: 'Seed Label' }]
    })
    const seenInputs = { seed: 1, 'Sampler A seed': 1 }
    const result = config.getInputConfig(
      { index: 0, type: 'Sampler', title: 'Sampler A' },
      'seed',
      seenInputs,
      ['INT', {}]
    )

    expect(result.name).toBe('Sampler A 1 seed')
    expect(result.config).toEqual([
      'INT',
      { control_after_generate: 'Sampler A control_after_generate' }
    ])
  })

  it('maps image upload widget aliases through converted widget names', () => {
    const config = configWithNode({ index: 0, type: 'LoadImage' })
    config.oldToNewWidgetMap[0] = { customImage: 'Uploaded Image' }

    expect(
      config.getInputConfig({ index: 0, type: 'LoadImage' }, 'renamed', {}, [
        'IMAGEUPLOAD',
        { widget: 'customImage' }
      ])
    ).toMatchObject({
      name: 'Custom Name',
      config: ['IMAGEUPLOAD', { widget: 'Uploaded Image' }]
    })
  })

  it('splits widget inputs, socket inputs, and converted widget slots', () => {
    const config = configWithNode({
      index: 0,
      type: 'MixedNode',
      inputs: [{ name: 'mode', widget: { name: 'mode' } }]
    })

    const result = config.processWidgetInputs(
      {
        mode: ['COMBO', {}],
        image: ['IMAGE', {}]
      },
      {
        index: 0,
        type: 'MixedNode',
        inputs: [{ name: 'mode', widget: { name: 'mode' } }]
      },
      ['mode', 'image'],
      {}
    )

    expect(result.slots).toEqual(['image'])
    expect(result.converted.get(0)).toBe('mode')
    expect(config.oldToNewWidgetMap[0].mode).toBeNull()
  })

  it('adds visible unlinked input slots and skips hidden configured inputs', () => {
    const config = configWithNode({
      index: 0,
      type: 'InputNode'
    })
    const inputMap: Record<number, number> = {}
    config.processInputSlots(
      {
        image: ['IMAGE', {}],
        hidden: ['LATENT', {}]
      },
      { index: 0, type: 'InputNode' },
      ['image', 'hidden'],
      {},
      inputMap,
      {}
    )

    expect(config.nodeDef?.input?.required).toEqual({ image: ['IMAGE', {}] })
    expect(inputMap).toEqual({ 0: 0 })
  })

  it('adds output metadata, hides linked/internal outputs, and dedupes labels', () => {
    const config = configWithNode({
      index: 0,
      type: 'OutputNode',
      title: 'Output A',
      outputs: [{ name: 'image', label: 'Rendered' }]
    })
    config.linksFrom[0] = {
      0: [[0, 0, 1, 0, 1, 'IMAGE'] as SerialisedLLinkArray]
    }
    config.processNodeOutputs(
      { index: 0, type: 'OutputNode', title: 'Output A' },
      { Rendered: 1 },
      {
        input: { required: {} },
        output: ['IMAGE', 'LATENT', 'MASK'],
        output_name: ['image', 'latent', 'mask'],
        output_is_list: [false, true, false]
      }
    )

    expect(config.outputVisibility).toEqual([false, true, false])
    expect(config.nodeDef?.output).toEqual(['LATENT'])
    expect(config.nodeDef?.output_is_list).toEqual([true])
    expect(config.nodeDef?.output_name).toEqual(['Custom Output'])
  })
})

describe('GroupNodeConfig.registerFromWorkflow', () => {
  it('adds missing type actions and skips registration for incomplete groups', async () => {
    const groupNodes: Record<string, GroupNodeWorkflowData> = {
      Broken: {
        nodes: [{ index: 0, type: 'MissingNode' }],
        links: [],
        external: []
      }
    }
    const missingNodeTypes: Parameters<
      typeof GroupNodeConfig.registerFromWorkflow
    >[1] = []

    await GroupNodeConfig.registerFromWorkflow(groupNodes, missingNodeTypes)

    expect(appMock.registerNodeDef).not.toHaveBeenCalled()
    expect(missingNodeTypes).toHaveLength(2)
    expect(missingNodeTypes[0]).toMatchObject({
      type: 'MissingNode',
      hint: " (In group node 'workflow>Broken')"
    })

    const action = missingNodeTypes[1]
    if (typeof action === 'string') {
      throw new Error('Expected an action entry for the broken group node')
    }
    const target = document.createElement('button')
    const { callback } = action.action as {
      callback: (event: MouseEvent) => void
    }
    const event = new MouseEvent('click')
    Object.defineProperty(event, 'target', { value: target })
    callback(event)
    expect(groupNodes.Broken).toBeUndefined()
    expect(target.textContent).toBe('Removed')
    expect(target.style.pointerEvents).toBe('none')
  })

  it('registers complete group node types and stores their generated node defs', async () => {
    addCustomNodeDefs({
      ImageNode: makeNodeDef({
        name: 'ImageNode',
        input: { required: { image: ['IMAGE', {}] } },
        output: ['IMAGE'],
        output_name: ['image'],
        output_is_list: [false]
      })
    })
    LiteGraph.registered_node_types.ImageNode = class extends LGraphNode {}

    await GroupNodeConfig.registerFromWorkflow(
      {
        Complete: {
          nodes: [{ index: 0, type: 'ImageNode' }],
          links: [],
          external: [[0, 0, 'IMAGE']]
        }
      },
      []
    )

    expect(appMock.registerNodeDef).toHaveBeenCalledWith(
      'workflow>Complete',
      expect.objectContaining({
        category: 'group nodes>workflow',
        display_name: 'Complete',
        name: 'workflow>Complete'
      })
    )
  })
})
