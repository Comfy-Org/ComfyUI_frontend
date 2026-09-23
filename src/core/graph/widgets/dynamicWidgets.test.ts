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
import { useLitegraphService } from '@/services/litegraphService'
import { useLinkStore } from '@/stores/linkStore'

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
