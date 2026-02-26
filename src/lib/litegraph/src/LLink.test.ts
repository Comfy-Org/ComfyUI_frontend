import { describe, expect } from 'vitest'

import { LGraph, LGraphNode, LLink } from '@/lib/litegraph/src/litegraph'

import { test } from './__fixtures__/testExtensions'

describe('LLink', () => {
  test('matches previous snapshot', () => {
    const link = new LLink(1, 'float', 4, 2, 5, 3)
    expect(link.serialize()).toMatchSnapshot('Basic')
  })

  test('serializes to the previous snapshot', () => {
    const link = new LLink(1, 'float', 4, 2, 5, 3)
    expect(link.serialize()).toMatchSnapshot('Basic')
  })

  test('origin and target lookups resolve via getLink accessor', () => {
    const graph = new LGraph()
    const originNode = new LGraphNode('origin')
    originNode.addOutput('out', 'number')
    const targetNode = new LGraphNode('target')
    targetNode.addInput('in', 'number')

    graph.add(originNode)
    graph.add(targetNode)

    originNode.connect(0, targetNode, 0)
    const linkId = originNode.outputs[0].links?.[0]
    if (linkId == null) throw new Error('Expected link ID')

    const projectedLinks = new Map(graph.links)
    graph.linkStore.rehydrate({
      links: projectedLinks,
      floatingLinks: graph.floatingLinks,
      reroutes: graph.reroutes
    })
    graph.links.clear()

    expect(LLink.getOriginNode(graph, linkId)).toBe(originNode)
    expect(LLink.getTargetNode(graph, linkId)).toBe(targetNode)
  })

  test('resolveMany resolves links via projected accessor', () => {
    const graph = new LGraph()
    const originNode = new LGraphNode('origin')
    originNode.addOutput('out', 'number')

    const targetNode = new LGraphNode('target')
    targetNode.addInput('in', 'number')

    graph.add(originNode)
    graph.add(targetNode)

    originNode.connect(0, targetNode, 0)
    const linkId = originNode.outputs[0].links?.[0]
    if (linkId == null) throw new Error('Expected link ID')

    const projectedLinks = new Map(graph.links)
    graph.linkStore.rehydrate({
      links: projectedLinks,
      floatingLinks: graph.floatingLinks,
      reroutes: graph.reroutes
    })
    graph.links.clear()

    const [resolved] = LLink.resolveMany([linkId], graph)
    expect(resolved?.link).toBe(projectedLinks.get(linkId))
    expect(resolved?.outputNode).toBe(originNode)
    expect(resolved?.inputNode).toBe(targetNode)
  })
})
