import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LinkId } from '@/lib/litegraph/src/LLink'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { NodeInputSlot } from '@/lib/litegraph/src/node/NodeInputSlot'
/** `isConnected` is on the class, not the INodeInputSlot interface. */
function inputSlot(node: LGraphNode, index: number): NodeInputSlot {
  const slot = node.inputs[index]
  if (!(slot instanceof NodeInputSlot))
    throw new Error('expected NodeInputSlot')
  return slot
}

function createConnectedPair() {
  const graph = new LGraph()
  const source = new LGraphNode('Source')
  source.addOutput('out', 'INT')
  const target = new LGraphNode('Target')
  target.addInput('in', 'INT')
  graph.add(source)
  graph.add(target)
  const link = source.connect(0, target, 0)!
  return { graph, source, target, link }
}

describe('NodeInputSlot', () => {
  const onWarning = vi.fn()
  const originalCallbacks = LiteGraph.onDeprecationWarning

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    onWarning.mockClear()
    LiteGraph.onDeprecationWarning = [onWarning]
    LiteGraph.alwaysRepeatWarnings = true
  })

  afterEach(() => {
    LiteGraph.onDeprecationWarning = originalCallbacks
    LiteGraph.alwaysRepeatWarnings = false
  })

  it('reflects graph and store state across the slot lifecycle', () => {
    const orphan = new LGraphNode('Orphan')
    orphan.addInput('in', 'INT')
    expect(orphan.inputs[0].link).toBeNull()

    const { source, target, link } = createConnectedPair()
    expect(target.inputs[0].link).toBe(link.id)
    expect(onWarning).toHaveBeenCalledWith(
      expect.stringContaining('input.link is deprecated'),
      undefined
    )

    target.disconnectInput(0)
    expect(target.inputs[0].link).toBeNull()

    const relink = source.connect(0, target, 0)!
    expect(target.inputs[0].link).toBe(relink.id)
  })

  it('resolves connectivity from the slot position after reordering', () => {
    const graph = new LGraph()
    const source = new LGraphNode('Source')
    source.addOutput('out', 'INT')
    const target = new LGraphNode('Target')
    target.addInput('first', 'INT')
    target.addInput('second', 'INT')
    graph.add(source)
    graph.add(target)
    const firstLink = source.connect(0, target, 0)!
    const secondLink = source.connect(0, target, 1)!
    const input = target.inputs[0]
    if (!(input instanceof NodeInputSlot)) {
      throw new Error('expected NodeInputSlot')
    }
    expect(input.toJSON().link).toBe(firstLink.id)
    expect(input.isConnected).toBe(true)

    // Links keep naming slot indices, so a reordered slot picks up whichever
    // link now targets its position.
    target.inputs.reverse()

    expect(input.toJSON().link).toBe(secondLink.id)
    expect(input.isConnected).toBe(true)
  })

  it('ignores writes, warns, and keeps the store-derived value', () => {
    const { target, link } = createConnectedPair()
    const input: { link?: LinkId | null } = target.inputs[0]

    expect(() => {
      input.link = null
    }).not.toThrow()
    expect(onWarning).toHaveBeenCalledWith(
      expect.stringContaining('Assignment to input.link is deprecated'),
      undefined
    )
    expect(target.inputs[0].link).toBe(link.id)
  })
})

describe('NodeInputSlot.isConnected', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('reflects connect and disconnect', () => {
    const { target } = createConnectedPair()
    expect(inputSlot(target, 0).isConnected).toBe(true)

    target.disconnectInput(0, true)
    expect(inputSlot(target, 0).isConnected).toBe(false)
  })

  it('reports false for a slot on a graphless node', () => {
    const orphan = new LGraphNode('Orphan')
    orphan.addInput('in', 'INT')

    expect(inputSlot(orphan, 0).isConnected).toBe(false)
  })
})
