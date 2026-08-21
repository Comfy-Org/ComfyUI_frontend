import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type {
  INodeInputSlot,
  INodeOutputSlot
} from '@/lib/litegraph/src/interfaces'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'


function connectedPair() {
  const graph = new LGraph()
  const source = new LGraphNode('Source')
  source.addOutput('out', 'INT')
  graph.add(source)

  const target = new LGraphNode('Target')
  target.addInput('in', 'INT')
  graph.add(target)

  const link = source.connect(0, target, 0)!
  return { graph, source, target, link }
}

function fanOut(count: number) {
  const graph = new LGraph()
  const source = new LGraphNode('Source')
  source.addOutput('out', 'INT')
  graph.add(source)

  const targets = Array.from({ length: count }, (_, index) => {
    const target = new LGraphNode(`Target ${index}`)
    target.addInput('in', 'INT')
    graph.add(target)
    source.connect(0, target, 0)
    return target
  })

  return { graph, source, targets }
}

describe('legacy slot link removal', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('propagates input.link = null to the far end of the link', () => {
    const { source, target } = connectedPair()

    target.inputs[0].link = null

    expect(target.isInputConnected(0)).toBe(false)
    expect(source.isOutputConnected(0)).toBe(false)
    expect(source.outputs[0].links).toBeNull()
    expect(source.getOutputNodes(0) ?? []).toHaveLength(0)
  })

  it('disconnects the links a filter-and-reassign drops', () => {
    const { source, targets } = fanOut(3)
    const output = source.outputs[0]
    const [dropped, , alsoDropped] = output.links!

    output.links = output.links!.filter(
      (id) => id !== dropped && id !== alsoDropped
    )

    expect(targets[0].isInputConnected(0)).toBe(false)
    expect(targets[2].isInputConnected(0)).toBe(false)
    expect(targets[1].isInputConnected(0)).toBe(true)
    expect(source.getOutputNodes(0)).toEqual([targets[1]])
  })

  it('disconnects each link spliced out of the retained view in turn', () => {
    const { source, targets } = fanOut(3)
    const view = source.outputs[0].links!

    for (const id of [...view]) view.splice(view.indexOf(id), 1)

    for (const [index, target] of targets.entries()) {
      expect(target.isInputConnected(0), `target ${index}`).toBe(false)
    }
    expect(source.isOutputConnected(0)).toBe(false)
  })

  it('disconnects everything when the view is truncated by length', () => {
    // `length` is a property write rather than an array method, so it reaches
    // the mutation view through a different trap than the cases above.
    const { source, targets } = fanOut(2)
    const view = source.outputs[0].links!

    view.length = 0

    expect(targets.every((target) => !target.isInputConnected(0))).toBe(true)
    expect(source.isOutputConnected(0)).toBe(false)
  })

  it('ignores removals on slots detached from their node', () => {
    const { source, target } = connectedPair()
    const [detachedInput] = target.inputs.splice(0, 1)
    const [detachedOutput] = source.outputs.splice(0, 1)

    expect(() => {
      detachedInput.link = null
      detachedOutput.links = []
    }).not.toThrow()
  })
})

describe('legacy slot link creation and plain-object slots (uncovered)', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it.fails('restores a link from a saved id', () => {
    const { source, target } = connectedPair()
    const saved = target.inputs[0].link

    target.inputs[0].link = null
    expect(source.isOutputConnected(0)).toBe(false)

    target.inputs[0].link = saved
    expect(target.inputs[0].link).toBe(saved)
    expect(source.isOutputConnected(0)).toBe(true)
  })

  it.fails('reconnects a link pushed back onto the output view', () => {
    const { source, target } = connectedPair()
    const output = source.outputs[0]
    const [id] = output.links!

    output.links = []
    expect(source.isOutputConnected(0)).toBe(false)

    output.links!.push(id)
    expect(source.isOutputConnected(0)).toBe(true)
    expect(target.isInputConnected(0)).toBe(true)
  })

  it.fails('disconnects through a plain-object input slot', () => {
    // The shape the one confirmed-broken pack uses: replace the slot with a
    // spread copy, then mutate that. `link` is an accessor, so the copy carries
    // neither the shim nor the current id.
    const { source, target } = connectedPair()
    const copy: INodeInputSlot = { ...target.inputs[0] }
    target.inputs[0] = copy

    target.inputs[0].link = null

    expect(source.isOutputConnected(0)).toBe(false)
  })

  it.fails('disconnects through a plain-object output slot', () => {
    const { source, target } = connectedPair()
    const copy: INodeOutputSlot = { ...source.outputs[0] }
    source.outputs[0] = copy

    source.outputs[0].links = []

    expect(target.isInputConnected(0)).toBe(false)
  })
})
