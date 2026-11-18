import { toLinkId } from '@comfyorg/graph-model/linkId'
import { UNASSIGNED_NODE_ID } from '@comfyorg/graph-model/nodeId'
import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished
} from 'vitest'

import { onGraphIntent } from '@/lib/litegraph/src/graphIntents'
import type { GraphIntentEvent } from '@/lib/litegraph/src/graphIntents'
import { LGraph, LGraphNode, LLink } from '@/lib/litegraph/src/litegraph'
import { enableSubgraphNodeCreation } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { Comfy, NodeHandle } from '@/platform/nodeApi/v4/types'

describe('edit edges', () => {
  let graph: LGraph
  let comfy: Comfy
  let node: LGraphNode
  let handle: NodeHandle

  beforeEach(() => {
    graph = new LGraph()
    ;({ comfy } = createComfyApi({ getGraph: () => graph }))
    node = new LGraphNode('Node')
    node.addInput('first', 'INT')
    node.addInput('second', 'INT')
    node.addInput('third', 'INT')
    node.addOutput('a', 'INT')
    node.addOutput('b', 'INT')
    graph.add(node)
    const found = comfy.graph.node(String(node.id))
    assert(found)
    handle = found
  })

  function floating(origin: [number, number], target: [number, number]) {
    const link = graph.addFloatingLink(
      new LLink(
        toLinkId(-1),
        'INT',
        origin[0] === -1 ? UNASSIGNED_NODE_ID : node.id,
        origin[1],
        target[0] === -1 ? UNASSIGNED_NODE_ID : node.id,
        target[1]
      )
    )
    assert(link)
    return link
  }

  function connectedTarget() {
    const target = new LGraphNode('Target')
    target.addInput('in', 'INT')
    graph.add(target)
    return target
  }

  it('names the point it could not read', () => {
    expect(() => Reflect.apply(handle.setPosition, undefined, [null])).toThrow(
      'setPosition needs position as an object, not null.'
    )
  })

  it('reads only a point’s own fields', () => {
    expect(() =>
      Reflect.apply(handle.setPosition, undefined, [
        Object.create({ x: 1, y: 2 })
      ])
    ).toThrow(TypeError)
  })

  it('answers false for a patch whose property the node keeps, with its other fields applied', () => {
    node.onPropertyChanged = () => false

    expect(
      comfy.edit.updateNode(handle, { title: 'Applied', properties: { p: 1 } })
    ).toBe(false)
    expect(node.title).toBe('Applied')
  })

  it('sets a property through the node, so a widget bound to the property sees it', () => {
    const widget = node.addWidget('number', 'bound', 1, () => {}, {
      property: 'amount'
    })

    handle.setProperty('amount', 5)

    expect(widget.value).toBe(5)
  })

  it('announces a title edit as the node field write the host announces', () => {
    const intents: GraphIntentEvent[] = []
    onTestFinished(onGraphIntent((intent) => intents.push(intent)))

    handle.setTitle('Announced')

    expect(intents).toContainEqual(
      expect.objectContaining({
        type: 'set_node_field',
        nodeId: node.id,
        field: 'title',
        value: 'Announced'
      })
    )
  })

  it('names the handle method in a refusal from add, remove and reorder', () => {
    expect(() => handle.inputs.reorder(['first'])).toThrow(/^reorder needs/)
    expect(() =>
      Reflect.apply(comfy.graph.add, undefined, ['X', { title: 5 }])
    ).toThrow(/^add needs/)
  })

  it('gives an added output the shape it asks for', () => {
    expect(
      handle.outputs.add('c', 'INT', { shape: 'list' })?.snapshot()?.shape
    ).toBe('list')
  })

  it('leaves a floating link into an input alone when the outputs move', () => {
    const intoSecond = floating([-1, -1], [0, 1])

    expect(handle.outputs.reorder(['b', 'a'])).toBe(true)

    expect(intoSecond.target_slot).toBe(1)
  })

  it('leaves a floating link out of an output alone when the inputs move', () => {
    const fromSecond = floating([0, 1], [-1, -1])

    expect(handle.inputs.reorder(['second', 'third', 'first'])).toBe(true)

    expect(fromSecond.origin_slot).toBe(1)
  })

  it('leaves a floating link into an input at its slot index through a three-way reorder, as the host does', () => {
    const intoFirst = floating([-1, -1], [0, 0])

    expect(handle.inputs.reorder(['second', 'third', 'first'])).toBe(true)

    expect(intoFirst.target_slot).toBe(0)
  })

  it('refuses an empty widget name', () => {
    node.addWidget('number', 'w', 1, () => {})

    expect(() => handle.inputs.at(0)?.modify({ widget: '' })).toThrow(TypeError)
    expect(node.inputs[0].widget).toBeUndefined()
  })

  it('does not hand an old slot handle to a new slot of the same name', () => {
    const third = handle.inputs.byName('third')
    assert(third)
    expect(handle.inputs.remove('third')).toBe(true)
    handle.inputs.add('third', 'INT')

    expect(third.isDeleted).toBe(true)
    expect(handle.inputs.byName('third')).not.toBe(third)
  })

  it('freezes the targets it lists', () => {
    node.connect(0, connectedTarget(), 0)

    expect(Object.isFrozen(handle.outputs.at(0)?.targets())).toBe(true)
  })

  it('gives a link’s type as text whatever the host stores', () => {
    const link = node.connect(0, connectedTarget(), 0)
    assert(link)
    link.type = 0

    expect(comfy.graph.links()?.[0].type).toBe('0')
  })

  it('shifts the links of the later outputs when an output is removed', () => {
    const target = connectedTarget()
    node.connect(1, target, 0)

    expect(handle.outputs.remove('a')).toBe(true)

    expect(
      handle.outputs
        .at(0)
        ?.links()
        ?.map((link) => link.sourceIndex)
    ).toEqual([0])
    expect(
      comfy.graph.node(String(target.id))?.inputs.at(0)?.source()?.outputIndex
    ).toBe(0)
  })

  it('shifts the floating links of the later inputs when an input is removed', () => {
    const intoThird = floating([-1, -1], [0, 2])

    expect(handle.inputs.remove('first')).toBe(true)

    expect(intoThird.target_slot).toBe(1)
  })

  it('refuses a target in another graph even when the output has no link', () => {
    onTestFinished(enableSubgraphNodeCreation(graph))
    const inner = new LGraphNode('Inner')
    graph.add(inner)
    graph.convertToSubgraph(new Set([inner]))
    const [innerHandle] = comfy.graph
      .queryNodes({ scope: 'root-and-subgraphs' })
      .filter(({ graphId }) => graphId !== graph.id)
    const output = handle.outputs.at(0)
    assert(output && innerHandle)

    expect(output.isConnected).toBe(false)
    expect(() => comfy.edit.disconnect(output, innerHandle)).toThrow(TypeError)
  })

  it('starts version again on a reload, so a later reading can repeat an earlier one', () => {
    const saved = graph.serialize()
    for (const title of ['One', 'Two', 'Three', 'Four', 'Five']) {
      handle.setTitle(title)
    }
    const edited = comfy.graph.version
    assert(edited !== undefined)

    graph.configure(saved)

    expect(comfy.graph.version).toBeLessThan(edited)
  })

  it('leaves version alone for a disconnect with nothing to disconnect', () => {
    const before = comfy.graph.version

    expect(handle.inputs.at(0)?.disconnect()).toBe(false)

    expect(comfy.graph.version).toBe(before)
  })
})
