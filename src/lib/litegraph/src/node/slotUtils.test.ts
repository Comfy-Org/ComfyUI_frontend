import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { INodeOutputSlot } from '@/lib/litegraph/src/interfaces'
import type { IWidget } from '@/lib/litegraph/src/litegraph'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

import { outputAsSerialisable } from './slotUtils'

type OutputSlotParam = INodeOutputSlot & { widget?: IWidget }

function createConnectedGraph(targetCount: number) {
  const graph = new LGraph()
  const source = new LGraphNode('Source')
  source.addOutput('out', 'number')
  graph.add(source)

  for (let i = 0; i < targetCount; i++) {
    const target = new LGraphNode(`Target${i}`)
    target.addInput('in', 'number')
    graph.add(target)
    source.connect(0, target, 0)
  }

  return { graph, source }
}

describe('outputAsSerialisable', () => {
  beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

  it('serialises the links leaving the slot, ascending by id', () => {
    const { source } = createConnectedGraph(3)

    const serialised = outputAsSerialisable(
      source.outputs[0] as OutputSlotParam,
      source,
      0
    )

    expect(serialised.links).toHaveLength(3)
    expect(serialised.links).toEqual([...serialised.links!].sort())
  })

  it('returns a snapshot unaffected by later graph changes', () => {
    const { source } = createConnectedGraph(2)

    const serialised = outputAsSerialisable(
      source.outputs[0] as OutputSlotParam,
      source,
      0
    )
    expect(serialised.links).toHaveLength(2)

    source.disconnectOutput(0)
    expect(serialised.links).toHaveLength(2)
  })

  it('serialises null when the slot has no links', () => {
    const { source } = createConnectedGraph(0)

    const serialised = outputAsSerialisable(
      source.outputs[0] as OutputSlotParam,
      source,
      0
    )
    expect(serialised.links).toBeNull()
  })

  it('serialises null for a node with no graph', () => {
    const node = new LGraphNode('Detached')
    node.addOutput('out', 'number')

    const serialised = outputAsSerialisable(
      node.outputs[0] as OutputSlotParam,
      node,
      0
    )
    expect(serialised.links).toBeNull()
  })
})
