import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { INodeOutputSlot } from '@/lib/litegraph/src/interfaces'
import type { IWidget } from '@/lib/litegraph/src/litegraph'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { toLinkId } from '@/types/linkId'

import { outputAsSerialisable } from './slotUtils'

type OutputSlotParam = INodeOutputSlot & { widget?: IWidget }

function createConnectedGraph(linkIds: number[]) {
  const graph = new LGraph()
  const source = new LGraphNode('Source')
  const targets: LGraphNode[] = []
  source.addOutput('out', 'number')
  graph.add(source)

  for (const [i, linkId] of linkIds.entries()) {
    const target = new LGraphNode(`Target${i}`)
    targets.push(target)
    target.addInput('in', 'number')
    graph.add(target)
    graph.state.lastLinkId = toLinkId(linkId - 1)
    source.connect(0, target, 0)
  }

  return { graph, source, targets }
}

describe('outputAsSerialisable', () => {
  beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

  it('serialises the links leaving the slot, ascending by id', () => {
    const { source } = createConnectedGraph([10, 2])

    const serialised = outputAsSerialisable(
      source.outputs[0] as OutputSlotParam,
      source,
      0
    )

    expect(serialised.links).toEqual(
      [...serialised.links!].sort((a, b) => a - b)
    )
    expect(serialised.links).toEqual([2, 10])
  })

  it('returns a snapshot unaffected by later graph changes', () => {
    const { source } = createConnectedGraph([1, 2])

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
    const { source } = createConnectedGraph([])

    const serialised = outputAsSerialisable(
      source.outputs[0] as OutputSlotParam,
      source,
      0
    )
    expect(serialised.links).toBeNull()
  })

  it('ignores stale ids on a graph-bound plain-object slot', () => {
    const { source } = createConnectedGraph([])
    const output = {
      ...source.outputs[0],
      links: [toLinkId(404)]
    } as OutputSlotParam
    source.outputs[0] = output

    const serialised = outputAsSerialisable(output, source, 0)

    expect(serialised.links).toBeNull()
  })

  it('serialises an empty array after a targeted disconnect', () => {
    const { source, targets } = createConnectedGraph([1])
    source.disconnectOutput(0, targets[0])

    const serialised = outputAsSerialisable(
      source.outputs[0] as OutputSlotParam,
      source,
      0
    )

    expect(serialised.links).toEqual([])
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
