import { cloneDeep } from 'es-toolkit'
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock(import('@/scripts/app'))

import { i18n, mergeCustomNodesI18n } from '@/i18n'
import type {
  ExportedSubgraphInstance,
  IContextMenuValue
} from '@/lib/litegraph/src/litegraph'
import { LiteGraph, SubgraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestRootGraph,
  createTestSubgraphData
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import type { ComfyNodeDef as ComfyNodeDefV1 } from '@comfyorg/object-info-parser'
import { reportError } from '@comfyorg/telemetry/reportError'
import { app } from '@/scripts/app'
import { useLitegraphService } from '@/services/litegraphService'
import { useWidgetStore } from '@/stores/widgetStore'
import {
  createMockCanvasRenderingContext2D,
  stubCanvasGetContext
} from '@/utils/__tests__/canvasTestUtils'

const enMessages = cloneDeep(i18n.global.getLocaleMessage('en'))
const zhMessages = cloneDeep(i18n.global.getLocaleMessage('zh'))

function createNodeDefV1(
  overrides: Partial<ComfyNodeDefV1> = {}
): ComfyNodeDefV1 {
  return {
    name: 'TestNode',
    display_name: 'Test Node',
    category: 'test',
    python_module: 'test',
    description: 'Test node',
    output: ['IMAGE'],
    output_is_list: [false],
    output_name: ['IMAGE'],
    output_node: false,
    input: { required: {} },
    ...overrides
  }
}

function subgraphInstanceData(type: string): ExportedSubgraphInstance {
  return {
    id: -1,
    type,
    pos: [0, 0],
    size: [100, 100],
    inputs: [],
    outputs: [],
    flags: {},
    order: 0,
    mode: 0
  }
}

describe('useLitegraphService().registerNodeDef preview ownership', () => {
  it('opts generated nodes and their subclasses into default output previews', async () => {
    const nodeName = 'TestDefaultPreviewOwnership'
    await useLitegraphService().registerNodeDef(
      nodeName,
      createNodeDefV1({ name: nodeName })
    )
    const NodeType = LiteGraph.registered_node_types[nodeName]
    assert.exists(NodeType)
    class DerivedNode extends NodeType {}

    const node = LiteGraph.createNode(nodeName)
    assert.exists(node)
    const derived = new DerivedNode(nodeName)

    expect([node.hideOutputImages, derived.hideOutputImages]).toEqual([
      false,
      false
    ])
  })
})

describe('useLitegraphService().registerSubgraphNodeDef ownership', () => {
  it('binds a colliding subgraph type to the graph receiving the node', () => {
    const subgraphId = '00000000-0000-4000-8000-000000000123'
    const visibleGraph = createTestRootGraph()
    const backgroundGraph = createTestRootGraph()
    const visibleSubgraph = visibleGraph.createSubgraph(
      createTestSubgraphData({
        id: subgraphId,
        name: 'Visible definition',
        inputs: [{ id: 'visible-slot', name: 'visibleSlot', type: 'STRING' }]
      })
    )
    const backgroundSubgraph = backgroundGraph.createSubgraph(
      createTestSubgraphData({
        id: subgraphId,
        name: 'Background definition',
        inputs: [{ id: 'background-slot', name: 'backgroundSlot', type: 'INT' }]
      })
    )
    const visibleNodeDef = createNodeDefV1({
      name: subgraphId,
      display_name: 'Visible subgraph',
      input: { required: { visibleOnly: ['STRING', {}] } }
    })
    const backgroundNodeDef = createNodeDefV1({
      name: subgraphId,
      display_name: 'Background subgraph',
      input: { required: { backgroundOnly: ['INT', {}] } }
    })
    const visibleInstanceData = {
      ...subgraphInstanceData(subgraphId),
      properties: { definitionOwner: 'visible' }
    }
    const backgroundInstanceData = {
      ...subgraphInstanceData(subgraphId),
      properties: { definitionOwner: 'background' }
    }
    Reflect.set(app, 'rootGraph', visibleGraph)
    useLitegraphService().registerSubgraphNodeDef(
      visibleNodeDef,
      visibleSubgraph,
      visibleInstanceData
    )
    useLitegraphService().registerSubgraphNodeDef(
      backgroundNodeDef,
      backgroundSubgraph,
      backgroundInstanceData
    )

    const node = LiteGraph.createNode(subgraphId)
    assert.instanceOf(node, SubgraphNode)
    visibleGraph.add(node)

    expect(node.subgraph).toBe(visibleSubgraph)
    expect(node.inputs.map(({ name }) => name)).toEqual([
      'visibleSlot',
      'visibleOnly'
    ])
    expect(node.constructor.nodeData?.display_name).toBe('Visible subgraph')
    expect(node.properties.definitionOwner).toBe('visible')

    const backgroundNode = LiteGraph.createNode(subgraphId, undefined, {
      targetGraph: backgroundGraph
    })
    assert.instanceOf(backgroundNode, SubgraphNode)
    backgroundGraph.add(backgroundNode)

    expect(backgroundNode.subgraph).toBe(backgroundSubgraph)
    expect(backgroundNode.inputs.map(({ name }) => name)).toEqual([
      'backgroundSlot',
      'backgroundOnly'
    ])
    expect(backgroundNode.constructor.nodeData?.display_name).toBe(
      'Background subgraph'
    )
    expect(backgroundNode.properties.definitionOwner).toBe('background')
    expect(Object.hasOwn(backgroundNode, 'targetGraph')).toBe(false)

    Reflect.set(app, 'rootGraph', backgroundGraph)
    const explicitVisibleNode = LiteGraph.createNode(subgraphId, undefined, {
      targetGraph: visibleGraph
    })
    assert.instanceOf(explicitVisibleNode, SubgraphNode)
    expect(explicitVisibleNode.subgraph).toBe(visibleSubgraph)
    expect(explicitVisibleNode.inputs.map(({ name }) => name)).toEqual([
      'visibleSlot',
      'visibleOnly'
    ])
    expect(explicitVisibleNode.constructor.nodeData?.display_name).toBe(
      'Visible subgraph'
    )

    const backgroundClone = backgroundNode.clone()
    assert.instanceOf(backgroundClone, SubgraphNode)
    expect(backgroundClone.subgraph).toBe(backgroundSubgraph)

    const restoredGraph = createTestRootGraph()
    restoredGraph.configure(backgroundGraph.serialize())
    const restoredNode = restoredGraph.nodes[0]
    assert.instanceOf(restoredNode, SubgraphNode)

    expect(restoredNode.subgraph.rootGraph).toBe(restoredGraph)
    expect(restoredNode.subgraph.name).toBe('Background definition')
  })

  it('executes a title-only extension constructor and override for explicit A while B is active', () => {
    const subgraphId = '00000000-0000-4000-8000-000000000125'
    const visibleGraph = createTestRootGraph()
    const backgroundGraph = createTestRootGraph()
    const visibleSubgraph = visibleGraph.createSubgraph(
      createTestSubgraphData({ id: subgraphId, name: 'Visible definition' })
    )
    const backgroundSubgraph = backgroundGraph.createSubgraph(
      createTestSubgraphData({ id: subgraphId, name: 'Background definition' })
    )
    Reflect.set(app, 'rootGraph', visibleGraph)
    useLitegraphService().registerSubgraphNodeDef(
      createNodeDefV1({ name: subgraphId }),
      visibleSubgraph,
      subgraphInstanceData(subgraphId)
    )
    useLitegraphService().registerSubgraphNodeDef(
      createNodeDefV1({ name: subgraphId }),
      backgroundSubgraph,
      subgraphInstanceData(subgraphId)
    )
    const Registered = LiteGraph.registered_node_types[subgraphId]
    assert.exists(Registered)
    const constructorTitles: string[] = []
    class DerivedSubgraphNode extends Registered {
      constructor(title: string) {
        super(title)
        constructorTitles.push(title)
        this.properties.extensionOwner = this.graph?.id
      }

      override getTitle() {
        return `Extension: ${super.getTitle()}`
      }
    }
    LiteGraph.registerNodeType(subgraphId, DerivedSubgraphNode)
    Reflect.set(app, 'rootGraph', backgroundGraph)

    const node = LiteGraph.createNode(subgraphId, 'Explicit A', {
      targetGraph: visibleGraph
    })

    assert.instanceOf(node, SubgraphNode)
    expect(node).toBeInstanceOf(DerivedSubgraphNode)
    expect(constructorTitles).toEqual(['Explicit A'])
    expect(node.getTitle()).toBe('Extension: Test Node')
    expect(node.properties.extensionOwner).toBe(visibleGraph.id)
    expect(node.graph).toBe(visibleGraph)
    expect(node.subgraph).toBe(visibleSubgraph)
  })

  it('preserves outer ownership across nested factory construction and an inner constructor failure', () => {
    const subgraphId = '00000000-0000-4000-8000-000000000126'
    const innerType = 'TestNestedOwnedSubgraph'
    const throwingType = 'TestThrowingNestedOwnedSubgraph'
    const graphA = createTestRootGraph()
    const graphB = createTestRootGraph()
    const subgraphA = graphA.createSubgraph(
      createTestSubgraphData({ id: subgraphId, name: 'A definition' })
    )
    const subgraphB = graphB.createSubgraph(
      createTestSubgraphData({ id: subgraphId, name: 'B definition' })
    )
    useLitegraphService().registerSubgraphNodeDef(
      createNodeDefV1({ name: subgraphId }),
      subgraphA,
      subgraphInstanceData(subgraphId)
    )
    useLitegraphService().registerSubgraphNodeDef(
      createNodeDefV1({ name: subgraphId }),
      subgraphB,
      subgraphInstanceData(subgraphId)
    )
    const Registered = LiteGraph.registered_node_types[subgraphId]
    assert.exists(Registered)
    const nestedNodes: ReturnType<typeof LiteGraph.createNode>[] = []
    const failedInnerDefinitions: SubgraphNode['subgraph'][] = []
    class InnerSubgraphNode extends Registered {}
    class ThrowingSubgraphNode extends Registered {
      constructor(title: string) {
        super(title)
        assert.instanceOf(this, SubgraphNode)
        failedInnerDefinitions.push(this.subgraph)
        throw new Error('Nested constructor failed')
      }
    }
    class OuterSubgraphNode extends Registered {
      constructor(title: string) {
        nestedNodes.push(
          LiteGraph.createNode(innerType, 'Inner B', { targetGraph: graphB })
        )
        nestedNodes.push(
          LiteGraph.createNode(throwingType, 'Throwing B', {
            targetGraph: graphB
          })
        )
        super(title)
      }
    }
    LiteGraph.registerNodeType(innerType, InnerSubgraphNode)
    LiteGraph.registerNodeType(throwingType, ThrowingSubgraphNode)
    LiteGraph.registerNodeType(subgraphId, OuterSubgraphNode)
    Reflect.set(app, 'rootGraph', graphB)

    const outer = LiteGraph.createNode(subgraphId, 'Outer A', {
      targetGraph: graphA
    })
    const subsequent = LiteGraph.createNode(innerType, 'Subsequent A', {
      targetGraph: graphA
    })
    const direct = new InnerSubgraphNode('Active B')

    assert.instanceOf(outer, SubgraphNode)
    expect(outer).toBeInstanceOf(OuterSubgraphNode)
    expect(outer.subgraph).toBe(subgraphA)
    expect(outer.graph).toBe(graphA)
    const [inner, failed] = nestedNodes
    assert.instanceOf(inner, SubgraphNode)
    expect(inner.subgraph).toBe(subgraphB)
    expect(inner.graph).toBe(graphB)
    expect(failed).toBeNull()
    expect(failedInnerDefinitions).toEqual([subgraphB])
    expect(console.error).toHaveBeenCalledWith(
      new Error('Nested constructor failed')
    )
    assert.instanceOf(subsequent, SubgraphNode)
    expect(subsequent.subgraph).toBe(subgraphA)
    expect(subsequent.graph).toBe(graphA)
    assert.instanceOf(direct, SubgraphNode)
    expect(direct.subgraph).toBe(subgraphB)
    expect(direct.graph).toBe(graphB)
  })

  it('reports and refuses a subgraph type missing from the target graph', () => {
    const subgraphId = '00000000-0000-4000-8000-000000000124'
    const ownerGraph = createTestRootGraph()
    const targetGraph = createTestRootGraph()
    const subgraph = ownerGraph.createSubgraph(
      createTestSubgraphData({ id: subgraphId })
    )
    useLitegraphService().registerSubgraphNodeDef(
      createNodeDefV1({ name: subgraphId }),
      subgraph,
      subgraphInstanceData(subgraphId)
    )

    const node = LiteGraph.createNode(subgraphId, undefined, {
      targetGraph
    })
    const repeated = LiteGraph.createNode(subgraphId, undefined, {
      targetGraph
    })

    expect(node).toBeNull()
    expect(repeated).toBeNull()
    expect(reportError).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      errorType: 'failure_creating_subgraph_node_target_missing',
      surface: 'graph',
      context: { subgraphId, rootGraphId: targetGraph.id },
      sentryMode: 'once_per_page'
    })

    const Registered = LiteGraph.registered_node_types[subgraphId]
    assert.exists(Registered)
    Reflect.set(app, 'rootGraph', targetGraph)
    expect(() => new Registered(subgraphId)).toThrow(
      'Subgraph node type is missing from the target graph'
    )
  })

  it('caps missing-target reports per root graph at 25 distinct definitions', () => {
    const targetGraph = createTestRootGraph()
    const subgraphIds = Array.from(
      { length: 26 },
      (_, i) => `00000000-0000-4000-9000-${i.toString().padStart(12, '0')}`
    )
    for (const subgraphId of subgraphIds) {
      const ownerGraph = createTestRootGraph()
      const subgraph = ownerGraph.createSubgraph(
        createTestSubgraphData({ id: subgraphId })
      )
      useLitegraphService().registerSubgraphNodeDef(
        createNodeDefV1({ name: subgraphId }),
        subgraph,
        subgraphInstanceData(subgraphId)
      )
      expect(
        LiteGraph.createNode(subgraphId, undefined, { targetGraph })
      ).toBeNull()
    }

    expect(reportError).toHaveBeenCalledTimes(25)
  })
})

describe('useLitegraphService().getCanvasCenter', () => {
  it('returns origin when canvas is not yet initialised', () => {
    app.canvas.ds.visible_area.set([10, 20, 200, 100])
    Reflect.set(app, 'rootGraphOrUndefined', undefined)

    const center = useLitegraphService().getCanvasCenter()

    expect(center).toEqual([0, 0])
  })

  it.for<{
    dpr: number
    visibleArea: [number, number, number, number]
    center: [number, number]
  }>([
    { dpr: 1, visibleArea: [10, 20, 200, 100], center: [110, 70] },
    { dpr: 2, visibleArea: [0, 0, 800, 600], center: [400, 300] }
  ])(
    'returns the CSS-pixel visible-area centre at DPR $dpr',
    ({ dpr, visibleArea, center }) => {
      app.canvas.dpr = dpr
      app.canvas.ds.visible_area.set(visibleArea)

      expect(useLitegraphService().getCanvasCenter()).toEqual(center)
    }
  )
})

describe('useLitegraphService().registerNodeDef slot text', () => {
  const nodeName = 'TestBackendSlotText'

  const nodeDef: ComfyNodeDefV1 = {
    name: nodeName,
    display_name: 'Test Backend Slot Text',
    category: 'testing',
    python_module: 'nodes',
    description: '',
    input: {
      required: {
        seed: ['INT', { display_name: 'Live Seed Label', default: 0 }],
        mask: ['MASK', { display_name: 'Live Mask Label' }]
      }
    },
    output: ['LATENT'],
    output_name: ['Live Latent Name'],
    output_node: false
  }

  function mergeBundledSlotText(text: string | null) {
    i18n.global.mergeLocaleMessage('en', {
      nodeDefs: {
        [nodeName]: {
          inputs: { seed: { name: text }, mask: { name: text } },
          outputs: { 0: { name: text } }
        }
      }
    })
  }

  beforeEach(async () => {
    mergeBundledSlotText('stale bundled label')
    mergeCustomNodesI18n({
      en: {
        nodeDefs: {
          [nodeName]: {
            inputs: { mask: { name: 'Translated Mask Label' } }
          }
        }
      }
    })
    await useLitegraphService().registerNodeDef(nodeName, nodeDef)
  })

  afterEach(() => {
    mergeCustomNodesI18n({})
    i18n.global.setLocaleMessage('en', cloneDeep(enMessages))
  })

  it('labels widgets, sockets and outputs from the live backend', () => {
    const node = LiteGraph.createNode(nodeName)
    const localizedName = (name: string) =>
      node?.inputs.find((input) => input.name === name)?.localized_name
    const mask = node?.inputs.find((input) => input.name === 'mask')

    expect(node?.widgets?.[0]?.label).toBe('Live Seed Label')
    expect(localizedName('seed')).toBe('Live Seed Label')
    expect(mask?.label || mask?.localized_name || mask?.name).toBe(
      'Translated Mask Label'
    )
    expect(node?.outputs[0]?.localized_name).toBe('Live Latent Name')
  })
})

describe('useLitegraphService().registerNodeDef slot text (non-en)', () => {
  const nodeName = 'TestNonEnSlotText'

  const nodeDef: ComfyNodeDefV1 = {
    name: nodeName,
    display_name: 'Test Non En Slot Text',
    category: 'testing',
    python_module: 'nodes',
    description: '',
    input: {
      required: {
        seed: ['INT', { display_name: 'Live Seed Label', default: 0 }],
        mask: ['MASK', { display_name: 'Live Mask Label' }]
      }
    },
    output: ['LATENT'],
    output_name: ['Live Latent Name'],
    output_node: false
  }

  beforeEach(async () => {
    i18n.global.mergeLocaleMessage('en', {
      nodeDefs: {
        [nodeName]: {
          inputs: { seed: { name: 'stale en snapshot' } },
          outputs: { 0: { name: 'stale en snapshot' } }
        }
      }
    })
    i18n.global.mergeLocaleMessage('zh', {
      nodeDefs: { [nodeName]: { inputs: { mask: { name: '翻译遮罩' } } } }
    })
    i18n.global.locale.value = 'zh'
    await useLitegraphService().registerNodeDef(nodeName, nodeDef)
  })

  afterEach(() => {
    i18n.global.locale.value = 'en'
    i18n.global.setLocaleMessage('zh', cloneDeep(zhMessages))
    i18n.global.setLocaleMessage('en', cloneDeep(enMessages))
  })

  it('prefers the translation over the live backend value', () => {
    const node = LiteGraph.createNode(nodeName)
    const mask = node?.inputs.find((input) => input.name === 'mask')

    expect(mask?.localized_name).toBe('翻译遮罩')
  })

  it('falls back to the live backend value, not the en snapshot', () => {
    const node = LiteGraph.createNode(nodeName)
    const seed = node?.inputs.find((input) => input.name === 'seed')

    expect(node?.widgets?.[0]?.label).toBe('Live Seed Label')
    expect(seed?.localized_name).toBe('Live Seed Label')
    expect(node?.outputs[0]?.localized_name).toBe('Live Latent Name')
  })
})

describe('useLitegraphService().registerNodeDef custom widget metadata', () => {
  const nodeName = 'TestFrozenCustomWidget'
  const widgetType = 'FROZEN_CUSTOM_WIDGET'
  let retainedWidget: IBaseWidget

  beforeEach(async () => {
    useWidgetStore().registerCustomWidgets({
      [widgetType]: (node, inputName) => {
        retainedWidget = Object.preventExtensions({
          name: inputName,
          type: 'legacy_test',
          value: 0,
          options: {},
          y: 0
        })
        node.widgets ??= []
        node.widgets.push(retainedWidget)
        return retainedWidget
      }
    })
    await useLitegraphService().registerNodeDef(nodeName, {
      name: nodeName,
      display_name: 'Test Frozen Custom Widget',
      category: 'testing',
      python_module: 'nodes',
      description: '',
      input: {
        required: {
          custom: [
            widgetType,
            {
              display_name: 'Live Custom Label',
              default: 0,
              advanced: true,
              hidden: true
            }
          ]
        }
      },
      output: [],
      output_name: [],
      output_node: false
    })
  })

  it('applies metadata to the concrete widget stored on the node', () => {
    const node = LiteGraph.createNode(nodeName)
    const widget = node?.widgets?.[0]

    expect(widget).not.toBe(retainedWidget)
    expect(widget?.label).toBe('Live Custom Label')
    expect(widget?.options.advanced).toBe(true)
    expect(widget?.options.hidden).toBe(true)
    expect(widget?.hidden).toBe(true)
  })
})

describe('canvas image context menu', () => {
  it.for([
    { state: 'selected', imageIndex: 0, overIndex: null },
    { state: 'hovered', imageIndex: null, overIndex: 0 }
  ])(
    'offers image actions for the $state image at index zero',
    async (state) => {
      const nodeName = 'TestFirstImageMenu'
      await useLitegraphService().registerNodeDef(
        nodeName,
        createNodeDefV1({ name: nodeName })
      )
      const node = LiteGraph.createNode(nodeName)
      assert.exists(node)
      const image = document.createElement('img')
      image.src = 'http://localhost/view?filename=first.png'
      node.imgs = [image]
      node.imageIndex = state.imageIndex
      node.overIndex = state.overIndex
      const options: (IContextMenuValue | null)[] = []

      node.getExtraMenuOptions?.(app.canvas, options)

      expect(options).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ content: 'Open Image' }),
          expect.objectContaining({ content: 'Copy Image' }),
          expect.objectContaining({ content: 'Save Image' })
        ])
      )
    }
  )
})

describe('canvas Copy Image action', () => {
  it('preserves original bounds when clipboard requires PNG conversion', async () => {
    const nodeName = 'TestOriginalImageCopy'
    await useLitegraphService().registerNodeDef(
      nodeName,
      createNodeDefV1({ name: nodeName })
    )
    const node = LiteGraph.createNode(nodeName)
    assert.exists(node)
    const display = document.createElement('img')
    display.src = 'blob:display-copy'
    display.dataset.fullSrc = 'http://localhost/view?filename=original.webp'
    display.width = 1024
    display.height = 512
    node.imgs = [display]
    node.imageIndex = 0
    const original = document.createElement('img')
    original.width = 4096
    original.height = 2048
    vi.spyOn(original, 'decode').mockResolvedValue(undefined)
    vi.stubGlobal('createImageBitmap', undefined)
    vi.spyOn(globalThis, 'Image').mockImplementation(function () {
      return original
    })
    const context = createMockCanvasRenderingContext2D()
    stubCanvasGetContext(context)
    let bounds: number[] = []
    const png = new Blob(['original pixels'], { type: 'image/png' })
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      function (this: HTMLCanvasElement, callback) {
        bounds = [this.width, this.height]
        callback(png)
      }
    )
    vi.mocked(fetch).mockResolvedValue(
      new Response(new Blob(['original'], { type: 'image/webp' }))
    )
    const write = vi
      .spyOn(navigator.clipboard, 'write')
      .mockResolvedValue(undefined)
    const options: (IContextMenuValue | null)[] = []
    node.getExtraMenuOptions?.(app.canvas, options)
    const copy = options.find((option) => option?.content === 'Copy Image')
    assert.exists(copy?.callback)

    await copy.callback.call(document.createElement('div'))

    expect(fetch).toHaveBeenCalledWith(
      new URL('http://localhost/view?filename=original.webp')
    )
    expect(bounds).toEqual([4096, 2048])
    expect(write).toHaveBeenCalledOnce()
    const copied = await write.mock.calls[0][0][0].getType('image/png')
    expect(await copied.text()).toBe('original pixels')
  })
})

describe('addInputs ordering with forceInput', () => {
  it('preserves declaration order when forceInput is in the middle', async () => {
    const nodeDef = createNodeDefV1({
      name: 'ForceInputMiddle',
      input: {
        required: {
          seed: ['INT', { default: 0 }],
          image: ['IMAGE', {}],
          steps: ['INT', { default: 20 }]
        }
      },
      input_order: { required: ['seed', 'image', 'steps'] }
    })

    await useLitegraphService().registerNodeDef('ForceInputMiddle', nodeDef)
    const node = LiteGraph.createNode('ForceInputMiddle')!

    expect(node.inputs.map((input) => input.name)).toEqual([
      'seed',
      'image',
      'steps'
    ])
  })

  it('preserves order with forceInput INT between widget inputs', async () => {
    const nodeDef = createNodeDefV1({
      name: 'ForceInputBetween',
      input: {
        required: {
          cfg: ['FLOAT', { default: 7 }],
          forced_seed: ['INT', { default: 0, forceInput: true }],
          steps: ['INT', { default: 20 }]
        }
      },
      input_order: { required: ['cfg', 'forced_seed', 'steps'] }
    })

    await useLitegraphService().registerNodeDef('ForceInputBetween', nodeDef)
    const node = LiteGraph.createNode('ForceInputBetween')!

    expect(node.inputs.map((input) => input.name)).toEqual([
      'cfg',
      'forced_seed',
      'steps'
    ])
  })

  it('preserves order with multiple interspersed forceInput inputs', async () => {
    const nodeDef = createNodeDefV1({
      name: 'MultiForceInput',
      input: {
        required: {
          width: ['INT', { default: 512 }],
          model: ['MODEL', {}],
          height: ['INT', { default: 512 }],
          clip: ['CLIP', {}],
          steps: ['INT', { default: 20 }]
        }
      },
      input_order: {
        required: ['width', 'model', 'height', 'clip', 'steps']
      }
    })

    await useLitegraphService().registerNodeDef('MultiForceInput', nodeDef)
    const node = LiteGraph.createNode('MultiForceInput')!

    expect(node.inputs.map((input) => input.name)).toEqual([
      'width',
      'model',
      'height',
      'clip',
      'steps'
    ])
  })

  it('keeps all-widget input order unchanged', async () => {
    const nodeDef = createNodeDefV1({
      name: 'AllWidgets',
      input: {
        required: {
          seed: ['INT', { default: 0 }],
          cfg: ['FLOAT', { default: 7 }],
          steps: ['INT', { default: 20 }]
        }
      },
      input_order: { required: ['seed', 'cfg', 'steps'] }
    })

    await useLitegraphService().registerNodeDef('AllWidgets', nodeDef)
    const node = LiteGraph.createNode('AllWidgets')!

    expect(node.inputs.map((input) => input.name)).toEqual([
      'seed',
      'cfg',
      'steps'
    ])
  })

  it('keeps all-socket input order unchanged', async () => {
    const nodeDef = createNodeDefV1({
      name: 'AllSockets',
      input: {
        required: {
          model: ['MODEL', {}],
          clip: ['CLIP', {}],
          vae: ['VAE', {}]
        }
      },
      input_order: { required: ['model', 'clip', 'vae'] }
    })

    await useLitegraphService().registerNodeDef('AllSockets', nodeDef)
    const node = LiteGraph.createNode('AllSockets')!

    expect(node.inputs.map((input) => input.name)).toEqual([
      'model',
      'clip',
      'vae'
    ])
  })
})
