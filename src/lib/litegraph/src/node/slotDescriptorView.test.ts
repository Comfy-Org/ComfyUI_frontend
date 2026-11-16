import { assert, describe, expect, it } from 'vitest'
import { toRaw } from 'vue'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { NodeInputSlot } from '@/lib/litegraph/src/node/NodeInputSlot'
import { NodeOutputSlot } from '@/lib/litegraph/src/node/NodeOutputSlot'

describe('slot identity', () => {
  it('preserves a transferred input and its owner', () => {
    const source = new LGraphNode('Source')
    const target = new LGraphNode('Target')
    source.addInput('slot', 'INT')

    target.inputs.push(source.inputs[0])

    const targetSlot = target.inputs[0]
    const sourceSlot = source.inputs[0]
    expect(targetSlot).toBeInstanceOf(NodeInputSlot)
    expect(sourceSlot).toBeInstanceOf(NodeInputSlot)
    if (!(targetSlot instanceof NodeInputSlot)) throw new Error('Expected slot')
    if (!(sourceSlot instanceof NodeInputSlot)) throw new Error('Expected slot')
    expect(targetSlot).toBe(sourceSlot)
    expect(targetSlot.node).toBe(source)
    expect(sourceSlot.node).toBe(source)
  })

  it('preserves a transferred output and its owner', () => {
    const source = new LGraphNode('Source')
    const target = new LGraphNode('Target')
    source.addOutput('slot', 'INT')

    target.outputs.push(source.outputs[0])

    const targetSlot = target.outputs[0]
    const sourceSlot = source.outputs[0]
    expect(targetSlot).toBeInstanceOf(NodeOutputSlot)
    expect(sourceSlot).toBeInstanceOf(NodeOutputSlot)
    if (!(targetSlot instanceof NodeOutputSlot))
      throw new Error('Expected slot')
    if (!(sourceSlot instanceof NodeOutputSlot))
      throw new Error('Expected slot')
    expect(targetSlot).toBe(sourceSlot)
    expect(targetSlot.node).toBe(source)
    expect(sourceSlot.node).toBe(source)
  })

  it('upgrades extension-assigned inputs when they are written', () => {
    const node = new LGraphNode('Node')
    const input = {
      name: 'input',
      type: 'INT',
      link: null,
      boundingRect: new Float64Array(4)
    }

    node.inputs = [input]

    expect(node.inputs[0]).toBeInstanceOf(NodeInputSlot)
    expect(Object.getPrototypeOf(toRaw(node._state.inputs[0]))).toBe(
      Object.prototype
    )
    node._state.inputs[0].label = 'Stored input'
    expect(node.inputs[0].label).toBe('Stored input')
    node.inputs[0].type = 'FLOAT'
    expect(node._state.inputs[0].type).toBe('FLOAT')
  })

  it('upgrades extension-assigned outputs when they are written', () => {
    const node = new LGraphNode('Node')
    const output = {
      name: 'output',
      type: 'INT',
      links: [],
      boundingRect: new Float64Array(4)
    }

    node.outputs = [output]

    expect(node.outputs[0]).toBeInstanceOf(NodeOutputSlot)
    expect(Object.getPrototypeOf(toRaw(node._state.outputs[0]))).toBe(
      Object.prototype
    )
    node._state.outputs[0].label = 'Stored output'
    expect(node.outputs[0].label).toBe('Stored output')
    node.outputs[0].type = 'FLOAT'
    expect(node._state.outputs[0].type).toBe('FLOAT')
  })

  it('keeps deleted metadata bound to the stored descriptor', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Node')
    graph.add(node)
    const output = node.addOutput('output', 'INT')

    output.widget = { name: 'first' }
    delete output.widget
    expect(node.serialize().outputs![0].widget).toBeUndefined()

    output.widget = { name: 'second' }
    expect(node.serialize().outputs![0].widget).toEqual({ name: 'second' })
  })

  it('preserves native indexOf behavior for arbitrary values', () => {
    const node = new LGraphNode('Node')
    node.addInput('slot', 'INT')
    const slot = node.inputs[0]

    expect(Reflect.apply(node.inputs.indexOf, node.inputs, [null])).toBe(-1)
    expect(Reflect.apply(node.inputs.indexOf, node.inputs, ['slot'])).toBe(-1)
    expect(node.inputs.indexOf(slot)).toBe(0)
  })

  it.for(['inputs', 'outputs'] as const)(
    'keeps retained %s bound to the same record across removal and reattachment',
    (direction) => {
      const graph = new LGraph()
      const node = new LGraphNode('Node')
      node.addInput('input', 'INT')
      node.addOutput('output', 'FLOAT')
      const slots = node[direction]
      const retained = slots[0]
      graph.add(node)
      const record = node._state[direction][0]

      graph.remove(node)
      retained.label = 'While detached'
      graph.add(node)

      expect(node._state[direction][0]).toBe(record)
      expect(record.label).toBe('While detached')
      expect(node[direction][0]).toBe(retained)
      expect(Object.getPrototypeOf(toRaw(record))).toBe(Object.prototype)
      expect(record).not.toHaveProperty('node')
      expect(record).not.toHaveProperty('_node')
    }
  )

  it('keeps a transferred slot usable after its original graph is cleared', () => {
    const original = new LGraph()
    const destination = new LGraph()
    const source = new LGraphNode('Source')
    const target = new LGraphNode('Target')
    const input = source.addInput('shared', 'INT')
    original.add(source)
    destination.add(target)
    target.inputs.push(input)

    original.clear()
    input.label = 'After clear'

    expect(target.inputs[0]).toBe(input)
    assert.instanceOf(input, NodeInputSlot)
    expect(input.node).toBe(source)
    expect(target._state.inputs[0].label).toBe('After clear')
  })

  it('preserves surviving and removed references through native array edits', () => {
    const node = new LGraphNode('Node')
    const first = node.addInput('first', 'INT')
    const second = node.addInput('second', 'FLOAT')
    const last = node.addInput('last', 'STRING')
    const inputs = node.inputs

    inputs.reverse()
    const removed = inputs.splice(1, 1)
    removed[0].label = 'Removed'
    inputs.length = 1
    node.inputs = [first, ...inputs, second]

    expect(node.inputs).toBe(inputs)
    expect([...inputs]).toEqual([first, last, second])
    expect(inputs.map((input) => input.label)).toEqual([
      undefined,
      undefined,
      'Removed'
    ])
    expect(node._state.inputs.map((input) => input.name)).toEqual([
      'first',
      'last',
      'second'
    ])
  })

  it('projects indexed reflection and rejects pinning a projected value', () => {
    const node = new LGraphNode('Node')
    const input = node.addInput('input', 'INT')

    expect(Object.getOwnPropertyDescriptor(node.inputs, '0')?.value).toBe(input)
    expect({ ...node.inputs[0] }).toMatchObject({ name: 'input', type: 'INT' })
    expect(
      Reflect.defineProperty(node.inputs, '0', { configurable: false })
    ).toBe(false)
    expect(Reflect.preventExtensions(node.inputs)).toBe(false)
    expect(node.inputs[0]).toBe(input)
    expect(Object.isExtensible(node.inputs)).toBe(true)
  })
})
