import { describe, expect, it } from 'vitest'
import { toRaw } from 'vue'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
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

  it('preserves the identity of extension-assigned slots', () => {
    const node = new LGraphNode('Node')
    const input = {
      name: 'input',
      type: 'INT',
      link: null,
      boundingRect: new Float64Array(4)
    }
    const output = {
      name: 'output',
      type: 'INT',
      links: [],
      boundingRect: new Float64Array(4)
    }

    node.inputs = [input]
    node.outputs = [output]

    expect(node.inputs[0]).toBe(input)
    expect(node.outputs[0]).toBe(output)
  })

  it('preserves native indexOf behavior for arbitrary values', () => {
    const node = new LGraphNode('Node')
    node.addInput('slot', 'INT')
    const descriptor = toRaw(node.inputs)[0]

    expect(Reflect.apply(node.inputs.indexOf, node.inputs, [null])).toBe(-1)
    expect(Reflect.apply(node.inputs.indexOf, node.inputs, ['slot'])).toBe(-1)
    expect(node.inputs.indexOf(descriptor)).toBe(0)
  })
})
