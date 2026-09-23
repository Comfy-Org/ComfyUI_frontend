import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'

import type {
  LGraph,
  Positionable,
  Subgraph,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { createTestNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import { reportError } from '@/platform/telemetry/reportError'

import {
  createTestRootGraph,
  enableSubgraphNodeCreation,
  resetSubgraphFixtureState
} from './__fixtures__/subgraphHelpers'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

beforeEach(() => {
  resetSubgraphFixtureState()
})

interface DefinitionHealth {
  nodes: number
  links: number
  serialisedNodes: number
  serialisedLinks: number
  reportedErrors: number
}

function captureHealth(
  rootGraph: LGraph,
  definition: Subgraph
): DefinitionHealth {
  const serialised = rootGraph
    .asSerialisable()
    .definitions?.subgraphs?.find(({ id }) => id === definition.id)

  return {
    nodes: definition.nodes.length,
    links: definition.links.size,
    serialisedNodes: serialised?.nodes?.length ?? 0,
    serialisedLinks: serialised?.links?.length ?? 0,
    reportedErrors: vi.mocked(reportError).mock.calls.length
  }
}

function buildSubgraphWithTwoLinkedInteriorNodes(parent: LGraph): {
  subgraph: Subgraph
  node: SubgraphNode
} {
  const origin = createTestNode(parent, [], ['number'])
  const target = createTestNode(parent, ['number'])
  origin.connect(0, target, 0)
  return parent.convertToSubgraph(new Set<Positionable>([origin, target]))
}

describe('Convert to Subgraph with a nested subgraph host in the selection', () => {
  it('keeps the nested definition serialisable after its only host moves into the new subgraph', () => {
    const rootGraph = createTestRootGraph()
    onTestFinished(enableSubgraphNodeCreation(rootGraph))

    const origin = createTestNode(rootGraph, [], ['number'])
    const target = createTestNode(rootGraph, ['number'])
    origin.connect(0, target, 0)
    const { subgraph: inner, node: innerHost } = rootGraph.convertToSubgraph(
      new Set<Positionable>([origin, target])
    )
    const sibling = createTestNode(rootGraph)

    const { subgraph: outer } = rootGraph.convertToSubgraph(
      new Set<Positionable>([innerHost, sibling])
    )

    const serialized = rootGraph.serialize()

    expect(reportError).not.toHaveBeenCalled()
    const definitions = new Map(
      (serialized.definitions?.subgraphs ?? []).map((s) => [s.id, s])
    )
    const innerDefinition = definitions.get(inner.id)
    const outerDefinition = definitions.get(outer.id)
    assert(innerDefinition?.nodes)
    assert(outerDefinition?.nodes)
    expect(innerDefinition.nodes.map((node) => node.type).sort()).toEqual(
      [origin.type, target.type].sort()
    )
    expect(outerDefinition.nodes.map((node) => node.type)).toContain(inner.id)
  })

  it.for([
    {
      shape: 'host selected on its own',
      wrap: (rootGraph: LGraph, host: SubgraphNode) => {
        rootGraph.convertToSubgraph(new Set<Positionable>([host]))
      }
    },
    {
      shape: 'host selected alongside a plain sibling',
      wrap: (rootGraph: LGraph, host: SubgraphNode) => {
        const sibling = createTestNode(rootGraph)
        rootGraph.convertToSubgraph(new Set<Positionable>([host, sibling]))
      }
    },
    {
      shape: 'host wrapped twice in a row',
      wrap: (rootGraph: LGraph, host: SubgraphNode) => {
        const { node: wrapper } = rootGraph.convertToSubgraph(
          new Set<Positionable>([host])
        )
        rootGraph.convertToSubgraph(new Set<Positionable>([wrapper]))
      }
    },
    {
      shape: 'host wrapped from inside the subgraph that owns it',
      wrap: (rootGraph: LGraph, host: SubgraphNode) => {
        const { subgraph: middle } = rootGraph.convertToSubgraph(
          new Set<Positionable>([host])
        )
        const relocatedHost = middle.nodes.find((node) => node.isSubgraphNode())
        assert(relocatedHost)
        middle.convertToSubgraph(new Set<Positionable>([relocatedHost]))
      }
    }
  ])(
    'keeps the wrapped definition intact when the $shape',
    ({ wrap }, { expect }) => {
      const rootGraph = createTestRootGraph()
      onTestFinished(enableSubgraphNodeCreation(rootGraph))
      const { subgraph: inner, node: innerHost } =
        buildSubgraphWithTwoLinkedInteriorNodes(rootGraph)

      wrap(rootGraph, innerHost)

      expect(captureHealth(rootGraph, inner)).toEqual({
        nodes: 2,
        links: 1,
        serialisedNodes: 2,
        serialisedLinks: 1,
        reportedErrors: 0
      })
    }
  )

  it('keeps every level of a three-deep nest intact when the outermost host is wrapped', () => {
    const rootGraph = createTestRootGraph()
    onTestFinished(enableSubgraphNodeCreation(rootGraph))

    const { subgraph: leaf, node: leafHost } =
      buildSubgraphWithTwoLinkedInteriorNodes(rootGraph)
    const middleOrigin = createTestNode(rootGraph, [], ['number'])
    const middleTarget = createTestNode(rootGraph, ['number'])
    middleOrigin.connect(0, middleTarget, 0)
    const { subgraph: middle, node: middleHost } = rootGraph.convertToSubgraph(
      new Set<Positionable>([leafHost, middleOrigin, middleTarget])
    )

    rootGraph.convertToSubgraph(
      new Set<Positionable>([middleHost, createTestNode(rootGraph)])
    )

    expect({
      leaf: captureHealth(rootGraph, leaf),
      middle: captureHealth(rootGraph, middle)
    }).toEqual({
      leaf: {
        nodes: 2,
        links: 1,
        serialisedNodes: 2,
        serialisedLinks: 1,
        reportedErrors: 0
      },
      middle: {
        nodes: 3,
        links: 1,
        serialisedNodes: 3,
        serialisedLinks: 1,
        reportedErrors: 0
      }
    })
  })
})

describe('Convert to Subgraph failing after the originals are removed', () => {
  it('releases only the definitions no live node still references', () => {
    const rootGraph = createTestRootGraph()
    onTestFinished(enableSubgraphNodeCreation(rootGraph))
    const { subgraph: orphaned, node: orphanedHost } =
      buildSubgraphWithTwoLinkedInteriorNodes(rootGraph)
    const { subgraph: shared, node: sharedHost } =
      buildSubgraphWithTwoLinkedInteriorNodes(rootGraph)
    const survivingSharedHost = LiteGraph.createNode(shared.id)
    assert(survivingSharedHost)
    rootGraph.add(survivingSharedHost)
    vi.spyOn(rootGraph, 'createSubgraph').mockImplementationOnce(() => {
      throw new Error('boom')
    })

    expect(() =>
      rootGraph.convertToSubgraph(
        new Set<Positionable>([orphanedHost, sharedHost])
      )
    ).toThrow('boom')

    expect({
      orphaned: rootGraph.subgraphs.has(orphaned.id),
      shared: rootGraph.subgraphs.has(shared.id)
    }).toEqual({ orphaned: false, shared: true })
  })
})
