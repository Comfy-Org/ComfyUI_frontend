import { describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { NodeInputSlot } from '@/lib/litegraph/src/node/NodeInputSlot'
import { NodeOutputSlot } from '@/lib/litegraph/src/node/NodeOutputSlot'

describe('slot descriptor views', () => {
  it('rebinds a transferred input to its new owner', () => {
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
    expect(targetSlot.node).toBe(target)
    expect(sourceSlot.node).toBe(source)
  })

  it('rebinds a transferred output to its new owner', () => {
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
    expect(targetSlot.node).toBe(target)
    expect(sourceSlot.node).toBe(source)
  })
})
