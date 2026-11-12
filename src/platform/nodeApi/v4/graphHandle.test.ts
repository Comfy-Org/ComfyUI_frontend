import { describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import { createComfyApi } from './comfyApi'
import type { NodeHandle } from './types'

const titles = (nodes: readonly NodeHandle[] | undefined) =>
  nodes?.map((node) => node.getTitle())

function rootWithOuterAndSubgraphWithInnerAndOther() {
  const root = new LGraph()
  const subgraph = createTestSubgraph({ rootGraph: root, name: 'Inner graph' })
  root.subgraphs.set(subgraph.id, subgraph)
  root.add(new LGraphNode('outer', 'Mine/A'))
  const placed = createTestSubgraphNode(subgraph, { parentGraph: root })
  placed.title = 'placed'
  root.add(placed)
  subgraph.add(new LGraphNode('inner', 'Mine/B'))
  subgraph.add(new LGraphNode('other', 'Theirs'))
  let visible: LGraph | null = root
  const { comfy, host } = createComfyApi({ getGraph: () => visible })
  return {
    root,
    subgraph,
    graph: comfy.graph,
    host,
    show: (graph: LGraph | null) => {
      visible = graph
    }
  }
}

describe('the graph on screen', () => {
  it('keeps the handles to its graphs when an undo or redo has rebuilt them', () => {
    const { root, graph, host } = rootWithOuterAndSubgraphWithInnerAndOther()
    const rootScope = graph.root()
    const definition = graph.subgraphs()[0]

    root.configure(root.serialize())
    host.afterHistoryRestore()

    expect(rootScope?.isDeleted).toBe(false)
    expect(definition.isDeleted).toBe(false)
    expect(graph.root()).toBe(rootScope)
    expect(graph.subgraphs()[0]).toBe(definition)
  })

  it('follows the user between graphs', () => {
    const { root, subgraph, graph, show } =
      rootWithOuterAndSubgraphWithInnerAndOther()

    expect(graph.id).toBe(root.id)
    expect(titles(graph.nodes())).toEqual(['outer', 'placed'])

    show(subgraph)

    expect(graph.id).toBe(subgraph.id)
    expect(titles(graph.nodes())).toEqual(['inner', 'other'])
  })

  it('has no id and no nodes before there is a graph', () => {
    const { graph, show } = rootWithOuterAndSubgraphWithInnerAndOther()
    show(null)

    expect(graph.id).toBeUndefined()
    expect(graph.nodes()).toEqual([])
    expect(Object.isFrozen(graph.nodes())).toBe(true)
    expect(graph.node('1')).toBeUndefined()
    expect(graph.nodesOfType('Mine/A')).toEqual([])
    expect(graph.queryNodes({ scope: 'root-and-subgraphs' })).toEqual([])
    expect(graph.root()).toBeUndefined()
    expect(graph.subgraphs()).toEqual([])
  })

  it('reaches the root graph from inside a subgraph', () => {
    const { root, subgraph, graph, show } =
      rootWithOuterAndSubgraphWithInnerAndOther()
    show(subgraph)

    expect(graph.root()?.id).toBe(root.id)
    expect(titles(graph.root()?.nodes())).toEqual(['outer', 'placed'])
  })

  it('finds a node by id, and nothing for an id that is not there', () => {
    const { root, graph } = rootWithOuterAndSubgraphWithInnerAndOther()
    const [outer] = root.nodes

    expect(graph.node(String(outer.id))?.getTitle()).toBe('outer')
    expect(graph.node('999')).toBeUndefined()
    expect(graph.node(`0${outer.id}`)).toBeUndefined()
  })

  it('lists the nodes of one type', () => {
    const { subgraph, graph, show } =
      rootWithOuterAndSubgraphWithInnerAndOther()
    show(subgraph)

    expect(titles(graph.nodesOfType('Theirs'))).toEqual(['other'])
    expect(graph.nodesOfType('Nothing')).toEqual([])
    expect(graph.nodesOfType('Mine')).toEqual([])
  })

  it('lists only the nodes of a type in the graph on screen', () => {
    const { graph } = rootWithOuterAndSubgraphWithInnerAndOther()

    expect(titles(graph.nodesOfType('Mine/A'))).toEqual(['outer'])
    expect(graph.nodesOfType('Theirs')).toEqual([])
  })

  it('gives lists a pack cannot change', () => {
    const { graph } = rootWithOuterAndSubgraphWithInnerAndOther()

    expect(Object.isFrozen(graph.nodes())).toBe(true)
    expect(Object.isFrozen(graph.nodesOfType('Mine/A'))).toBe(true)
    expect(Object.isFrozen(graph.queryNodes())).toBe(true)
    expect(Object.isFrozen(graph.subgraphs())).toBe(true)
  })
})

describe('querying nodes', () => {
  it('covers the graph on screen unless asked for more', () => {
    const { graph } = rootWithOuterAndSubgraphWithInnerAndOther()

    expect(titles(graph.queryNodes())).toEqual(['outer', 'placed'])
    expect(titles(graph.queryNodes({ scope: 'visible' }))).toEqual([
      'outer',
      'placed'
    ])
    expect(titles(graph.queryNodes(Object.create(null)))).toEqual([
      'outer',
      'placed'
    ])
  })

  it('reaches the root and every subgraph, with each node in its own graph', () => {
    const { root, subgraph, graph } =
      rootWithOuterAndSubgraphWithInnerAndOther()

    const found = graph.queryNodes({ scope: 'root-and-subgraphs' })

    expect(found.map((node) => [node.graphId, node.getTitle()])).toEqual([
      [root.id, 'outer'],
      [root.id, 'placed'],
      [subgraph.id, 'inner'],
      [subgraph.id, 'other']
    ])
  })

  it('reaches the root and every subgraph from inside a subgraph', () => {
    const { subgraph, graph, show } =
      rootWithOuterAndSubgraphWithInnerAndOther()
    show(subgraph)

    expect(titles(graph.queryNodes({ scope: 'root-and-subgraphs' }))).toEqual([
      'outer',
      'placed',
      'inner',
      'other'
    ])
  })

  it.for([
    { name: 'one type', type: 'Theirs', expected: ['other'] },
    {
      name: 'any of several types',
      type: ['Mine/A', 'Theirs'],
      expected: ['outer', 'other']
    }
  ])('narrows to $name', ({ type, expected }) => {
    const { graph } = rootWithOuterAndSubgraphWithInnerAndOther()

    expect(
      titles(graph.queryNodes({ scope: 'root-and-subgraphs', type }))
    ).toEqual(expected)
  })

  const refusals: {
    member: 'queryNodes' | 'nodesOfType' | 'node'
    argument: unknown
    message: string
  }[] = [
    {
      member: 'queryNodes',
      argument: { scope: 'everywhere' },
      message:
        "queryNodes needs a scope of visible or root-and-subgraphs, not 'everywhere'."
    },
    {
      member: 'queryNodes',
      argument: { toString: 'visible' },
      message:
        "queryNodes needs a query of scope and type only, not 'toString'."
    },
    {
      member: 'queryNodes',
      argument: { scope: 'toString' },
      message:
        "queryNodes needs a scope of visible or root-and-subgraphs, not 'toString'."
    },
    {
      member: 'queryNodes',
      argument: { scope: ['visible'] },
      message:
        'queryNodes needs a scope of visible or root-and-subgraphs, not a value of type object.'
    },
    {
      member: 'queryNodes',
      argument: { types: ['Mine/A'] },
      message: "queryNodes needs a query of scope and type only, not 'types'."
    },
    {
      member: 'queryNodes',
      argument: null,
      message: 'queryNodes needs a query object, not null.'
    },
    {
      member: 'queryNodes',
      argument: 'visible',
      message: "queryNodes needs a query object, not 'visible'."
    },
    {
      member: 'queryNodes',
      argument: { type: 5 },
      message: 'queryNodes needs a type name or a list of type names, not 5.'
    },
    {
      member: 'queryNodes',
      argument: { type: /^Mine\// },
      message:
        'queryNodes needs a type name or a list of type names, not a value of type object.'
    },
    {
      member: 'queryNodes',
      argument: { type: ['Mine/A', 5] },
      message: 'queryNodes needs a type name, not 5.'
    },
    {
      member: 'queryNodes',
      argument: { type: [5, 'Mine/A'] },
      message: 'queryNodes needs a type name, not 5.'
    },
    {
      member: 'queryNodes',
      argument: { type: ['Mine/A', 5, true] },
      message: 'queryNodes needs a type name, not 5.'
    },
    {
      member: 'queryNodes',
      argument: { type: null },
      message: 'queryNodes needs a type name or a list of type names, not null.'
    },
    {
      member: 'queryNodes',
      argument: { '': 'visible' },
      message: "queryNodes needs a query of scope and type only, not ''."
    },
    {
      member: 'queryNodes',
      argument: /Mine/,
      message: 'queryNodes needs a query object, not a value of type object.'
    },
    {
      member: 'queryNodes',
      argument: new Map([['type', 'Mine/A']]),
      message: 'queryNodes needs a query object, not a value of type object.'
    },
    {
      member: 'queryNodes',
      argument: Object.create({ type: 'Mine/A' }),
      message: 'queryNodes needs a query object, not a value of type object.'
    },
    {
      member: 'node',
      argument: ['1'],
      message: 'node needs a node id, not a value of type object.'
    },
    {
      member: 'node',
      argument: { toString: (): string => '1' },
      message: 'node needs a node id, not a value of type object.'
    },
    {
      member: 'node',
      argument: 1,
      message: 'node needs a node id, not 1.'
    },
    {
      member: 'node',
      argument: undefined,
      message: 'node needs a node id, not undefined.'
    },
    {
      member: 'nodesOfType',
      argument: undefined,
      message: 'nodesOfType needs a type name, not undefined.'
    },
    {
      member: 'nodesOfType',
      argument: /Mine/,
      message: 'nodesOfType needs a type name, not a value of type object.'
    }
  ]

  it.for(refusals)(
    'refuses $member given $argument from untyped code',
    ({ member, argument, message }) => {
      const { graph } = rootWithOuterAndSubgraphWithInnerAndOther()

      expect(() => Reflect.apply(graph[member], graph, [argument])).toThrow(
        new TypeError(message)
      )
    }
  )
})

describe('graph scopes', () => {
  it('refuses a node id that is not a string, even from a removed subgraph', () => {
    const { graph, root, subgraph } =
      rootWithOuterAndSubgraphWithInnerAndOther()
    const scope = graph.subgraphs()[0]
    root.subgraphs.delete(subgraph.id)

    expect(() => Reflect.apply(scope.node, scope, [['1']])).toThrow(
      new TypeError('node needs a node id, not a value of type object.')
    )
  })

  it('names the root graph and each subgraph', () => {
    const { root, subgraph, graph } =
      rootWithOuterAndSubgraphWithInnerAndOther()

    expect(graph.root()).toMatchObject({ id: root.id, name: undefined })
    expect(graph.subgraphs()).toEqual([
      expect.objectContaining({ id: subgraph.id, name: 'Inner graph' })
    ])
  })

  it('reads a graph that is not on screen', () => {
    const { subgraph, graph } = rootWithOuterAndSubgraphWithInnerAndOther()
    const [scope] = graph.subgraphs()
    const [inner] = subgraph.nodes

    expect(titles(scope.nodes())).toEqual(['inner', 'other'])
    expect(scope.node(String(inner.id))?.getTitle()).toBe('inner')
    expect(scope.node('999')).toBeUndefined()
  })

  it('goes on reading a subgraph after undo rebuilds it', () => {
    const { root, graph } = rootWithOuterAndSubgraphWithInnerAndOther()
    const [scope] = graph.subgraphs()

    root.configure(root.serialize())

    expect(scope.isDeleted).toBe(false)
    expect(titles(scope.nodes())).toEqual(['inner', 'other'])
  })

  it('keeps the handle to a node in a subgraph through an undo that keeps the node', () => {
    const { root, subgraph, graph, host } =
      rootWithOuterAndSubgraphWithInnerAndOther()
    const [scope] = graph.subgraphs()
    const [inner] = subgraph.nodes
    const kept = scope.node(String(inner.id))

    root.configure(root.serialize())
    host.afterHistoryRestore()

    expect(kept?.isDeleted).toBe(false)
    expect(scope.node(String(inner.id))).toBe(kept)
  })

  it('finds a node added to a subgraph after undo rebuilt it', () => {
    const { root, subgraph, graph } =
      rootWithOuterAndSubgraphWithInnerAndOther()
    const [scope] = graph.subgraphs()
    root.configure(root.serialize())
    const added = new LGraphNode('added after undo', 'Mine/C')
    root.subgraphs.get(subgraph.id)?.add(added)

    expect(scope.node(added.id)?.getTitle()).toBe('added after undo')
  })

  it('reads nothing from a subgraph that has been removed', () => {
    const { root, subgraph, graph } =
      rootWithOuterAndSubgraphWithInnerAndOther()
    const [scope] = graph.subgraphs()
    expect(scope.isDeleted).toBe(false)

    root.subgraphs.delete(subgraph.id)

    expect(scope.isDeleted).toBe(true)
    expect(scope.name).toBeUndefined()
    expect(scope.nodes()).toBeUndefined()
    expect(scope.node('1')).toBeUndefined()
  })
})

describe('one handle per graph', () => {
  it('gives the same graph handle until another document begins, then retires it', () => {
    const root = new LGraph()
    const subgraph = createTestSubgraph({ rootGraph: root })
    root.subgraphs.set(subgraph.id, subgraph)
    const { comfy, host } = createComfyApi({ getGraph: () => root })
    const rootScope = comfy.graph.root()
    const [subgraphScope] = comfy.graph.subgraphs()

    expect(comfy.sameEntity(rootScope, comfy.graph.root())).toBe(true)
    expect(comfy.sameEntity(subgraphScope, comfy.graph.subgraphs()[0])).toBe(
      true
    )

    host.beginDocument()

    expect(rootScope?.isDeleted).toBe(true)
    expect(subgraphScope.isDeleted).toBe(true)
    expect(comfy.graph.root()).not.toBe(rootScope)
    expect(comfy.graph.root()?.isDeleted).toBe(false)
  })

  it('gives graph handles a pack cannot change', () => {
    const { graph } = rootWithOuterAndSubgraphWithInnerAndOther()

    expect(Object.isFrozen(graph)).toBe(true)
    expect(Object.isFrozen(graph.root())).toBe(true)
    expect(Object.isFrozen(graph.subgraphs()[0])).toBe(true)
  })
})

describe('one handle per node', () => {
  it('gives the same handle whichever way a node is reached', () => {
    const { subgraph, graph, show } =
      rootWithOuterAndSubgraphWithInnerAndOther()
    const [inner] = subgraph.nodes
    const viaScope = graph.subgraphs()[0].node(String(inner.id))
    const viaQuery = graph.queryNodes({ scope: 'root-and-subgraphs' })[2]

    show(subgraph)

    expect(viaScope).toBeDefined()
    expect(graph.node(String(inner.id))).toBe(viaScope)
    expect(graph.nodes()[0]).toBe(viaScope)
    expect(viaQuery).toBe(viaScope)
  })
})
