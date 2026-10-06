import { fromAny } from '@total-typescript/shoehorn'
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from 'vitest'
import { useChainCallback } from '@/composables/functional/useChainCallback'
import {
  addAutogrow,
  addDynamicCombo
} from '@/core/graph/widgets/__fixtures__/dynamicInputHelpers'
import { liveAutogrowGroupOf } from '@/core/graph/widgets/dynamicWidgets'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { realignGroupWidgetChildLinks } from '@/lib/litegraph/src/linkDeduplication'
import type { SerialisableGraph } from '@/lib/litegraph/src/types/serialisation'
import type {
  ComfyNodeDef as ComfyNodeDefV1,
  InputSpec
} from '@/schemas/nodeDefSchema'
import { app } from '@/scripts/app'
import { useLitegraphService } from '@/services/litegraphService'
import { useLinkStore } from '@/stores/linkStore'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'

const originalNamedValuesRestore = LiteGraph.namedValuesRestore
afterEach(() => {
  LiteGraph.namedValuesRestore = originalNamedValuesRestore
})
type TestAutogrowNode = LGraphNode & {
  comfyDynamic: { autogrow: Record<string, unknown> }
}

let addNodeInput: ReturnType<typeof useLitegraphService>['addNodeInput']
beforeEach(() => {
  ;({ addNodeInput } = useLitegraphService())
})

function nextTick() {
  return new Promise<void>((r) => requestAnimationFrame(() => r()))
}

function connectInput(node: LGraphNode, inputIndex: number, graph: LGraph) {
  const node2 = testNode()
  node2.addOutput('out', '*')
  graph.add(node2)
  const link = node2.connect(0, node, inputIndex)
  if (!link) throw new Error(`failed to connect input ${inputIndex}`)
  return link
}
function testNode() {
  const node = new LGraphNode('test')
  node.widgets = []
  return node as LGraphNode & Required<Pick<LGraphNode, 'widgets'>>
}

describe('Dynamic Combos', () => {
  test('Can add widget on selection', () => {
    const node = testNode()
    addDynamicCombo(node, [['INT'], ['INT', 'STRING']])
    expect(node.widgets.length).toBe(2)
    node.widgets[0].value = '1'
    expect(node.widgets.length).toBe(3)
  })
  test('Can add nested widgets', () => {
    const node = testNode()
    addDynamicCombo(node, [['INT'], [[[], ['STRING']]]])
    expect(node.widgets.length).toBe(2)
    node.widgets[0].value = '1'
    expect(node.widgets.length).toBe(2)
    node.widgets[1].value = '1'
    expect(node.widgets.length).toBe(3)
  })
  test('Can add input', () => {
    const node = testNode()
    addDynamicCombo(node, [['INT'], ['IMAGE']])
    expect(node.widgets.length).toBe(2)
    node.widgets[0].value = '1'
    expect(node.widgets.length).toBe(1)
    expect(node.inputs.length).toBe(2)
    expect(node.inputs[1].type).toBe('IMAGE')
  })
  test('Dynamically added inputs are well ordered', () => {
    const node = testNode()
    addDynamicCombo(node, [['INT'], ['IMAGE']])
    addDynamicCombo(node, [['INT'], ['IMAGE']])
    node.widgets[2].value = '1'
    node.widgets[0].value = '1'
    expect(node.widgets.length).toBe(2)
    expect(node.inputs.length).toBe(4)
    expect(node.inputs[1].name).toBe('0.0.0.0')
    expect(node.inputs[3].name).toBe('2.2.0.0')
  })
  test('liveAutogrowGroupOf reports a DynamicCombo key with an all-numeric final segment as belonging to no autogrow group', () => {
    // `0.0.0.0` is indistinguishable from a genuine autogrow ordinal by
    // name shape alone (see `nameShapeAutogrowGroupOf`'s documented false
    // positive) -- `liveAutogrowGroupOf` must not be fooled by it, since
    // this node has no `comfyDynamic.autogrow` group at all.
    const node = testNode()
    addDynamicCombo(node, [['INT'], ['IMAGE']])
    addDynamicCombo(node, [['INT'], ['IMAGE']])
    node.widgets[2].value = '1'
    node.widgets[0].value = '1'
    expect(node.inputs[1].name).toBe('0.0.0.0')
    expect(liveAutogrowGroupOf(node, '0.0.0.0')).toBeUndefined()
  })
  test('Shrinking dynamic inputs preserves remaining connections and disconnects removed links', () => {
    const graph = new LGraph()
    const node = testNode()
    addDynamicCombo(node, [[], ['IMAGE', 'IMAGE', 'IMAGE'], ['IMAGE']])
    graph.add(node)
    addNodeInput(node, { name: 'other', isOptional: false, type: 'IMAGE' })
    node.widgets[0].value = '1'
    const retained = connectInput(node, 1, graph)
    const removed = [connectInput(node, 2, graph), connectInput(node, 3, graph)]
    const removedSources = removed.map((link) =>
      graph.getNodeById(link.origin_id)
    )
    const unrelated = connectInput(node, 4, graph)
    const onConnectionsChange =
      vi.fn<NonNullable<LGraphNode['onConnectionsChange']>>()
    node.onConnectionsChange = onConnectionsChange

    node.widgets[0].value = '2'

    expect(node.getInputLink(1)).toBe(retained)
    expect(node.getInputLink(2)).toBe(unrelated)
    for (const link of removed) {
      expect(graph.getLink(link.id)).toBeUndefined()
    }
    for (const source of removedSources) {
      if (!source) throw new Error('Removed link source node not found')
      expect(source.isOutputConnected(0)).toBe(false)
    }
    const disconnectedLinks = onConnectionsChange.mock.calls
      .filter(([, , connected]) => !connected)
      .map(([, , , link]) => link)
    expect(disconnectedLinks).toHaveLength(2)
    expect(new Set(disconnectedLinks)).toEqual(new Set(removed))
  })
  test('Growing rebuild preserves retained connections', () => {
    const graph = new LGraph()
    const node = testNode()
    addDynamicCombo(node, [[], ['IMAGE'], ['IMAGE', 'IMAGE']])
    graph.add(node)
    addNodeInput(node, { name: 'other', isOptional: false, type: 'IMAGE' })
    node.widgets[0].value = '1'
    const retained = connectInput(node, 1, graph)
    const unrelated = connectInput(node, 2, graph)

    node.widgets[0].value = '2'

    expect(node.getInputLink(1)).toBe(retained)
    expect(node.getInputLink(3)).toBe(unrelated)
  })
  test('Replacing a linked input emits one connected callback', () => {
    const graph = new LGraph()
    const node = testNode()
    addDynamicCombo(node, [[], ['IMAGE'], ['IMAGE']])
    graph.add(node)
    node.widgets[0].value = '1'
    const link = connectInput(node, 1, graph)
    const onConnectionsChange = vi.fn()
    node.onConnectionsChange = onConnectionsChange

    node.widgets[0].value = '2'

    expect(onConnectionsChange).toHaveBeenCalledOnce()
    expect(onConnectionsChange).toHaveBeenCalledWith(
      LiteGraph.INPUT,
      1,
      true,
      link,
      node.inputs[1]
    )
  })
  test('Restoring serialised state preserves the saved node height', () => {
    const node = testNode()
    node.serialize_widgets = true
    addDynamicCombo(node, [['INT'], ['INT', 'STRING']])
    node.widgets[0].value = '1'
    node.setSize([node.size[0], 500])
    const data = node.serialize()

    const restored = testNode()
    addDynamicCombo(restored, [['INT'], ['INT', 'STRING']])
    restored.configure(data)

    expect(restored.widgets[0].value).toBe('1')
    expect(restored.widgets.length).toBe(3)
    expect(restored.size[1]).toBe(500)
  })
  test('Interactive combo selection still refits the node height', () => {
    const node = testNode()
    addDynamicCombo(node, [['INT'], ['INT', 'STRING']])
    node.setSize([node.size[0], 500])
    node.widgets[0].value = '1'
    node.widgets[0].callback?.('1')
    expect(node.size[1]).toBeLessThan(500)
  })
  test('Dynamically added widgets have tooltips', () => {
    const node = testNode()
    addDynamicCombo(node, [['INT'], ['STRING']])
    expect.soft(node.widgets[1].tooltip).toBe('0')
    node.widgets[0].value = '1'
    expect.soft(node.widgets[1].tooltip).toBe('1')
  })
  test('An edited nested value survives toggling the combo away and back after load (#16006)', () => {
    LiteGraph.namedValuesRestore = true
    const node = testNode()
    node.serialize_widgets = true
    addDynamicCombo(node, [['INT'], ['INT']])

    node.widgets[0].value = '1'
    node.widgets[1].value = 0.8
    const serialized = node.serialize()

    const reloaded = testNode()
    addDynamicCombo(reloaded, [['INT'], ['INT']])
    reloaded.configure(serialized)
    expect(reloaded.widgets[1].value).toBe(0.8)

    reloaded.widgets[1].value = 0.3

    reloaded.widgets[0].value = '0'
    reloaded.widgets[0].value = '1'

    expect(reloaded.widgets[1].value).toBe(0.3)
  })
  test('Same-name children keep separate values across options', () => {
    const node = testNode()
    addDynamicCombo(node, [['INT'], ['INT']])

    node.widgets[1].value = 3
    node.widgets[0].value = '1'
    expect(node.widgets[1].value).not.toBe(3)
    node.widgets[1].value = 7

    node.widgets[0].value = '0'
    expect(node.widgets[1].value).toBe(3)
    node.widgets[0].value = '1'
    expect(node.widgets[1].value).toBe(7)
    node.widgets[0].value = '0'
    expect(node.widgets[1].value).toBe(3)
  })
  test('Nested child keeps its value when its parent option is recreated', () => {
    const node = testNode()
    addDynamicCombo(node, [[[[], ['INT']]], ['INT']])
    node.widgets[1].value = '1'
    node.widgets[2].value = 7

    node.widgets[0].value = '1'
    node.widgets[0].value = '0'

    expect(node.widgets[1].value).toBe('1')
    expect(node.widgets[2].value).toBe(7)
  })
})
describe('Autogrow', () => {
  const inputsSpec = { required: { image: ['IMAGE', {}] } }
  test('Can name by prefix', () => {
    const graph = new LGraph()
    const node = testNode()
    graph.add(node)
    addAutogrow(node, { input: inputsSpec, prefix: 'test' })
    connectInput(node, 0, graph)
    connectInput(node, 1, graph)
    connectInput(node, 2, graph)
    expect(node.inputs.length).toBe(4)
    expect(node.inputs[0].name).toBe('0.test0')
    expect(node.inputs[2].name).toBe('0.test2')
  })
  test('Can name by list of names', () => {
    const graph = new LGraph()
    const node = testNode()
    graph.add(node)
    addAutogrow(node, { input: inputsSpec, names: ['a', 'b', 'c'] })
    connectInput(node, 0, graph)
    connectInput(node, 1, graph)
    connectInput(node, 2, graph)
    expect(node.inputs.length).toBe(3)
    expect(node.inputs[0].name).toBe('0.a')
    expect(node.inputs[2].name).toBe('0.c')
  })
  test('liveAutogrowGroupOf recognizes an explicit-names member even though it does not end in a digit', () => {
    // `0.b` does not end in an ordinal digit, so
    // `nameShapeAutogrowGroupOf` cannot recognize it (see its documented
    // false negative) -- `liveAutogrowGroupOf` must, since this node's
    // `comfyDynamic.autogrow['0']` really does own it.
    const graph = new LGraph()
    const node = testNode()
    graph.add(node)
    addAutogrow(node, { input: inputsSpec, names: ['a', 'b', 'c'] })
    connectInput(node, 0, graph)
    connectInput(node, 1, graph)
    expect(node.inputs[1].name).toBe('0.b')
    expect(liveAutogrowGroupOf(node, '0.b')).toBe('0')
    expect(liveAutogrowGroupOf(node, 'unrelated.b')).toBeUndefined()
  })
  test('Can add autogrow with min input count', () => {
    const node = testNode()
    addAutogrow(node, { min: 4, input: inputsSpec })
    expect(node.inputs.length).toBe(5)
  })
  test('Adding connections will cause growth up to max', () => {
    const graph = new LGraph()
    const node = testNode()
    graph.add(node)
    addAutogrow(node, { min: 1, input: inputsSpec, prefix: 'test', max: 3 })
    expect(node.inputs.length).toBe(2)

    connectInput(node, 0, graph)
    expect(node.inputs.length).toBe(2)
    connectInput(node, 1, graph)
    expect(node.inputs.length).toBe(3)
    connectInput(node, 2, graph)
    expect(node.inputs.length).toBe(3)
  })
  test('Removing connections decreases to min + 1', async () => {
    const graph = new LGraph()
    const node = testNode()
    graph.add(node)
    addAutogrow(node, { min: 4, input: inputsSpec, prefix: 'test' })
    connectInput(node, 3, graph)
    connectInput(node, 4, graph)
    connectInput(node, 5, graph)
    expect(node.inputs.length).toBe(7)

    node.disconnectInput(4)
    await nextTick()
    expect(node.inputs.length).toBe(6)
    node.disconnectInput(3)
    await nextTick()
    expect(node.inputs.length).toBe(5)

    connectInput(node, 0, graph)
    expect(node.inputs.length).toBe(5)
    node.disconnectInput(0)
    await nextTick()
    expect(node.inputs.length).toBe(5)
  })
  test(
    'Disconnecting a just-connected slot still compacts to one spare slot ' +
      '(PM-1496)',
    async () => {
      const graph = new LGraph()
      const node = testNode()
      graph.add(node)
      addAutogrow(node, {
        min: 0,
        input: inputsSpec,
        names: ['image_1', 'image_2', 'image_3', 'image_4']
      })

      connectInput(node, 0, graph)
      await nextTick()
      connectInput(node, 1, graph)

      node.disconnectInput(1)
      await nextTick()
      await nextTick()

      expect(node.inputs.map((i) => i.name)).toEqual(['0.image_1', '0.image_2'])
      expect(node.isInputConnected(0)).toBe(true)
      expect(node.isInputConnected(1)).toBe(false)
      expect(node.getInputLink(0)?.target_slot).toBe(0)
    }
  )
  test(
    'A same-slot swap in progress does not drop a genuine connect on a ' +
      'different slot of the same node (PM-1496)',
    async () => {
      const graph = new LGraph()
      const node = testNode()
      graph.add(node)
      addAutogrow(node, {
        min: 0,
        input: inputsSpec,
        names: ['image_1', 'image_2', 'image_3', 'image_4']
      })

      connectInput(node, 0, graph)
      await nextTick()

      const oldLink = node.getInputLink(0)
      const swapSource = testNode()
      swapSource.addOutput('out', '*')
      graph.add(swapSource)
      node.onConnectInput?.(
        0,
        swapSource.outputs[0].type,
        swapSource.outputs[0],
        swapSource,
        0
      )
      node.onConnectionsChange?.(
        LiteGraph.INPUT,
        0,
        false,
        oldLink,
        node.inputs[0]
      )

      connectInput(node, 1, graph)
      await nextTick()

      expect(node.inputs.map((i) => i.name)).toEqual([
        '0.image_1',
        '0.image_2',
        '0.image_3'
      ])
    }
  )
  test(
    'A genuine occupied-slot replacement via connectSlots does not drop a ' +
      'concurrent connect on a different slot (PM-1496)',
    async () => {
      const graph = new LGraph()
      const node = testNode()
      graph.add(node)
      addAutogrow(node, {
        min: 0,
        input: inputsSpec,
        names: ['image_1', 'image_2', 'image_3', 'image_4']
      })

      connectInput(node, 0, graph)
      await nextTick()
      expect(node.inputs.map((i) => i.name)).toEqual(['0.image_1', '0.image_2'])

      const oldLink = node.getInputLink(0)
      assert.exists(oldLink)
      const oldSource = graph.getNodeById(oldLink.origin_id)

      //connectSlots (LGraphNode.ts) fires slot 0's disconnect (the swap's
      //tail) and its matching connect synchronously, back to back, while
      //replacing slot 0's link below. Chaining onto onConnectionsChange -
      //the same public extension point real custom nodes use - lets a
      //second, genuine connect land on a different slot in that exact
      //window, without faking either connection.
      let sawSwapTail = false
      node.onConnectionsChange = useChainCallback(
        node.onConnectionsChange,
        (contype, slot, iscon) => {
          if (contype !== LiteGraph.INPUT || slot !== 0 || iscon) return
          sawSwapTail = true
          connectInput(node, 1, graph)
        }
      )

      const replacement = testNode()
      replacement.addOutput('out', '*')
      graph.add(replacement)
      const newLink = replacement.connect(0, node, 0)
      assert.exists(newLink)

      expect(sawSwapTail).toBe(true)
      expect(node.getInputLink(0)).toBe(newLink)
      expect(oldSource?.isOutputConnected(0)).toBe(false)

      await nextTick()
      await nextTick()

      expect(node.inputs.map((i) => i.name)).toEqual([
        '0.image_1',
        '0.image_2',
        '0.image_3'
      ])
    }
  )
  test(
    'A slot reconnected before its deferred disconnect compaction runs ' +
      'keeps the new link',
    async () => {
      const graph = new LGraph()
      const node = testNode()
      graph.add(node)
      addAutogrow(node, {
        min: 0,
        input: inputsSpec,
        names: ['image_1', 'image_2', 'image_3', 'image_4']
      })

      connectInput(node, 0, graph)
      await nextTick()

      connectInput(node, 1, graph)
      node.disconnectInput(1)
      const reconnectLink = connectInput(node, 1, graph)

      await nextTick()
      await nextTick()

      expect(node.getInputLink(1)).toBe(reconnectLink)
      expect(node.isInputConnected(1)).toBe(true)
      expect(graph.getLink(reconnectLink.id)).toBe(reconnectLink)
      const sourceNode = graph.getNodeById(reconnectLink.origin_id)
      expect(sourceNode?.isOutputConnected(0)).toBe(true)
    }
  )
  test('Autogrow compaction never emits a negative input slot', async () => {
    const graph = new LGraph()
    const node = testNode()
    const onConnectionsChange = vi.fn()
    node.onConnectionsChange = onConnectionsChange
    graph.add(node)
    addAutogrow(node, { min: 4, input: inputsSpec, prefix: 'test' })
    connectInput(node, 3, graph)
    connectInput(node, 4, graph)
    connectInput(node, 5, graph)
    onConnectionsChange.mockClear()

    node.disconnectInput(4)
    await nextTick()

    const inputCalls = onConnectionsChange.mock.calls.filter(
      ([type]) => type === LiteGraph.INPUT
    )
    expect(inputCalls.every(([, slot]) => slot >= 0)).toBe(true)
    expect(inputCalls.filter(([, , connected]) => !connected)).toHaveLength(1)
  })
  test('Rejected autogrow compaction preserves its input layout', async () => {
    const graph = new LGraph()
    const node = testNode()
    const onConnectionsChange = vi.fn()
    node.onConnectionsChange = onConnectionsChange
    graph.add(node)
    addAutogrow(node, { min: 1, input: inputsSpec, prefix: 'test' })
    connectInput(node, 0, graph)
    connectInput(node, 1, graph)
    connectInput(node, 2, graph)
    const updateEndpoints = vi
      .spyOn(useLinkStore(), 'updateEndpoints')
      .mockReturnValue({
        ok: false,
        error: { code: 'occupied-target', message: 'Target is occupied' }
      })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    node.disconnectInput(1)
    const inputNames = node.inputs.map(({ name }) => name)
    const widgetNames = node.widgets.map(({ name }) => name)
    onConnectionsChange.mockClear()
    await nextTick()

    expect(updateEndpoints).toHaveBeenCalled()
    expect(node.inputs.map(({ name }) => name)).toEqual(inputNames)
    expect(node.widgets.map(({ name }) => name)).toEqual(widgetNames)
    expect(onConnectionsChange).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })
  test('Removing a connection ignores stale autogrow callbacks after group removal', () => {
    const graph = new LGraph()
    const node = testNode() as TestAutogrowNode
    const onConnectionsChange = vi.fn()
    node.onConnectionsChange = onConnectionsChange
    graph.add(node)
    addAutogrow(node, { min: 1, input: inputsSpec, prefix: 'test' })

    const rafCallbacks: FrameRequestCallback[] = []
    const requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        rafCallbacks.push(callback)
        return rafCallbacks.length
      })

    try {
      connectInput(node, 0, graph)
      expect(node.inputs.length).toBe(2)

      rafCallbacks.shift()?.(0)

      node.disconnectInput(0)

      const staleDisconnectCallback = rafCallbacks.shift()
      expect(staleDisconnectCallback).toBeDefined()

      delete node.comfyDynamic.autogrow['0']

      const callbackCountBeforeFlush = onConnectionsChange.mock.calls.length
      staleDisconnectCallback?.(0)

      expect(onConnectionsChange).toHaveBeenCalledTimes(
        callbackCountBeforeFlush
      )
    } finally {
      requestAnimationFrameSpy.mockRestore()
    }
  })
  test('Multi-group autogrow shifts second group indices on first group growth', () => {
    const graph = new LGraph()
    const node = testNode()
    graph.add(node)

    const imageSpec = { required: { image: ['IMAGE', {}] } }
    const videoSpec = { required: { video: ['VIDEO', {}] } }
    addAutogrow(node, { min: 1, input: imageSpec, prefix: 'img' })
    addAutogrow(node, { min: 1, input: videoSpec, prefix: 'vid' })

    expect(node.inputs.map((i) => i.name)).toStrictEqual([
      '0.img0',
      '0.img1',
      '2.vid0',
      '2.vid1'
    ])

    connectInput(node, 1, graph)
    expect(node.inputs.map((i) => i.name)).toStrictEqual([
      '0.img0',
      '0.img1',
      '0.img2',
      '2.vid0',
      '2.vid1'
    ])

    const vid0Index = node.inputs.findIndex((i) => i.name === '2.vid0')
    expect(vid0Index).toBe(3)

    connectInput(node, vid0Index, graph)
    const vid0Link = node.inputs[vid0Index].link
    expect(vid0Link).not.toBeNull()
    expect(graph.links[vid0Link!].target_slot).toBe(vid0Index)
  })
  test('Can deserialize a complex node', async () => {
    const graph = new LGraph()
    const node = testNode()
    graph.add(node)
    addAutogrow(node, { min: 1, input: inputsSpec, prefix: 'a' })
    addAutogrow(node, { min: 1, input: inputsSpec, prefix: 'b' })
    addNodeInput(node, { name: 'aa', isOptional: false, type: 'IMAGE' })

    connectInput(node, 0, graph)
    connectInput(node, 1, graph)
    connectInput(node, 3, graph)
    connectInput(node, 4, graph)

    const serialized = graph.serialize()
    graph.clear()
    graph.configure(serialized)
    const newNode = graph.nodes[0]

    expect(newNode.inputs.map((i) => i.name)).toStrictEqual([
      '0.a0',
      '0.a1',
      '0.a2',
      '2.b0',
      '2.b1',
      '2.b2',
      'aa'
    ])
    for (const slot of [0, 1, 3, 4]) {
      expect.soft(newNode.isInputConnected(slot)).toBe(true)
      expect.soft(newNode.getInputLink(slot)?.target_slot).toBe(slot)
    }
    for (const slot of [2, 5, 6]) {
      expect.soft(newNode.isInputConnected(slot)).toBe(false)
    }
  })
})

const RESIZE_NODE_TYPE = 'test/ResizeImageMask'
const SOURCE_NODE_TYPE = 'test/MultiplierSource'

class SourceNode extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'Source')
    this.addOutput('out', 'FLOAT')
  }
}

/**
 * A reduced `ResizeImageMaskNode` (FE-258): a dynamic combo whose default
 * option lays out a `width` child, and whose other option lays out a
 * `multiplier` child instead.
 */
const resizeNodeDef: ComfyNodeDefV1 = {
  name: RESIZE_NODE_TYPE,
  display_name: 'Resize Image Mask',
  category: 'testing',
  python_module: 'nodes',
  description: '',
  input: {
    required: {
      image: ['IMAGE', {}],
      resize_type: [
        'COMFY_DYNAMICCOMBO_V3',
        {
          options: [
            {
              key: 'scale dimensions',
              inputs: { required: { width: ['INT', {}] } }
            },
            {
              key: 'scale by multiplier',
              inputs: { required: { multiplier: ['FLOAT', {}] } }
            }
          ]
        }
      ]
    }
  },
  output: ['IMAGE'],
  output_name: ['resized'],
  output_node: false
}

/**
 * The node saved on `scale by multiplier`, so its serialized inputs carry
 * `resize_type.multiplier` — a child the node definition does not lay out —
 * on the slot the definition gives to `resize_type.width`.
 */
function savedDynamicComboChildWorkflow(): SerialisableGraph {
  return {
    id: 'ab000000-0000-4000-8000-00000000f258',
    version: 1,
    revision: 0,
    state: { lastNodeId: 2, lastLinkId: 1, lastGroupId: 0, lastRerouteId: 0 },
    nodes: [
      {
        id: 1,
        type: SOURCE_NODE_TYPE,
        pos: [0, 0],
        size: [140, 60],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [],
        outputs: [{ name: 'out', type: 'FLOAT', links: [1] }],
        properties: {}
      },
      {
        id: 2,
        type: RESIZE_NODE_TYPE,
        pos: [300, 0],
        size: [200, 120],
        flags: {},
        order: 1,
        mode: 0,
        inputs: [
          { name: 'image', type: 'IMAGE', link: null },
          { name: 'resize_type.multiplier', type: 'FLOAT', link: 1 }
        ],
        outputs: [{ name: 'resized', type: 'IMAGE', links: [] }],
        properties: {},
        widgets_values: ['scale by multiplier', 4]
      }
    ],
    links: [
      {
        id: toLinkId(1),
        origin_id: 1,
        origin_slot: 0,
        target_id: 2,
        target_slot: 1,
        type: 'FLOAT'
      }
    ]
  }
}

describe('Dynamic combo child links on workflow load (FE-258)', () => {
  beforeEach(async () => {
    LiteGraph.registerNodeType(SOURCE_NODE_TYPE, SourceNode)
    await useLitegraphService().registerNodeDef(RESIZE_NODE_TYPE, resizeNodeDef)
  })

  test('keeps the link on the child the selected option lays out', () => {
    const graph = new LGraph()
    graph.configure(savedDynamicComboChildWorkflow())

    const target = graph.getNodeById(toNodeId(2))
    assert.ok(target, 'configured target node')
    const multiplierSlot = target.inputs.findIndex(
      (input) => input.name === 'resize_type.multiplier'
    )
    expect({
      inputNames: target.inputs.map((input) => input.name),
      multiplierLinkId: target.getInputLink(multiplierSlot)?.id
    }).toEqual({
      inputNames: ['image', 'resize_type', 'resize_type.multiplier'],
      multiplierLinkId: toLinkId(1)
    })
  })
})

const REFERENCE_NODE_TYPE = 'test/AutogrowInsideCombo'

/**
 * Shaped after `ByteDance2ReferenceNode`: a dynamic combo whose option holds
 * both an ordinary child widget and an autogrow group, so the group's children
 * are named `model.reference_images.<ordinal>` and its registry key is
 * `model.reference_images`.
 */
const referenceNodeDef: ComfyNodeDefV1 = {
  name: REFERENCE_NODE_TYPE,
  display_name: 'Autogrow Inside Combo',
  category: 'testing',
  python_module: 'nodes',
  description: '',
  input: {
    required: {
      model: [
        'COMFY_DYNAMICCOMBO_V3',
        {
          options: [
            {
              key: 'Seedance',
              inputs: {
                required: {
                  generate_audio: ['BOOLEAN', { default: true }],
                  reference_images: [
                    'COMFY_AUTOGROW_V3',
                    {
                      template: {
                        input: {
                          required: { reference_image: ['IMAGE', {}] }
                        },
                        names: ['image_1', 'image_2', 'image_3'],
                        min: 2
                      }
                    }
                  ]
                }
              }
            }
          ]
        }
      ]
    }
  },
  output: ['VIDEO'],
  output_name: ['VIDEO'],
  output_node: false
}

describe('Autogrow nested inside a group widget (FE-258)', () => {
  beforeEach(async () => {
    await useLitegraphService().registerNodeDef(
      REFERENCE_NODE_TYPE,
      referenceNodeDef
    )
  })

  test('leaves an autogrow child link where the group put it', () => {
    const graph = new LGraph()
    const node = LiteGraph.createNode(REFERENCE_NODE_TYPE)
    assert.ok(node, 'reference node')
    graph.add(node)
    const slotOf = (name: string) =>
      node.inputs.findIndex((input) => input.name === name)
    const connectedSlot = slotOf('model.reference_images.image_1')
    const nested = connectInput(node, connectedSlot, graph)

    realignGroupWidgetChildLinks(node, {
      id: node.id,
      inputs: node.inputs.map((input) => ({
        name: input.name,
        type: String(input.type),
        link: input.name === 'model.reference_images.image_3' ? nested.id : null
      }))
    })

    expect(nested.target_slot).toBe(connectedSlot)
  })
})

const GROWN_NODE_TYPE = 'test/AutogrowBeforeOrdinaryChild'

/**
 * Shaped after `OpenAIGPTImageNodeV2`: a dynamic combo option whose autogrow
 * group is followed by an ordinary child input. Reloading such a node replays
 * both links, and the group grows a slot while doing so.
 */
const grownNodeDef: ComfyNodeDefV1 = {
  name: GROWN_NODE_TYPE,
  display_name: 'Autogrow Before Ordinary Child',
  category: 'testing',
  python_module: 'nodes',
  description: '',
  input: {
    required: {
      model: [
        'COMFY_DYNAMICCOMBO_V3',
        {
          options: [
            {
              key: 'gpt-image-1',
              inputs: {
                required: {
                  seed: ['INT', { default: 0 }],
                  images: [
                    'COMFY_AUTOGROW_V3',
                    {
                      template: {
                        input: { required: { image: ['IMAGE', {}] } },
                        names: ['image_1', 'image_2', 'image_3', 'image_4'],
                        min: 0
                      }
                    }
                  ],
                  mask: ['MASK', { forceInput: true }]
                }
              }
            }
          ]
        }
      ]
    }
  },
  output: ['IMAGE'],
  output_name: ['IMAGE'],
  output_node: false
}

class ImageMaskSourceNode extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'ImageMaskSource')
    this.addOutput('image', 'IMAGE')
    this.addOutput('mask', 'MASK')
  }
}

describe('Autogrow followed by an ordinary combo child (FE-258)', () => {
  beforeEach(async () => {
    LiteGraph.registerNodeType('test/ImageMaskSource', ImageMaskSourceNode)
    await useLitegraphService().registerNodeDef(GROWN_NODE_TYPE, grownNodeDef)
  })

  test('keeps the autogrow slot count across a load', () => {
    const graph = new LGraph()
    const source = new ImageMaskSourceNode()
    graph.add(source)
    const node = LiteGraph.createNode(GROWN_NODE_TYPE)
    assert.ok(node, 'gpt image like node')
    graph.add(node)
    const slotOf = (name: string) =>
      node.inputs.findIndex((input) => input.name === name)
    source.connect(0, node, slotOf('model.images.image_1'))
    source.connect(1, node, slotOf('model.mask'))
    const inputNames = (target: LGraphNode) =>
      target.inputs.map(
        (input, slot) => `${input.name}${target.getInputLink(slot) ? '*' : ''}`
      )
    const before = inputNames(node).filter((name) =>
      name.startsWith('model.images.')
    )

    const reloaded = new LGraph()
    reloaded.configure(structuredClone(graph.serialize()))

    const reloadedNode = reloaded.getNodeById(node.id)
    assert.ok(reloadedNode, 'reloaded node')
    expect({
      images: inputNames(reloadedNode).filter((name) =>
        name.startsWith('model.images.')
      ),
      maskConnected: inputNames(reloadedNode).includes('model.mask*')
    }).toEqual({ images: before, maskConnected: true })
  })
})

const SEEDANCE_NODE_TYPE = 'test/SeedanceLikeReferences'
const IMAGE_GROUP_NAMES = 8
const VIDEO_GROUP_NAMES = 4

/**
 * Shaped after the Seedance partner nodes (PN-1520): two `IO.Autogrow`
 * groups nested inside one `IO.DynamicCombo` option.
 */
function autogrowRefs(
  type: string,
  count: number,
  min: number
): Required<InputSpec> {
  return [
    'COMFY_AUTOGROW_V3',
    {
      template: {
        input: { required: { ref: [type, {}] } },
        names: Array.from({ length: count }, (_, i) => `ref_${i + 1}`),
        min
      }
    }
  ]
}

function seedanceNodeDef(min: number): ComfyNodeDefV1 {
  const autogrow = (type: string, count: number) =>
    autogrowRefs(type, count, min)
  return {
    name: SEEDANCE_NODE_TYPE,
    display_name: 'Seedance Like References',
    category: 'testing',
    python_module: 'nodes',
    description: '',
    input: {
      required: {
        model: [
          'COMFY_DYNAMICCOMBO_V3',
          {
            options: [
              {
                key: 'seedance-1-pro',
                inputs: {
                  required: {
                    seed: ['INT', { default: 0 }],
                    reference_images: autogrow('IMAGE', IMAGE_GROUP_NAMES),
                    reference_videos: autogrow('VIDEO', VIDEO_GROUP_NAMES)
                  }
                }
              }
            ]
          }
        ]
      }
    },
    output: ['VIDEO'],
    output_name: ['VIDEO'],
    output_node: false
  }
}

const SEEDANCE_MULTI_OPTION_TYPE = 'test/SeedanceLikeMultiOption'

/**
 * The Seedance shape with the reference groups on a model that is not the
 * definition's first, as the customer's saved workflows have it.
 */
const seedanceMultiOptionDef: ComfyNodeDefV1 = {
  name: SEEDANCE_MULTI_OPTION_TYPE,
  display_name: 'Seedance Like Multi Option',
  category: 'testing',
  python_module: 'nodes',
  description: '',
  input: {
    required: {
      model: [
        'COMFY_DYNAMICCOMBO_V3',
        {
          options: [
            {
              key: 'seedance-1-lite',
              inputs: { required: { seed: ['INT', { default: 0 }] } }
            },
            {
              key: 'seedance-1-pro',
              inputs: {
                required: {
                  seed: ['INT', { default: 0 }],
                  reference_images: autogrowRefs('IMAGE', IMAGE_GROUP_NAMES, 2),
                  reference_videos: autogrowRefs('VIDEO', VIDEO_GROUP_NAMES, 0)
                }
              }
            }
          ]
        }
      ]
    }
  },
  output: ['VIDEO'],
  output_name: ['VIDEO'],
  output_node: false
}

class RefSourceNode extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'RefSource')
    this.addOutput('image', 'IMAGE')
    this.addOutput('video', 'VIDEO')
  }
}

const PREFIX_NODE_TYPE = 'test/PrefixNamedAutogrowInCombo'
const PREFIX_GROUP_MAX = 4

/**
 * A nested autogrow group named by `prefix` rather than `names`, whose
 * ordinals are therefore parsed back off the input name.
 */
const prefixNodeDef: ComfyNodeDefV1 = {
  name: PREFIX_NODE_TYPE,
  display_name: 'Prefix Named Autogrow In Combo',
  category: 'testing',
  python_module: 'nodes',
  description: '',
  input: {
    required: {
      model: [
        'COMFY_DYNAMICCOMBO_V3',
        {
          options: [
            {
              key: 'only',
              inputs: {
                required: {
                  seed: ['INT', { default: 0 }],
                  refs: [
                    'COMFY_AUTOGROW_V3',
                    {
                      template: {
                        input: { required: { ref: ['IMAGE', {}] } },
                        prefix: 'ref',
                        min: 0,
                        max: PREFIX_GROUP_MAX
                      }
                    }
                  ]
                }
              }
            }
          ]
        }
      ]
    }
  },
  output: ['IMAGE'],
  output_name: ['IMAGE'],
  output_node: false
}

function refNames(group: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `model.${group}.ref_${i + 1}`)
}

/**
 * Reloads `graph` into a fresh one the way a workflow tab switch does.
 * `LGraph.configure` raises `app.configuringGraph` in the running app via an
 * install the unit environment never performs, and autogrow's own connection
 * handler branches on it, so a reload test that leaves it false exercises a
 * path production never takes.
 */
function reloadWhileConfiguring(graph: LGraph, nodeId: NodeId): LGraphNode {
  const reloaded = new LGraph()
  const appInternals = fromAny<{ configuringGraphLevel: number }, unknown>(app)
  appInternals.configuringGraphLevel = 1
  try {
    reloaded.configure(structuredClone(graph.serialize()))
  } finally {
    appInternals.configuringGraphLevel = 0
  }
  const reloadedNode = reloaded.getNodeById(nodeId)
  assert.ok(reloadedNode, 'reloaded node')
  return reloadedNode
}

/**
 * Samples once per generation across `generations` successive reloads,
 * threading each reloaded graph into the next. Owns the reload lifecycle so a
 * caller comparing a trajectory keeps a straight-line body.
 */
function sampleAcrossReloads<T>(
  graph: LGraph,
  nodeId: NodeId,
  generations: number,
  sample: (node: LGraphNode, graph: LGraph) => T
): T[] {
  const samples: T[] = []
  let currentGraph = graph
  let currentNode = currentGraph.getNodeById(nodeId)
  assert.ok(currentNode, 'sampled node')
  for (let generation = 0; generation < generations; generation++) {
    samples.push(sample(currentNode, currentGraph))
    currentNode = reloadWhileConfiguring(currentGraph, currentNode.id)
    const reloadedGraph = currentNode.graph
    assert.ok(reloadedGraph, 'reloaded graph')
    currentGraph = reloadedGraph
  }
  return samples
}

function hasFreeSlot(node: LGraphNode, prefix: string): boolean {
  return node.inputs.some(
    (input, slot) => input.name.startsWith(prefix) && !node.getInputLink(slot)
  )
}

/** Names of `prefix` inputs on `node` that carry a link, in slot order. */
function connectedUnder(node: LGraphNode, prefix: string): string[] {
  return node.inputs.flatMap((input, slot) =>
    input.name.startsWith(prefix) && node.getInputLink(slot) ? [input.name] : []
  )
}

function connectRefs(
  graph: LGraph,
  node: LGraphNode,
  group: string,
  outputSlot: number,
  count: number
) {
  for (let i = 1; i <= count; i++) {
    const name = `model.${group}.ref_${i}`
    const slot = node.inputs.findIndex((input) => input.name === name)
    assert.ok(slot !== -1, `slot for ${name}`)
    const source = new RefSourceNode()
    graph.add(source)
    assert.ok(source.connect(outputSlot, node, slot), `connect ${name}`)
  }
}

describe('Nested autogrow links across a workflow reload (PN-1520, FE-2443)', () => {
  beforeEach(() => {
    LiteGraph.registerNodeType('test/RefSource', RefSourceNode)
  })

  // Pre-fix the rebuild regenerated a fixed `max(1, min + 1)` ordinals, so
  // `min` alone decided how many links survived while the rest were deleted.
  test.for([
    { min: 0, images: 5, videos: 2 },
    { min: 2, images: 6, videos: 2 },
    { min: 2, images: 5, videos: 2 },
    { min: 4, images: 8, videos: 4 },
    // A group whose sibling carries no links, or only one, is where a link
    // saved past the definition's size lands on the sibling's slot.
    { min: 0, images: 5, videos: 0 },
    { min: 0, images: 6, videos: 0 },
    { min: 1, images: 8, videos: 1 },
    { min: 2, images: 8, videos: 1 }
  ])(
    'min=$min keeps all $images image and $videos video links',
    async ({ min, images, videos }) => {
      await useLitegraphService().registerNodeDef(
        SEEDANCE_NODE_TYPE,
        seedanceNodeDef(min)
      )
      const graph = new LGraph()
      const node = LiteGraph.createNode(SEEDANCE_NODE_TYPE)
      assert.ok(node, 'seedance node')
      graph.add(node)
      connectRefs(graph, node, 'reference_images', 0, images)
      connectRefs(graph, node, 'reference_videos', 1, videos)

      const reloadedNode = reloadWhileConfiguring(graph, node.id)

      expect({
        images: connectedUnder(reloadedNode, 'model.reference_images.'),
        videos: connectedUnder(reloadedNode, 'model.reference_videos.'),
        // A group that comes back with no free slot has nowhere to attach
        // the next reference, so the layout is part of the contract.
        imagesHaveSpare: hasFreeSlot(reloadedNode, 'model.reference_images.'),
        videosHaveSpare: hasFreeSlot(reloadedNode, 'model.reference_videos.')
      }).toEqual({
        images: refNames('reference_images', images),
        videos: refNames('reference_videos', videos),
        imagesHaveSpare: images < IMAGE_GROUP_NAMES,
        videosHaveSpare: videos < VIDEO_GROUP_NAMES
      })
    }
  )

  test('does not grow a group past the ordinals its names declare', async () => {
    await useLitegraphService().registerNodeDef(
      SEEDANCE_NODE_TYPE,
      seedanceNodeDef(0)
    )
    const graph = new LGraph()
    const node = LiteGraph.createNode(SEEDANCE_NODE_TYPE)
    assert.ok(node, 'seedance node')
    graph.add(node)
    connectRefs(graph, node, 'reference_videos', 1, VIDEO_GROUP_NAMES)

    const reloadedNode = reloadWhileConfiguring(graph, node.id)

    const videoSlots = reloadedNode.inputs.filter((input) =>
      input.name.startsWith('model.reference_videos.')
    )
    expect({
      connected: connectedUnder(reloadedNode, 'model.reference_videos.').length,
      slots: videoSlots.length
    }).toEqual({ connected: 4, slots: 4 })
  })

  test('does not accumulate slots over successive reloads', async () => {
    await useLitegraphService().registerNodeDef(
      SEEDANCE_NODE_TYPE,
      seedanceNodeDef(0)
    )
    const graph = new LGraph()
    const node = LiteGraph.createNode(SEEDANCE_NODE_TYPE)
    assert.ok(node, 'seedance node')
    graph.add(node)
    connectRefs(graph, node, 'reference_images', 0, 1)
    connectRefs(graph, node, 'reference_videos', 1, 2)

    // Sizing a group from the slots its links ended up on compounds: a link
    // filed onto the sibling group drags that group one ordinal longer every
    // reload, without bound.
    const trajectory = sampleAcrossReloads(
      graph,
      node.id,
      5,
      (current, currentGraph) => ({
        imageSlots: current.inputs.filter((input) =>
          input.name.startsWith('model.reference_images.')
        ).length,
        links: currentGraph.links.size
      })
    )

    // Slots and links asserted together so the slot bound cannot be met by
    // destroying a link instead. The drop to 2 links is the residual on this
    // group's follow-up: links are sized for here but still placed by slot
    // index, so one eventually lands where no name claims it. Closing that
    // holds links at 3 throughout, and this expectation should be updated
    // rather than the behaviour re-broken to match it.
    expect(trajectory).toEqual([
      { imageSlots: 2, links: 3 },
      { imageSlots: 2, links: 3 },
      { imageSlots: 3, links: 3 },
      { imageSlots: 2, links: 2 },
      { imageSlots: 2, links: 2 }
    ])
  })

  test('keeps both groups when a saved non-default option is restored', async () => {
    await useLitegraphService().registerNodeDef(
      SEEDANCE_MULTI_OPTION_TYPE,
      seedanceMultiOptionDef
    )
    const graph = new LGraph()
    const node = LiteGraph.createNode(SEEDANCE_MULTI_OPTION_TYPE)
    assert.ok(node, 'seedance node')
    graph.add(node)
    const combo = node.widgets?.find((widget) => widget.name === 'model')
    assert.ok(combo, 'model combo widget')
    combo.value = 'seedance-1-pro'
    connectRefs(graph, node, 'reference_images', 0, 6)
    connectRefs(graph, node, 'reference_videos', 1, 2)

    // The production shape the table above cannot reach: the customer's
    // saved model is not the definition's first option, so the restore is
    // recognised only by `app.configuringGraph`.
    const reloadedNode = reloadWhileConfiguring(graph, node.id)
    expect({
      images: connectedUnder(reloadedNode, 'model.reference_images.'),
      videos: connectedUnder(reloadedNode, 'model.reference_videos.')
    }).toEqual({
      images: refNames('reference_images', 6),
      videos: refNames('reference_videos', 2)
    })
  })

  // Vitest cannot interrupt the synchronous setter, so an unclamped bound
  // surfaces as this budget expiring rather than as a failed assertion.
  test(
    'ignores an out-of-range ordinal in a prefix-named group',
    { timeout: 2_000 },
    async () => {
      await useLitegraphService().registerNodeDef(
        PREFIX_NODE_TYPE,
        prefixNodeDef
      )
      const graph = new LGraph()
      const node = LiteGraph.createNode(PREFIX_NODE_TYPE)
      assert.ok(node, 'prefix node')
      graph.add(node)
      const slot = node.inputs.findIndex(
        (input) => input.name === 'model.refs.ref0'
      )
      assert.ok(slot !== -1, 'prefix-named autogrow slot')
      const source = new RefSourceNode()
      graph.add(source)
      assert.ok(source.connect(0, node, slot), 'connect model.refs.ref0')

      // The state a hand-edited workflow leaves behind: a linked input whose
      // trailing digits parse to an ordinal far beyond the group's `max`.
      // Re-applying the value must not walk up to it - every ordinal costs an
      // iteration whether or not a slot results, so `ref900000000` would spin
      // ~900M times and hang the tab even though no slot is ever added.
      node.inputs[slot].name = 'model.refs.ref900000000'

      const combo = node.widgets?.find((widget) => widget.name === 'model')
      assert.ok(combo, 'model combo widget')
      combo.value = 'only'

      const refSlots = node.inputs.filter((input) =>
        input.name.startsWith('model.refs.')
      )
      expect(refSlots.length).toBeLessThanOrEqual(PREFIX_GROUP_MAX)
    }
  )
})

const SWITCHABLE_NODE_TYPE = 'test/SwitchableAutogrowOption'

const switchableNodeDef: ComfyNodeDefV1 = {
  name: SWITCHABLE_NODE_TYPE,
  display_name: 'Switchable Autogrow Option',
  category: 'testing',
  python_module: 'nodes',
  description: '',
  input: {
    required: {
      model: [
        'COMFY_DYNAMICCOMBO_V3',
        {
          options: [
            {
              key: 'many-refs',
              inputs: {
                required: {
                  seed: ['INT', { default: 0 }],
                  reference_images: [
                    'COMFY_AUTOGROW_V3',
                    {
                      template: {
                        input: { required: { ref: ['IMAGE', {}] } },
                        names: ['ref_1', 'ref_2', 'ref_3', 'ref_4'],
                        min: 0
                      }
                    }
                  ]
                }
              }
            },
            {
              // Declares the same group, so regrowth is reachable on this
              // option and the guard is what keeps the discarded links off it.
              key: 'other-refs',
              inputs: {
                required: {
                  seed: ['INT', { default: 0 }],
                  reference_images: [
                    'COMFY_AUTOGROW_V3',
                    {
                      template: {
                        input: { required: { ref: ['IMAGE', {}] } },
                        names: ['ref_1', 'ref_2', 'ref_3', 'ref_4'],
                        min: 0
                      }
                    }
                  ]
                }
              }
            }
          ]
        }
      ]
    }
  },
  output: ['IMAGE'],
  output_name: ['IMAGE'],
  output_node: false
}

describe('Autogrow regrowth is scoped to restoring a value', () => {
  beforeEach(async () => {
    LiteGraph.registerNodeType('test/RefSource', RefSourceNode)
    await useLitegraphService().registerNodeDef(
      SWITCHABLE_NODE_TYPE,
      switchableNodeDef
    )
  })

  test('a user switching options discards its links instead of regrowing for them', () => {
    const graph = new LGraph()
    const node = LiteGraph.createNode(SWITCHABLE_NODE_TYPE)
    assert.ok(node, 'switchable node')
    graph.add(node)
    connectRefs(graph, node, 'reference_images', 0, 3)
    expect(connectedUnder(node, 'model.reference_images.')).toEqual(
      refNames('reference_images', 3)
    )

    const combo = node.widgets?.find((widget) => widget.name === 'model')
    assert.ok(combo, 'model combo widget')
    combo.value = 'other-refs'

    // Only the ordinal the destination lays out on its own keeps its link;
    // regrowing for the other two would be resurrecting discarded work.
    expect(connectedUnder(node, 'model.reference_images.')).toEqual(
      refNames('reference_images', 1)
    )
  })

  test('restores a saved non-default option while the graph is configuring', () => {
    const graph = new LGraph()
    const node = LiteGraph.createNode(SWITCHABLE_NODE_TYPE)
    assert.ok(node, 'switchable node')
    graph.add(node)
    const combo = node.widgets?.find((widget) => widget.name === 'model')
    assert.ok(combo, 'model combo widget')
    combo.value = 'other-refs'
    connectRefs(graph, node, 'reference_images', 0, 4)
    expect(connectedUnder(node, 'model.reference_images.')).toEqual(
      refNames('reference_images', 4)
    )

    // The saved option is not the one the node is constructed with, so
    // `removedOption === value` is false here and only `app.configuringGraph`
    // marks this as a restore. LGraph.configure sets it in the running app
    // via an install the unit environment does not perform.
    const reloadedNode = reloadWhileConfiguring(graph, node.id)
    expect(connectedUnder(reloadedNode, 'model.reference_images.')).toEqual(
      refNames('reference_images', 4)
    )
  })
})
