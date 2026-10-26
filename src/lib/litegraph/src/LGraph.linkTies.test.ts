import { assert, describe, expect, it, onTestFinished, vi } from 'vitest'

import { createTestNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'
import { LGraph, LGraphCanvas, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { Positionable } from '@/lib/litegraph/src/litegraph'
import {
  realignInputLinkSlots,
  remapLinkReferences
} from '@/lib/litegraph/src/linkDeduplication'
import {
  createTestRootGraph,
  enableSubgraphNodeCreation
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { LLink } from '@/lib/litegraph/src/LLink'
import { useLinkTieStore } from '@/stores/linkTieStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/canvasTestUtils'

vi.mock(import('@/services/litegraphService'))

function connect(origin: LGraphNode, target: LGraphNode, slot = 0): LLink {
  const link = origin.connect(slot, target, slot)
  assert.exists(link)
  return link
}

function tiedPair(graph: LGraph) {
  const origin = createTestNode(graph, [], ['number', 'number'])
  const target = createTestNode(graph, ['number', 'number'])
  const links = [connect(origin, target, 0), connect(origin, target, 1)]
  useLinkTieStore().addTie(graphScopeOf(graph), {
    pos: [120, 40],
    angle: 0.5,
    linkIds: links.map((link) => link.id)
  })
  return { origin, target, links }
}

function tiesOf(graph: LGraph) {
  return useLinkTieStore().getTies(graphScopeOf(graph))
}

function createCanvas(graph: LGraph): LGraphCanvas {
  const el = document.createElement('canvas')
  el.getContext = vi.fn().mockReturnValue(createMockCanvasRenderingContext2D())
  return new LGraphCanvas(el, graph, { skip_render: true, skip_events: true })
}

describe('link tie serialization', () => {
  it.for([
    { schema: '0.4', serialise: (graph: LGraph) => graph.serialize() },
    { schema: '1', serialise: (graph: LGraph) => graph.asSerialisable() }
  ])('round-trips ties through schema $schema', ({ serialise }) => {
    const graph = createTestRootGraph()
    const { links } = tiedPair(graph)

    const serialized = serialise(graph)
    const restored = new LGraph()
    restored.configure(structuredClone(serialized))

    expect(serialized.extra?.linkTies).toEqual([
      { id: 1, pos: [120, 40], angle: 0.5, linkIds: links.map((l) => l.id) }
    ])
    expect(tiesOf(restored)).toEqual([
      { id: 1, pos: [120, 40], angle: 0.5, linkIds: links.map((l) => l.id) }
    ])
    expect(restored.extra).not.toHaveProperty('linkTies')
  })

  it('leaves a workflow without ties unchanged', () => {
    const graph = createTestRootGraph()
    connect(
      createTestNode(graph, [], ['number']),
      createTestNode(graph, ['number'])
    )

    expect(graph.serialize().extra).not.toHaveProperty('linkTies')
  })

  it.for([
    { shape: 'an object', linkTies: { 0: 'tie' } },
    {
      shape: 'a tie without link ids',
      linkTies: [{ id: 1, pos: [0, 0], angle: 0 }]
    },
    {
      shape: 'a tie with non-array link ids',
      linkTies: [{ id: 1, pos: [0, 0], angle: 0, linkIds: 1 }]
    },
    {
      shape: 'a tie with a non-array position',
      linkTies: [{ id: 1, pos: 4, angle: 0, linkIds: [1, 2] }]
    }
  ])(
    'loads the graph without ties when extra.linkTies is $shape',
    ({ linkTies }) => {
      const graph = createTestRootGraph()
      const { links } = tiedPair(graph)
      const serialized = graph.serialize()
      assert.exists(serialized.extra)
      Object.assign(serialized.extra, { linkTies })

      const restored = new LGraph()
      restored.configure(serialized)

      expect([...restored.links.keys()]).toEqual(links.map((link) => link.id))
      expect(tiesOf(restored)).toEqual([])
    }
  )

  it('collapses duplicate link ids when a workflow loads', () => {
    const graph = createTestRootGraph()
    const [first, second] = tiedPair(graph).links
    const serialized = graph.serialize()
    serialized.extra = {
      ...serialized.extra,
      linkTies: [
        {
          id: 1,
          pos: [0, 0],
          angle: 0,
          linkIds: [first.id, first.id, second.id, first.id]
        }
      ]
    }

    const restored = new LGraph()
    restored.configure(serialized)

    expect(tiesOf(restored).map((tie) => tie.linkIds)).toEqual([
      [first.id, second.id]
    ])
  })

  it('drops links that no longer exist when a workflow loads', () => {
    const graph = createTestRootGraph()
    const { links } = tiedPair(graph)
    const serialized = graph.serialize()
    const [saved] = serialized.extra?.linkTies ?? []
    serialized.extra = {
      ...serialized.extra,
      linkTies: [
        { ...saved, linkIds: [...saved.linkIds, 998] },
        { id: 2, pos: [0, 0], angle: 0, linkIds: [999] }
      ]
    }

    const restored = new LGraph()
    restored.configure(serialized)

    expect(tiesOf(restored).map((tie) => tie.linkIds)).toEqual([
      links.map((link) => link.id)
    ])
  })

  it('follows link ids reminted while normalizing a graph', () => {
    const graph = createTestRootGraph()
    const { links } = tiedPair(graph)
    const serialized = graph.asSerialisable()

    remapLinkReferences(serialized, new Map([[links[0].id, 50]]))

    expect(serialized.extra.linkTies?.[0].linkIds).toEqual([50, links[1].id])
  })
})

describe('link tie lifecycle', () => {
  it('drops a removed link from its tie and the tie with its last link', () => {
    const graph = createTestRootGraph()
    const { target, links } = tiedPair(graph)

    target.disconnectInput(0)

    expect(tiesOf(graph).map((tie) => tie.linkIds)).toEqual([[links[1].id]])

    target.disconnectInput(1)

    expect(tiesOf(graph)).toEqual([])
  })

  it('keeps ties on copied links through copy and paste', () => {
    const graph = createTestRootGraph()
    const { origin, target, links } = tiedPair(graph)
    const canvas = createCanvas(graph)

    const pasted = canvas._deserializeItems(
      canvas._serializeItems([origin, target]),
      { position: [origin.pos[0] + 100, origin.pos[1]] }
    )
    assert.exists(pasted)

    const pastedIds = links.map((link) => pasted.links.get(link.id)?.id)
    expect(tiesOf(graph)).toEqual([
      expect.objectContaining({ id: 1, pos: [120, 40] }),
      { id: 2, pos: [220, 40], angle: 0.5, linkIds: pastedIds }
    ])
  })

  it('moves ties on interior links into a new subgraph', () => {
    const graph = createTestRootGraph()
    onTestFinished(enableSubgraphNodeCreation(graph))
    const { origin, target } = tiedPair(graph)

    const { subgraph } = graph.convertToSubgraph(
      new Set<Positionable>([origin, target])
    )

    const interiorIds = [...subgraph.links.values()]
      .filter(
        (link) =>
          link.origin_id !== SUBGRAPH_INPUT_ID &&
          link.target_id !== SUBGRAPH_OUTPUT_ID
      )
      .map((link) => link.id)
    expect(tiesOf(graph)).toEqual([])
    expect(tiesOf(subgraph)).toEqual([
      { id: 1, pos: [120, 40], angle: 0.5, linkIds: interiorIds }
    ])
    expect(subgraph.asSerialisable().extra.linkTies).toHaveLength(1)
    expect(interiorIds).toHaveLength(2)
  })
})

describe('link tie recreation flows', () => {
  it('remaps ties on boundary links to their replacements when converting', () => {
    const graph = createTestRootGraph()
    onTestFinished(enableSubgraphNodeCreation(graph))
    const { target } = tiedPair(graph)

    const { node } = graph.convertToSubgraph(new Set<Positionable>([target]))

    const replacements = [...graph.links.values()]
      .filter((link) => link.target_id === node.id)
      .map((link) => link.id)
    expect(replacements).toHaveLength(2)
    expect(tiesOf(graph)).toEqual([
      { id: 1, pos: [120, 40], angle: 0.5, linkIds: replacements }
    ])
  })

  it('brings interior ties back, offset with the nodes, when unpacking', () => {
    const graph = createTestRootGraph()
    onTestFinished(enableSubgraphNodeCreation(graph))
    const { origin, target } = tiedPair(graph)
    const { node } = graph.convertToSubgraph(
      new Set<Positionable>([origin, target])
    )

    graph.unpackSubgraph(node)

    const unpackedOrigin = graph.nodes.find(
      (candidate) => candidate.outputs.length === 2
    )
    assert.exists(unpackedOrigin)
    const [tie] = tiesOf(graph)
    expect(tiesOf(graph)).toHaveLength(1)
    expect(tie.linkIds).toEqual(
      unpackedOrigin.outputs.flatMap((output) => output.links ?? [])
    )
    expect([
      tie.pos[0] - unpackedOrigin.pos[0],
      tie.pos[1] - unpackedOrigin.pos[1]
    ]).toEqual([120 - origin.pos[0], 40 - origin.pos[1]])
  })

  it('drops a link removed by input slot realignment from its tie', () => {
    const graph = createTestRootGraph()
    const source = createTestNode(graph, [], ['number'])
    const target = new LGraphNode('Target')
    for (const name of ['p', 'q', 'r']) target.addInput(name, 'number')
    graph.add(target)
    const squatter = connect(source, target, 0)
    const blocked = source.connect(0, target, 1)
    const free = source.connect(0, target, 2)
    assert.exists(blocked)
    assert.exists(free)
    useLinkTieStore().addTie(graphScopeOf(graph), {
      pos: [0, 0],
      angle: 0,
      linkIds: [squatter.id, blocked.id]
    })
    const nodeData = target.serialize()
    nodeData.inputs = [
      { name: 'no_such_input', type: 'number', link: squatter.id },
      { name: 'p', type: 'number', link: blocked.id },
      { name: 'q', type: 'number', link: free.id }
    ]

    realignInputLinkSlots(graph, [[target.id, nodeData]])

    expect(graph.links.has(squatter.id)).toBe(false)
    expect(tiesOf(graph).map((tie) => tie.linkIds)).toEqual([[blocked.id]])
    expect(graph.serialize().extra?.linkTies?.[0].linkIds).toEqual([blocked.id])
  })
})
