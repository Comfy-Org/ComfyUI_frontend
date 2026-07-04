import { setActivePinia } from 'pinia'
import { createTestingPinia } from '@pinia/testing'
import { describe, expect, test } from 'vitest'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { InputSpec } from '@/schemas/nodeDefSchema'
import { useLitegraphService } from '@/services/litegraphService'
import type { HasInitialMinSize } from '@/services/litegraphService'

setActivePinia(createTestingPinia())
type DynamicInputs = ('INT' | 'STRING' | 'IMAGE' | DynamicInputs)[][]
type TestAutogrowNode = LGraphNode & {
  comfyDynamic: { autogrow: Record<string, unknown> }
}

const { addNodeInput } = useLitegraphService()

function nextTick() {
  return new Promise<void>((r) => requestAnimationFrame(() => r()))
}

function addDynamicCombo(node: LGraphNode, inputs: DynamicInputs) {
  const namePrefix = `${node.widgets?.length ?? 0}`
  function getSpec(
    inputs: DynamicInputs,
    depth: number = 0
  ): { key: string; inputs: object }[] {
    return inputs.map((group, groupIndex) => {
      const inputs = group.map((input, inputIndex) => [
        `${namePrefix}.${depth}.${inputIndex}`,
        Array.isArray(input)
          ? ['COMFY_DYNAMICCOMBO_V3', { options: getSpec(input, depth + 1) }]
          : [input, { tooltip: `${groupIndex}` }]
      ])
      return {
        key: `${groupIndex}`,
        inputs: { required: Object.fromEntries(inputs) }
      }
    })
  }
  const inputSpec: Required<InputSpec> = [
    'COMFY_DYNAMICCOMBO_V3',
    { options: getSpec(inputs) }
  ]
  addNodeInput(
    node,
    transformInputSpecV1ToV2(inputSpec, { name: namePrefix, isOptional: false })
  )
}
function addDynamicGroup(
  node: LGraphNode,
  template: object,
  { min, max, name = 'g' }: { min?: number; max?: number; name?: string } = {}
) {
  const options: Record<string, unknown> = { template }
  if (min !== undefined) options.min = min
  if (max !== undefined) options.max = max
  addNodeInput(
    node,
    transformInputSpecV1ToV2(['COMFY_DYNAMICGROUP_V3', options] as InputSpec, {
      name,
      isOptional: false
    })
  )
}
function addAutogrow(node: LGraphNode, template: unknown) {
  addNodeInput(
    node,
    transformInputSpecV1ToV2(['COMFY_AUTOGROW_V3', { template }], {
      name: `${node.inputs.length}`,
      isOptional: false
    })
  )
}
function connectInput(node: LGraphNode, inputIndex: number, graph: LGraph) {
  const node2 = testNode()
  node2.addOutput('out', '*')
  graph.add(node2)
  node2.connect(0, node, inputIndex)
}
function testNode() {
  const node: LGraphNode & Partial<HasInitialMinSize> = new LGraphNode('test')
  node.widgets = []
  node._initialMinSize = { width: 1, height: 1 }
  node.constructor.nodeData = {
    name: 'testnode'
  } as typeof node.constructor.nodeData
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
  test('Dynamically added widgets have tooltips', () => {
    const node = testNode()
    addDynamicCombo(node, [['INT'], ['STRING']])
    expect.soft(node.widgets[1].tooltip).toBe('0')
    node.widgets[0].value = '1'
    expect.soft(node.widgets[1].tooltip).toBe('1')
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
    const newNode = graph.nodes[0]!

    expect(newNode.inputs.map((i) => i.name)).toStrictEqual([
      '0.a0',
      '0.a1',
      '0.a2',
      '2.b0',
      '2.b1',
      '2.b2',
      'aa'
    ])
  })
})
describe('Dynamic Groups', () => {
  const stringTemplate = { required: { a: ['STRING', {}] } }
  const widgetNames = (node: LGraphNode) => node.widgets!.map((w) => w.name)
  const inputNames = (node: LGraphNode) => node.inputs.map((i) => i.name)
  const widgetNamed = (node: LGraphNode, name: string) =>
    node.widgets!.find((w) => w.name === name)!

  test('renders min rows on creation', () => {
    const node = testNode()
    addDynamicGroup(node, stringTemplate, { min: 2, max: 5 })
    expect(widgetNames(node)).toStrictEqual(['g', 'g.0.a', 'g.1.a'])
    expect(inputNames(node)).toStrictEqual([])
  })

  test('add row appends a new row up to max', () => {
    const node = testNode()
    addDynamicGroup(node, stringTemplate, { min: 0, max: 2 })
    expect(widgetNames(node)).toStrictEqual(['g'])

    widgetNamed(node, 'g').callback?.(undefined)
    expect(widgetNames(node)).toStrictEqual(['g', 'g.0.a'])

    widgetNamed(node, 'g').callback?.(undefined)
    expect(widgetNames(node)).toStrictEqual(['g', 'g.0.a', 'g.1.a'])

    // At max, further adds are ignored.
    widgetNamed(node, 'g').callback?.(undefined)
    expect(widgetNames(node)).toStrictEqual(['g', 'g.0.a', 'g.1.a'])
  })

  test('controller disabled option set at max', () => {
    const node = testNode()
    addDynamicGroup(node, stringTemplate, { min: 0, max: 1 })
    expect(widgetNamed(node, 'g').options?.disabled).toBe(false)
    widgetNamed(node, 'g').callback?.(undefined)
    expect(widgetNamed(node, 'g').options?.disabled).toBe(true)
  })

  test('remove row renumbers later rows', () => {
    const node = testNode()
    addDynamicGroup(node, stringTemplate, { min: 0, max: 5 })
    const state = (
      node as Parameters<typeof widgetNamed>[0] & {
        comfyDynamic: {
          dynamicGroup: Record<
            string,
            { addRow: () => void; removeRow: (r: number) => void }
          >
        }
      }
    ).comfyDynamic.dynamicGroup['g']
    state.addRow()
    state.addRow()
    state.addRow()

    const row0Field = widgetNamed(node, 'g.0.a')
    const row2Field = widgetNamed(node, 'g.2.a')

    state.removeRow(1)

    expect(widgetNames(node)).toStrictEqual(['g', 'g.0.a', 'g.1.a'])
    // Row 0 is untouched; the former row 2 shifts down into row 1.
    expect(widgetNamed(node, 'g.0.a')).toBe(row0Field)
    expect(widgetNamed(node, 'g.1.a')).toBe(row2Field)
  })

  test('remove row disconnects linked sockets and renumbers inputs', () => {
    const node = testNode()
    addDynamicGroup(node, stringTemplate, { min: 0, max: 5 })
    const state = (
      node as Parameters<typeof widgetNamed>[0] & {
        comfyDynamic: {
          dynamicGroup: Record<
            string,
            { addRow: () => void; removeRow: (r: number) => void }
          >
        }
      }
    ).comfyDynamic.dynamicGroup['g']
    state.addRow()
    state.addRow()
    state.addRow()

    const graph = new LGraph()
    graph.add(node)
    node.addInput('g.1.a', 'STRING')
    const row1Index = node.inputs.findIndex((i) => i.name === 'g.1.a')
    connectInput(node, row1Index, graph)
    const linkId = node.inputs[row1Index].link!
    node.addInput('g.2.a', 'STRING')

    state.removeRow(1)

    expect(graph.links[linkId]).toBeUndefined()
    expect(inputNames(node)).toStrictEqual(['g.1.a'])
    expect(node.inputs[0].link).toBeNull()
    expect(widgetNames(node)).toStrictEqual(['g', 'g.0.a', 'g.1.a'])
  })

  test('rows below min cannot be removed', () => {
    const node = testNode()
    addDynamicGroup(node, stringTemplate, { min: 1, max: 5 })
    const state = (
      node as Parameters<typeof widgetNamed>[0] & {
        comfyDynamic: {
          dynamicGroup: Record<string, { removeRow: (r: number) => void }>
        }
      }
    ).comfyDynamic.dynamicGroup['g']

    // Row 0 is at the min boundary — removing it is a no-op.
    state.removeRow(0)
    expect(widgetNames(node)).toStrictEqual(['g', 'g.0.a'])
  })
})
