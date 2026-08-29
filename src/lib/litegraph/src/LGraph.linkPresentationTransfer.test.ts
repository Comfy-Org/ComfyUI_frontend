import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, onTestFinished } from 'vitest'

import { createTestNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import { ToInputFromIoNodeLink } from '@/lib/litegraph/src/canvas/ToInputFromIoNodeLink'
import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'
import { MovingInputLink } from '@/lib/litegraph/src/canvas/MovingInputLink'
import { MovingOutputLink } from '@/lib/litegraph/src/canvas/MovingOutputLink'
import { CustomEventTarget } from '@/lib/litegraph/src/infrastructure/CustomEventTarget'
import type { LinkConnectorEventMap } from '@/lib/litegraph/src/infrastructure/LinkConnectorEventMap'
import type { Positionable } from '@/lib/litegraph/src/litegraph'
import {
  createTestRootGraph,
  enableSubgraphNodeCreation,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import {
  createMockCanvas2DContext,
  createTestCanvas
} from '@/utils/__tests__/litegraphTestUtils'

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  resetSubgraphFixtureState()
})

describe('link presentation transfer across recreation flows', () => {
  it('keeps interior presentation through a convert and unpack round-trip', () => {
    const rootGraph = createTestRootGraph()
    onTestFinished(enableSubgraphNodeCreation(rootGraph))
    const origin = createTestNode(rootGraph, [], ['number'])
    const target = createTestNode(rootGraph, ['number'])
    const link = origin.connect(0, target, 0)
    if (!link) throw new Error('Failed to connect interior test link')
    link.hidden = true
    link.label = 'Interior'

    const { subgraph, node: subgraphNode } = rootGraph.convertToSubgraph(
      new Set<Positionable>([origin, target])
    )

    const interior = [...subgraph.links.values()].find(
      (candidate) =>
        candidate.origin_id !== SUBGRAPH_INPUT_ID &&
        candidate.target_id !== SUBGRAPH_OUTPUT_ID
    )
    expect(interior?.hidden).toBe(true)
    expect(interior?.label).toBe('Interior')

    rootGraph.unpackSubgraph(subgraphNode)

    const [unpacked] = [...rootGraph.links.values()]
    expect(unpacked?.hidden).toBe(true)
    expect(unpacked?.label).toBe('Interior')
  })

  it('carries boundary presentation onto the parent link and back through unpack', () => {
    const rootGraph = createTestRootGraph()
    onTestFinished(enableSubgraphNodeCreation(rootGraph))
    const exterior = createTestNode(rootGraph, [], ['number'])
    const origin = createTestNode(rootGraph, ['number'], ['number'])
    const target = createTestNode(rootGraph, ['number'])
    const boundary = exterior.connect(0, origin, 0)
    if (!boundary) throw new Error('Failed to connect boundary test link')
    origin.connect(0, target, 0)
    boundary.hidden = true
    boundary.label = 'Boundary'

    const { node: subgraphNode } = rootGraph.convertToSubgraph(
      new Set<Positionable>([origin, target])
    )

    const parentBoundary = [...rootGraph.links.values()].find(
      (candidate) => candidate.origin_id === exterior.id
    )
    expect(parentBoundary?.hidden).toBe(true)
    expect(parentBoundary?.label).toBe('Boundary')

    rootGraph.unpackSubgraph(subgraphNode)

    const merged = [...rootGraph.links.values()].find(
      (candidate) => candidate.origin_id === exterior.id
    )
    expect(merged?.hidden).toBe(true)
    expect(merged?.label).toBe('Boundary')
  })

  it('preserves presentation through clipboard copy and paste', () => {
    const rootGraph = createTestRootGraph()
    const origin = createTestNode(rootGraph, [], ['number'])
    const target = createTestNode(rootGraph, ['number'])
    const link = origin.connect(0, target, 0)
    if (!link) throw new Error('Failed to connect clipboard test link')
    link.hidden = true
    link.label = 'Copied'
    const canvas = createTestCanvas(
      rootGraph,
      createMockCanvas2DContext({
        measureText: () => ({ width: 50 }) as TextMetrics
      })
    )

    const results = canvas._deserializeItems(
      canvas._serializeItems([origin, target]),
      {}
    )
    if (!results) throw new Error('Paste produced no results')
    const { links } = results

    const pasted = [...links.values()][0]
    expect(pasted).toBeDefined()
    expect(pasted.id).not.toBe(link.id)
    expect(pasted.hidden).toBe(true)
    expect(pasted.label).toBe('Copied')
  })

  it('keeps presentation when a subgraph-input boundary link is retargeted', () => {
    const rootGraph = createTestRootGraph()
    onTestFinished(enableSubgraphNodeCreation(rootGraph))
    const exterior = createTestNode(rootGraph, [], ['number'])
    const origin = createTestNode(rootGraph, ['number'], ['number'])
    const target = createTestNode(rootGraph, ['number'])
    exterior.connect(0, origin, 0)
    origin.connect(0, target, 0)

    const { subgraph } = rootGraph.convertToSubgraph(
      new Set<Positionable>([origin, target])
    )
    const boundary = [...subgraph.links.values()].find(
      (candidate) => candidate.origin_id === SUBGRAPH_INPUT_ID
    )
    if (!boundary) throw new Error('Interior boundary link was not found')
    boundary.hidden = true
    boundary.label = 'Boundary'
    const other = createTestNode(subgraph, ['number'])

    const moving = new ToInputFromIoNodeLink(
      subgraph,
      subgraph.inputNode,
      subgraph.inputs[0],
      undefined,
      undefined,
      boundary
    )
    const events = new CustomEventTarget<LinkConnectorEventMap>()
    moving.connectToInput(other, other.inputs[0], events)

    const retargeted = [...subgraph.links.values()].find(
      (candidate) =>
        candidate.origin_id === SUBGRAPH_INPUT_ID &&
        candidate.target_id === other.id
    )
    expect(retargeted?.hidden).toBe(true)
    expect(retargeted?.label).toBe('Boundary')
  })

  it('moves fan-out presentation onto the merged boundary only when unambiguous', () => {
    const rootGraph = createTestRootGraph()
    onTestFinished(enableSubgraphNodeCreation(rootGraph))
    const exterior = createTestNode(rootGraph, [], ['number'])
    const first = createTestNode(rootGraph, ['number'])
    const second = createTestNode(rootGraph, ['number'])
    const hiddenLink = exterior.connect(0, first, 0)
    if (!hiddenLink) throw new Error('Failed to connect fan-out test link')
    exterior.connect(0, second, 0)
    hiddenLink.hidden = true

    rootGraph.convertToSubgraph(new Set<Positionable>([first, second]))

    const boundary = [...rootGraph.links.values()].find(
      (candidate) => candidate.origin_id === exterior.id
    )
    expect(boundary?.hidden).toBe(false)
  })

  it('moves uniform fan-out presentation onto the merged boundary', () => {
    const rootGraph = createTestRootGraph()
    onTestFinished(enableSubgraphNodeCreation(rootGraph))
    const exterior = createTestNode(rootGraph, [], ['number'])
    const first = createTestNode(rootGraph, ['number'])
    const second = createTestNode(rootGraph, ['number'])
    const firstLink = exterior.connect(0, first, 0)
    const secondLink = exterior.connect(0, second, 0)
    if (!firstLink || !secondLink) {
      throw new Error('Failed to connect fan-out test links')
    }
    firstLink.hidden = true
    firstLink.label = 'Shared'
    secondLink.hidden = true
    secondLink.label = 'Shared'

    rootGraph.convertToSubgraph(new Set<Positionable>([first, second]))

    const boundary = [...rootGraph.links.values()].find(
      (candidate) => candidate.origin_id === exterior.id
    )
    expect(boundary?.hidden).toBe(true)
    expect(boundary?.label).toBe('Shared')
  })

  it('keeps presentation when the input end is moved to another node', () => {
    const rootGraph = createTestRootGraph()
    const origin = createTestNode(rootGraph, [], ['number'])
    const target = createTestNode(rootGraph, ['number'])
    const other = createTestNode(rootGraph, ['number'])
    const link = origin.connect(0, target, 0)
    if (!link) throw new Error('Failed to connect moving test link')
    link.hidden = true
    link.label = 'Moved'

    const moving = new MovingInputLink(rootGraph, link)
    const events = new CustomEventTarget<LinkConnectorEventMap>()
    const newLink = moving.connectToInput(other, other.inputs[0], events)

    expect(newLink?.hidden).toBe(true)
    expect(newLink?.label).toBe('Moved')
  })

  it('keeps presentation when the output end is moved to another node', () => {
    const rootGraph = createTestRootGraph()
    const origin = createTestNode(rootGraph, [], ['number'])
    const other = createTestNode(rootGraph, [], ['number'])
    const target = createTestNode(rootGraph, ['number'])
    const link = origin.connect(0, target, 0)
    if (!link) throw new Error('Failed to connect moving test link')
    link.hidden = true
    link.label = 'Rehomed'

    const moving = new MovingOutputLink(rootGraph, link)
    const events = new CustomEventTarget<LinkConnectorEventMap>()
    const newLink = moving.connectToOutput(other, other.outputs[0], events)

    expect(newLink?.hidden).toBe(true)
    expect(newLink?.label).toBe('Rehomed')
  })
})
