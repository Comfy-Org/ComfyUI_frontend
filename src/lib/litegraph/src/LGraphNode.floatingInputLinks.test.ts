import { assert, describe, expect, it } from 'vitest'

import { toLinkId } from '@comfyorg/graph-model/linkId'
import { UNASSIGNED_NODE_ID } from '@comfyorg/graph-model/nodeId'

import { LGraph, LGraphNode, LLink } from '@/lib/litegraph/src/litegraph'

function nodeWithInputs(graph: LGraph, names: string[]) {
  const node = new LGraphNode('Node')
  for (const name of names) node.addInput(name, 'INT')
  graph.add(node)
  return node
}

function floatingInto(graph: LGraph, node: LGraphNode, slot: number) {
  const link = graph.addFloatingLink(
    new LLink(toLinkId(-1), 'INT', UNASSIGNED_NODE_ID, -1, node.id, slot)
  )
  assert(link)
  return link
}

describe('floating links into a node’s inputs', () => {
  it('go with an input that is removed, and the later ones shift onto their own inputs', () => {
    const graph = new LGraph()
    const node = nodeWithInputs(graph, ['x', 'y'])
    const intoX = floatingInto(graph, node, 0)
    const intoY = floatingInto(graph, node, 1)

    node.removeInput(0)

    expect(graph.floatingLinks.has(intoX.id)).toBe(false)
    expect(graph.floatingLinks.get(intoY.id)?.target_slot).toBe(0)
    expect(node.inputs.map(({ name }) => name)).toEqual(['y'])
  })
})
