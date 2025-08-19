import { describe } from 'vitest'

import { LGraph, LiteGraph } from '@/lib/litegraph/src/litegraph'

import { test } from './fixtures/testExtensions'

describe('LGraph', () => {
  test('can be instantiated', ({ expect }) => {
    // @ts-expect-error Intentional - extra holds any / all consumer data that should be serialised
    const graph = new LGraph({ extra: 'TestGraph' })
    expect(graph).toBeInstanceOf(LGraph)
    expect(graph.extra).toBe('TestGraph')
    expect(graph.extra).toBe('TestGraph')
  })

  test('is exactly the same type', async ({ expect }) => {
    const directImport = await import('@/lib/litegraph/src/LGraph')
    const entryPointImport = await import('@/lib/litegraph/src/litegraph')

    expect(LiteGraph.LGraph).toBe(directImport.LGraph)
    expect(LiteGraph.LGraph).toBe(entryPointImport.LGraph)
  })

  test('populates optional values', ({ expect, minimalSerialisableGraph }) => {
    const dGraph = new LGraph(minimalSerialisableGraph)
    expect(dGraph.links).toBeInstanceOf(Map)
    expect(dGraph.nodes).toBeInstanceOf(Array)
    expect(dGraph.groups).toBeInstanceOf(Array)
  })

  test('supports schema v0.4 graphs', ({ expect, oldSchemaGraph }) => {
    const fromOldSchema = new LGraph(oldSchemaGraph)
    expect(fromOldSchema).toMatchSnapshot('oldSchemaGraph')
  })
})

describe('Floating Links / Reroutes', () => {
  test('Floating reroute should be removed when node and link are removed', ({
    expect,
    floatingLinkGraph
  }) => {
    const graph = new LGraph(floatingLinkGraph)
    expect(graph.nodes.length).toBe(1)
    graph.remove(graph.nodes[0])
    expect(graph.nodes.length).toBe(0)
    expect(graph.links.size).toBe(0)
    expect(graph.floatingLinks.size).toBe(0)
    expect(graph.reroutes.size).toBe(0)
  })

  test('Can add reroute to existing link', ({ expect, linkedNodesGraph }) => {
    const graph = new LGraph(linkedNodesGraph)
    expect(graph.nodes.length).toBe(2)
    expect(graph.links.size).toBe(1)
    expect(graph.reroutes.size).toBe(0)

    graph.createReroute([0, 0], graph.links.values().next().value!)
    expect(graph.links.size).toBe(1)
    expect(graph.reroutes.size).toBe(1)
  })

  test('Create floating reroute when one side of node is removed', ({
    expect,
    linkedNodesGraph
  }) => {
    const graph = new LGraph(linkedNodesGraph)
    graph.createReroute([0, 0], graph.links.values().next().value!)
    graph.remove(graph.nodes[0])

    expect(graph.links.size).toBe(0)
    expect(graph.floatingLinks.size).toBe(1)
    expect(graph.reroutes.size).toBe(1)
    expect(graph.reroutes.values().next().value!.floating).not.toBeUndefined()
  })

  test('Create floating reroute when one side of link is removed', ({
    expect,
    linkedNodesGraph
  }) => {
    const graph = new LGraph(linkedNodesGraph)
    graph.createReroute([0, 0], graph.links.values().next().value!)
    graph.nodes[0].disconnectOutput(0)

    expect(graph.links.size).toBe(0)
    expect(graph.floatingLinks.size).toBe(1)
    expect(graph.reroutes.size).toBe(1)
    expect(graph.reroutes.values().next().value!.floating).not.toBeUndefined()
  })

  test('Reroutes and branches should be retained when the input node is removed', ({
    expect,
    floatingBranchGraph: graph
  }) => {
    expect(graph.nodes.length).toBe(3)
    graph.remove(graph.nodes[2])
    expect(graph.nodes.length).toBe(2)
    expect(graph.links.size).toBe(1)
    expect(graph.floatingLinks.size).toBe(1)
    expect(graph.reroutes.size).toBe(4)
    graph.remove(graph.nodes[1])
    expect(graph.nodes.length).toBe(1)
    expect(graph.links.size).toBe(0)
    expect(graph.floatingLinks.size).toBe(2)
    expect(graph.reroutes.size).toBe(4)
  })

  test('Floating reroutes should be removed when neither input nor output is connected', ({
    expect,
    floatingBranchGraph: graph
  }) => {
    // Remove output node
    graph.remove(graph.nodes[0])
    expect(graph.nodes.length).toBe(2)
    expect(graph.links.size).toBe(0)
    expect(graph.floatingLinks.size).toBe(2)
    // The original floating reroute should be removed
    expect(graph.reroutes.size).toBe(3)
    graph.remove(graph.nodes[0])
    expect(graph.nodes.length).toBe(1)
    expect(graph.links.size).toBe(0)
    expect(graph.floatingLinks.size).toBe(1)
    expect(graph.reroutes.size).toBe(3)
    graph.remove(graph.nodes[0])
    expect(graph.nodes.length).toBe(0)
    expect(graph.links.size).toBe(0)
    expect(graph.floatingLinks.size).toBe(0)
    expect(graph.reroutes.size).toBe(0)
  })
})

describe('Legacy LGraph Compatibility Layer', () => {
  test('can be extended via prototype', ({ expect, minimalGraph }) => {
    // @ts-expect-error Should always be an error.
    LGraph.prototype.newMethod = function () {
      return 'New method added via prototype'
    }
    // @ts-expect-error Should always be an error.
    expect(minimalGraph.newMethod()).toBe('New method added via prototype')
  })

  test('is correctly assigned to LiteGraph', ({ expect }) => {
    expect(LiteGraph.LGraph).toBe(LGraph)
  })
})
