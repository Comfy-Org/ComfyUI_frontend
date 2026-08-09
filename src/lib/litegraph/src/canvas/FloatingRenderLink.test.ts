import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { SUBGRAPH_OUTPUT_ID } from '@/lib/litegraph/src/constants'
import { LLink, slotFloatingLinks } from '@/lib/litegraph/src/LLink'
import { LGraph, LGraphNode, Reroute } from '@/lib/litegraph/src/litegraph'
import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@/types/graphScopeId'
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
  it('Given a registered floating link, when completing it at a subgraph output, then it replaces the link identity and registration', () => {
    const subgraph = createTestSubgraph({
      nodeCount: 1,
      outputs: [{ name: 'result', type: 'INT' }]
    })
    const [node] = subgraph.nodes
    const floatingLink = new LLink(
      toLinkId(-1),
      'INT',
      node.id,
      0,
      UNASSIGNED_NODE_ID,
      -1
    )
    floatingLink.parentId = toRerouteId(1)
    const reroute = new Reroute(toRerouteId(1), subgraph, [0, 0])
    subgraph._addReroute(reroute)
    subgraph.addFloatingLink(floatingLink)

    const renderLink = new FloatingRenderLink(
      subgraph,
      floatingLink,
      'output',
      reroute
    )
    renderLink.connectToSubgraphOutput(subgraph.outputs[0])

    const [replacement] = subgraph.links.values()
    expect(replacement.id).not.toBe(floatingLink.id)
    expect(replacement.target_id).toBe(SUBGRAPH_OUTPUT_ID)
    expect(replacement.target_slot).toBe(0)
    expect(replacement.origin_id).toBe(node.id)
    expect(subgraph.floatingLinks.has(floatingLink.id)).toBe(false)
    expect(
      useLinkStore().getLink(graphScopeOf(subgraph), floatingLink.id)
    ).toBeUndefined()
    expect(reroute.linkIds).toEqual(new Set([replacement.id]))
    expect(subgraph.outputs[0].linkIds).toEqual([replacement.id])
    expect(slotFloatingLinks(subgraph, 'output', node.id, 0)).toHaveLength(0)
  })

  it('Given an occupied subgraph output, when completing a floating link, then it removes the incumbent topology', () => {
    const subgraph = createTestSubgraph({
      nodeCount: 1,
      outputs: [{ name: 'result', type: '*' }]
    })
    const [node] = subgraph.nodes
    const incumbentReroute = new Reroute(toRerouteId(1), subgraph, [0, 0])
    subgraph._addReroute(incumbentReroute)
    const incumbent = subgraph.outputs[0].connect(
      node.outputs[0],
      node,
      incumbentReroute.id
    )!
    const floatingReroute = new Reroute(toRerouteId(2), subgraph, [0, 0])
    subgraph._addReroute(floatingReroute)
    const floatingLink = new LLink(
      toLinkId(-1),
      '*',
      node.id,
      0,
      UNASSIGNED_NODE_ID,
      -1,
      floatingReroute.id
    )
    subgraph.addFloatingLink(floatingLink)
    const renderLink = new FloatingRenderLink(
      subgraph,
      floatingLink,
      'output',
      floatingReroute
    )

    renderLink.connectToSubgraphOutput(subgraph.outputs[0])

    expect(subgraph.links.has(incumbent.id)).toBe(false)
    expect(
      useLinkStore().getLink(graphScopeOf(subgraph), incumbent.id)
    ).toBeUndefined()
    expect(incumbentReroute.linkIds.has(incumbent.id)).toBe(false)
    expect(subgraph.outputs[0].linkIds).toEqual([renderLink.link.id])
  })

  it('Given a subgraph input, when completing a floating link, then it dispatches the canonical connection lifecycle', () => {
    const subgraph = createTestSubgraph({
      nodeCount: 1,
      inputs: [{ name: 'value', type: '*' }]
    })
    const [node] = subgraph.nodes
    node.inputs[0].widget = { name: 'value' }
    const widget = node.addWidget('number', 'value', 0, () => {})
    const reroute = new Reroute(toRerouteId(1), subgraph, [0, 0])
    subgraph._addReroute(reroute)
    const floatingLink = inputFloatingLink(Number(node.id), 0)
    floatingLink.parentId = reroute.id
    subgraph.addFloatingLink(floatingLink)
    const renderLink = new FloatingRenderLink(
      subgraph,
      floatingLink,
      'input',
      reroute
    )
    let connected = false
    subgraph.inputs[0].events.addEventListener('input-connected', () => {
      connected = true
    })

    renderLink.connectToSubgraphInput(subgraph.inputs[0])

    expect(connected).toBe(true)
    expect(subgraph.inputs[0]._widget).toBe(widget)
    expect(subgraph.inputs[0].linkIds).toEqual([renderLink.link.id])
    expect(renderLink.link.id).not.toBe(floatingLink.id)
  })

  it('Given a floating reroute link, when setting its origin, then it replaces the link identity and reroute membership', () => {
    const graph = new LGraph()
    const source = new LGraphNode('Source')
    source.addOutput('value', 'INT')
    graph.add(source)
    const reroute = new Reroute(toRerouteId(1), graph, [0, 0])
    graph._addReroute(reroute)
    const floatingLink = new LLink(
      toLinkId(-1),
      'INT',
      source.id,
      0,
      UNASSIGNED_NODE_ID,
      -1
    )
    floatingLink.parentId = reroute.id
    graph.addFloatingLink(floatingLink)

    reroute.setFloatingLinkOrigin(source, 0)

    const [replacement] = graph.floatingLinks.values()
    expect(replacement.id).not.toBe(floatingLink.id)
    expect(replacement.origin_id).toBe(source.id)
    expect(replacement.origin_slot).toBe(0)
    expect(graph.floatingLinks.has(floatingLink.id)).toBe(false)
    expect(
      useLinkStore().getLink(graphScopeOf(graph), floatingLink.id)
    ).toBeUndefined()
    expect(reroute.floatingLinkIds).toEqual(new Set([replacement.id]))
    expect(reroute.linkIds).toHaveLength(0)
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
    expect(graph.floatingLinks.has(floatingLink.id)).toBe(false)
    expect(slotFloatingLinks(graph, 'input', node.id, 0)[0].id).not.toBe(
      floatingLink.id
    )
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
    expect(graph.floatingLinks.has(floatingLink.id)).toBe(false)
    expect(slotFloatingLinks(graph, 'output', node.id, 0)[0].id).not.toBe(
      floatingLink.id
    )
  })
})
