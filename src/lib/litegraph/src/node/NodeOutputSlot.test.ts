import { createTestingPinia } from '@pinia/testing'
import { fromAny } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { NodeOutputSlot } from '@/lib/litegraph/src/node/NodeOutputSlot'
import { toLinkId } from '@/types/linkId'

function createConnectedGraph() {
  const graph = new LGraph()
  const source = new LGraphNode('Source')
  source.addOutput('out', 'INT')
  graph.add(source)

  const target = new LGraphNode('Target')
  target.addInput('in', 'INT')
  graph.add(target)

  return { graph, source, target }
}

describe('NodeOutputSlot deprecated links getter', () => {
  const onWarning = vi.fn()

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    onWarning.mockClear()
    LiteGraph.onDeprecationWarning = [onWarning]
    LiteGraph.alwaysRepeatWarnings = true
  })

  afterEach(() => {
    LiteGraph.alwaysRepeatWarnings = false
  })

  it('fires a deprecation warning on read', () => {
    const { source } = createConnectedGraph()

    void source.outputs[0].links

    expect(onWarning).toHaveBeenCalledWith(
      expect.stringContaining('output.links is deprecated'),
      undefined
    )
  })

  it('reflects live link store data across connect and disconnect', () => {
    const { source, target } = createConnectedGraph()

    const link = source.connect(0, target, 0)
    expect(source.outputs[0].links).toEqual([link!.id])

    source.disconnectOutput(0)
    expect(source.outputs[0].links).toBeNull()
  })

  it('does not let a getter read change empty-link serialization', () => {
    const { source, target } = createConnectedGraph()
    source.connect(0, target, 0)

    void source.outputs[0].links
    target.disconnectInput(0)

    const output = source.outputs[0]
    expect(output).toBeInstanceOf(NodeOutputSlot)
    if (!(output instanceof NodeOutputSlot)) throw new Error('Expected slot')
    expect(output.toJSON().links).toBeNull()
  })

  it('retains an empty array after disconnecting a specific target', () => {
    const { source, target } = createConnectedGraph()
    source.connect(0, target, 0)

    source.disconnectOutput(0, target)

    expect(source.outputs[0].links).toEqual([])
  })

  it('returns null for an unconnected slot and for a graphless node', () => {
    const { source } = createConnectedGraph()
    expect(source.outputs[0].links).toBeNull()

    const orphan = new LGraphNode('Orphan')
    orphan.addOutput('out', 'INT')
    expect(orphan.outputs[0].links).toBeNull()
  })

  it('routes null assignment through disconnectOutput', () => {
    const { source, target } = createConnectedGraph()
    source.connect(0, target, 0)
    const slot: { links?: unknown } = source.outputs[0]

    expect(() => {
      slot.links = null
    }).not.toThrow()
    expect(onWarning).toHaveBeenCalledWith(
      expect.stringContaining('Assignment to output.links is deprecated'),
      undefined
    )
    expect(source.outputs[0].links).toBeNull()
  })

  it('routes removals from the returned array through disconnectInput', () => {
    const { source, target } = createConnectedGraph()
    const first = source.connect(0, target, 0)!
    const secondTarget = new LGraphNode('Second target')
    secondTarget.addInput('in', 'INT')
    source.graph!.add(secondTarget)
    const second = source.connect(0, secondTarget, 0)!

    const slot = source.outputs[0]
    const links = slot.links
    if (!links) throw new Error('Expected connected output links')
    expect(links).toEqual([first.id, second.id])
    expect(links.pop()).toBe(second.id)
    expect(secondTarget.inputs[0].link).toBeNull()
    expect(target.inputs[0].link).toBe(first.id)
    expect(slot.links).toBe(links)
    expect(links).toEqual([first.id])
  })

  it('synchronizes a retained array view with topology commands', () => {
    const { source, target } = createConnectedGraph()
    const slot = source.outputs[0]
    slot.links = []
    const links = slot.links
    if (!links) throw new Error('Expected retained output links')
    const first = source.connect(0, target, 0)!

    expect(links).toEqual([first.id])
    source.disconnectOutput(0)
    expect(links).toEqual([])
  })

  it('accepts unresolved additions without changing topology', () => {
    const { source } = createConnectedGraph()
    const slot = source.outputs[0]

    slot.links = []
    expect(slot.links).toEqual([])
    const links = slot.links
    if (!links) throw new Error('Expected assigned output links')
    expect(() => links.push(toLinkId(404))).not.toThrow()
    expect(slot.links).toEqual([])
  })

  it('does not resolve a detached slot by matching its name and type', () => {
    const { source, target } = createConnectedGraph()
    const attached = source.outputs[0]
    const detached = new NodeOutputSlot(
      { name: attached.name, type: attached.type },
      source
    )
    const link = source.connect(0, target, 0)!

    detached.links = []

    expect(target.inputs[0].link).toBe(link.id)
    expect(attached.links).toEqual([link.id])
  })
})

describe('NodeOutputSlot construction', () => {
  it('tolerates serialized slots carrying unknown keys', () => {
    const node = new LGraphNode('Host')

    expect(
      () =>
        new NodeOutputSlot(
          fromAny({ name: 'out', type: 'INT', index: 7, linkIds: [3] }),
          node
        )
    ).not.toThrow()
  })

  it('preserves explicit empty legacy link presence', () => {
    const node = new LGraphNode('Host')
    const slot = new NodeOutputSlot(
      fromAny({ name: 'out', type: 'INT', links: [] }),
      node
    )

    expect(slot.toJSON().links).toEqual([])
  })
})
