import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  layoutStore.resetForTests()
})

describe('LGraph node removal contract', () => {
  it("lets an extension's onRemoved callback read the node geometry while the node is being removed", () => {
    const graph = new LGraph()
    const node = new LGraphNode('removed node')
    node.pos = [100, 50]
    graph.add(node)
    let observedGeometry: { x: number; y: number } | undefined
    node.onRemoved = () => {
      observedGeometry = layoutStore.getNodeLayoutRef(graph.id, node.id).value
        ?.position
    }
    graph.remove(node)
    expect(observedGeometry).toEqual({ x: 100, y: 50 })
  })

  it('leaves the graph exactly as it was when removal fails', () => {
    const graph = new LGraph()
    const source = new LGraphNode('source')
    source.addOutput('out', '*')
    const removed = new LGraphNode('removed')
    removed.addInput('in', '*')
    removed.addOutput('out', '*')
    const target = new LGraphNode('target')
    target.addInput('in', '*')
    graph.add(source)
    graph.add(removed)
    graph.add(target)
    const inputLink = source.connect(0, removed, 0)!
    const outputLink = removed.connect(0, target, 0)!
    removed.onRemoved = () => {
      throw new Error('extension rejected removal')
    }
    const remove = () => graph.remove(removed)
    expect(remove).toThrow('extension rejected removal')
    expect({
      nodeIsListed: graph.nodes.includes(removed),
      nodeIsIndexed: graph.getNodeById(removed.id) === removed,
      nodeOwnsGraph: removed.graph === graph,
      graphLinks: [
        graph.links.get(inputLink.id),
        graph.links.get(outputLink.id)
      ],
      sourceIsConnected: source.isOutputConnected(0),
      removedInputIsConnected: removed.isInputConnected(0),
      removedOutputIsConnected: removed.isOutputConnected(0),
      targetIsConnected: target.isInputConnected(0)
    }).toEqual({
      nodeIsListed: true,
      nodeIsIndexed: true,
      nodeOwnsGraph: true,
      graphLinks: [inputLink, outputLink],
      sourceIsConnected: true,
      removedInputIsConnected: true,
      removedOutputIsConnected: true,
      targetIsConnected: true
    })
  })
})
