import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, onTestFinished } from 'vitest'

import {
  LGraph,
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import type { ISerialisedGraph } from '@/lib/litegraph/src/litegraph'
import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@/types/graphScopeId'

import { test } from './__fixtures__/testExtensions'

beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

describe('LGraph Serialisation', () => {
  test('can (de)serialise node / group titles', ({ expect, minimalGraph }) => {
    const nodeTitle = 'Test Node'
    const groupTitle = 'Test Group'

    minimalGraph.add(new LGraphNode(nodeTitle))
    minimalGraph.add(new LGraphGroup(groupTitle))

    expect(minimalGraph.nodes.length).toBe(1)
    expect(minimalGraph.nodes[0].title).toEqual(nodeTitle)

    expect(minimalGraph.groups.length).toBe(1)
    expect(minimalGraph.groups[0].title).toEqual(groupTitle)

    const serialised = JSON.stringify(minimalGraph.serialize())
    minimalGraph.clear()
    const deserialised = JSON.parse(serialised) as ISerialisedGraph

    const copied = new LGraph(deserialised)
    onTestFinished(() => copied.clear())
    expect(copied.nodes.length).toBe(1)
    expect(copied.nodes[0].title).toEqual(nodeTitle)
    expect(copied.groups.length).toBe(1)
    expect(copied.groups[0].title).toEqual(groupTitle)
  })

  test('registers connected links after a JSON round trip', ({ expect }) => {
    class ConnectedNode extends LGraphNode {
      constructor() {
        super('Connected')
        this.addInput('input', 'number')
        this.addOutput('output', 'number')
      }
    }

    LiteGraph.registerNodeType('test/connected', ConnectedNode)
    const graph = new LGraph()
    onTestFinished(() => graph.clear())
    const source = LiteGraph.createNode('test/connected', 'Source')!
    const target = LiteGraph.createNode('test/connected', 'Target')!
    graph.add(source)
    graph.add(target)
    const link = source.connect(0, target, 0)!

    const expectedLink = {
      id: link.id,
      originNodeId: source.id,
      originSlot: 0,
      targetNodeId: target.id,
      targetSlot: 0
    }
    const serialised = JSON.stringify(graph.serialize())
    graph.clear()

    const copied = new LGraph(JSON.parse(serialised) as ISerialisedGraph)
    onTestFinished(() => copied.clear())
    const copiedLink = useLinkStore().getInputSlotLink(
      graphScopeOf(copied),
      expectedLink.targetNodeId,
      expectedLink.targetSlot
    )

    expect(copiedLink).toMatchObject(expectedLink)
  })
})
