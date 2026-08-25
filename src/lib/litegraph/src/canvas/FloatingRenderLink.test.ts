import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { SUBGRAPH_OUTPUT_ID } from '@/lib/litegraph/src/constants'
import { LLink, slotFloatingLinks } from '@/lib/litegraph/src/LLink'
import { LGraph, LGraphNode, Reroute } from '@/lib/litegraph/src/litegraph'
import { toLinkId } from '@/types/linkId'
import { toNodeId, UNASSIGNED_NODE_ID } from '@/types/nodeId'
import { toRerouteId } from '@/types/rerouteId'

import { createTestSubgraph } from '../subgraph/__fixtures__/subgraphHelpers'
import { FloatingRenderLink } from './FloatingRenderLink'

beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

function inputFloatingLink(targetId: number, targetSlot: number): LLink {
  return new LLink(
    toLinkId(-1),
    'INT',
    UNASSIGNED_NODE_ID,
    -1,
    toNodeId(targetId),
    targetSlot
  )
}

describe('FloatingRenderLink', () => {
  it('connectToSubgraphOutput re-targets the floating link to the output slot', () => {
    const subgraph = createTestSubgraph({
      nodeCount: 1,
      outputs: [{ name: 'result', type: 'INT' }]
    })
    const [node] = subgraph.nodes
    const floatingLink = inputFloatingLink(Number(node.id), 0)
    floatingLink.parentId = toRerouteId(1)
    const reroute = new Reroute(toRerouteId(1), subgraph, [0, 0])
    subgraph._addReroute(reroute)
    subgraph.addFloatingLink(floatingLink)

    const renderLink = new FloatingRenderLink(
      subgraph,
      floatingLink,
      'input',
      reroute
    )
    renderLink.connectToSubgraphOutput(subgraph.outputs[0])

    expect(floatingLink.target_id).toBe(SUBGRAPH_OUTPUT_ID)
    expect(floatingLink.target_slot).toBe(0)
    expect(floatingLink.origin_id).toBe(UNASSIGNED_NODE_ID)
    expect(slotFloatingLinks(subgraph, 'input', node.id, 0)).toHaveLength(0)
  })
})

describe('slot removal renumbers floating link attachments', () => {
  it('removeInput shifts floating links on later inputs', () => {
    const graph = new LGraph()
    const node = new LGraphNode('N')
    node.addInput('a', 'INT')
    node.addInput('b', 'INT')
    graph.add(node)
    const floatingLink = inputFloatingLink(Number(node.id), 1)
    graph.addFloatingLink(floatingLink)

    node.removeInput(0)

    expect(slotFloatingLinks(graph, 'input', node.id, 0)).toHaveLength(1)
    expect(floatingLink.target_slot).toBe(0)
  })

  it('removeOutput shifts floating links on later outputs', () => {
    const graph = new LGraph()
    const node = new LGraphNode('N')
    node.addOutput('a', 'INT')
    node.addOutput('b', 'INT')
    graph.add(node)
    const floatingLink = new LLink(
      toLinkId(-1),
      'INT',
      node.id,
      1,
      UNASSIGNED_NODE_ID,
      -1
    )
    graph.addFloatingLink(floatingLink)

    node.removeOutput(0)

    expect(slotFloatingLinks(graph, 'output', node.id, 0)).toHaveLength(1)
    expect(floatingLink.origin_slot).toBe(0)
  })
})
