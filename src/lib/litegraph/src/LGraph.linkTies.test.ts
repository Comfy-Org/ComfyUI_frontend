import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { createTestNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'
import { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode, Positionable } from '@/lib/litegraph/src/litegraph'
import { remapLinkReferences } from '@/lib/litegraph/src/linkDeduplication'
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
  if (!link) throw new Error('Failed to connect test link')
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
  it.for([0.4, 1])('round-trips ties through schema %s', (version) => {
    const graph = createTestRootGraph()
    const { links } = tiedPair(graph)

    const serialized =
      version === 0.4 ? graph.serialize() : graph.asSerialisable()
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
    if (!pasted) throw new Error('Paste produced no results')

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
