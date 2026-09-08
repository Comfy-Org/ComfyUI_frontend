import { describe, expect, it, onTestFinished } from 'vitest'

import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { graphScopeOf } from '@/types/graphScopeId'
import type { LinkPresentation } from '@/types/linkPresentation'

import { createTestNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import { ToInputFromIoNodeLink } from '@/lib/litegraph/src/canvas/ToInputFromIoNodeLink'
import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'
import { MovingInputLink } from '@/lib/litegraph/src/canvas/MovingInputLink'
import { MovingOutputLink } from '@/lib/litegraph/src/canvas/MovingOutputLink'
import { LinkConnector } from '@/lib/litegraph/src/canvas/LinkConnector'
import { toRerouteId } from '@/types/rerouteId'
import { CustomEventTarget } from '@/lib/litegraph/src/infrastructure/CustomEventTarget'
import type { LinkConnectorEventMap } from '@/lib/litegraph/src/infrastructure/LinkConnectorEventMap'
import type { Positionable } from '@/lib/litegraph/src/litegraph'
import {
  createTestRootGraph,
  createTestSubgraph,
  enableSubgraphNodeCreation
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { createMockCanvasPointerEvent } from '@/utils/__tests__/litegraphTestUtils'

describe('link presentation transfer across recreation flows', () => {
  it('keeps interior presentation through a convert and unpack round-trip', () => {
    const rootGraph = createTestRootGraph()
    onTestFinished(enableSubgraphNodeCreation(rootGraph))
    const origin = createTestNode(rootGraph, [], ['number'])
    const target = createTestNode(rootGraph, ['number'])
    const link = origin.connect(0, target, 0)
    if (!link) throw new Error('Failed to connect interior test link')
    useLinkPresentationStore().patch(graphScopeOf(rootGraph), link.id, {
      hidden: true,
      label: 'Interior'
    })

    const { subgraph, node: subgraphNode } = rootGraph.convertToSubgraph(
      new Set<Positionable>([origin, target])
    )

    const interior = [...subgraph.links.values()].find(
      (candidate) =>
        candidate.origin_id !== SUBGRAPH_INPUT_ID &&
        candidate.target_id !== SUBGRAPH_OUTPUT_ID
    )
    if (!interior) throw new Error('Expected transferred link')
    expect(
      useLinkPresentationStore().getPresentation(
        graphScopeOf(subgraph),
        interior.id
      )
    ).toEqual({ hidden: true, label: 'Interior' })

    rootGraph.unpackSubgraph(subgraphNode)

    const [unpacked] = [...rootGraph.links.values()]
    expect(
      useLinkPresentationStore().getPresentation(
        graphScopeOf(rootGraph),
        unpacked.id
      )
    ).toEqual({ hidden: true, label: 'Interior' })
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
    useLinkPresentationStore().patch(graphScopeOf(rootGraph), boundary.id, {
      hidden: true,
      label: 'Boundary'
    })

    const { node: subgraphNode } = rootGraph.convertToSubgraph(
      new Set<Positionable>([origin, target])
    )

    const parentBoundary = [...rootGraph.links.values()].find(
      (candidate) => candidate.origin_id === exterior.id
    )
    if (!parentBoundary) throw new Error('Expected transferred link')
    expect(
      useLinkPresentationStore().getPresentation(
        graphScopeOf(rootGraph),
        parentBoundary.id
      )
    ).toEqual({ hidden: true, label: 'Boundary' })

    rootGraph.unpackSubgraph(subgraphNode)

    const merged = [...rootGraph.links.values()].find(
      (candidate) => candidate.origin_id === exterior.id
    )
    if (!merged) throw new Error('Expected transferred link')
    expect(
      useLinkPresentationStore().getPresentation(
        graphScopeOf(rootGraph),
        merged.id
      )
    ).toEqual({ hidden: true, label: 'Boundary' })
  })

  it.for<{
    name: string
    inner: LinkPresentation
    outer: LinkPresentation
    expected?: LinkPresentation
  }>([
    {
      name: 'hidden inner and visible outer segments',
      inner: { hidden: true, label: 'Shared' },
      outer: { label: 'Shared' }
    },
    {
      name: 'visible inner and hidden outer segments',
      inner: { label: 'Shared' },
      outer: { hidden: true, label: 'Shared' }
    },
    {
      name: 'different inner and outer labels',
      inner: { hidden: true, label: 'Inner' },
      outer: { hidden: true, label: 'Outer' }
    },
    {
      name: 'matching hidden segments',
      inner: { hidden: true, label: 'Shared' },
      outer: { hidden: true, label: 'Shared' },
      expected: { hidden: true, label: 'Shared' }
    },
    {
      name: 'matching empty labels',
      inner: { label: '' },
      outer: { label: '' },
      expected: { label: '' }
    },
    {
      name: 'matching default segments',
      inner: { hidden: false },
      outer: {}
    }
  ])(
    'unpacks boundary presentation with $name',
    ({ inner, outer, expected }) => {
      const rootGraph = createTestRootGraph()
      onTestFinished(enableSubgraphNodeCreation(rootGraph))
      const source = createTestNode(rootGraph, [], ['number'])
      const interior = createTestNode(rootGraph, ['number'], ['number'])
      const firstTarget = createTestNode(rootGraph, ['number'])
      const secondTarget = createTestNode(rootGraph, ['number'])
      source.connect(0, interior, 0)
      interior.connect(0, firstTarget, 0)
      interior.connect(0, secondTarget, 0)
      const { subgraph, node: host } = rootGraph.convertToSubgraph(
        new Set<Positionable>([interior])
      )
      const store = useLinkPresentationStore()
      const scope = graphScopeOf(rootGraph)
      for (const link of subgraph.links.values()) {
        store.patch(graphScopeOf(subgraph), link.id, inner)
      }
      for (const link of rootGraph.links.values()) {
        store.patch(scope, link.id, outer)
      }

      rootGraph.unpackSubgraph(host)

      expect([...rootGraph.links.values()]).toHaveLength(3)
      for (const link of rootGraph.links.values()) {
        expect(store.getPresentation(scope, link.id)).toEqual(expected)
      }
    }
  )

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
    useLinkPresentationStore().patch(graphScopeOf(subgraph), boundary.id, {
      hidden: true,
      label: 'Boundary'
    })
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
    if (!retargeted) throw new Error('Expected transferred link')
    expect(
      useLinkPresentationStore().getPresentation(
        graphScopeOf(subgraph),
        retargeted.id
      )
    ).toEqual({ hidden: true, label: 'Boundary' })
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
    useLinkPresentationStore().patch(graphScopeOf(rootGraph), hiddenLink.id, {
      hidden: true
    })

    rootGraph.convertToSubgraph(new Set<Positionable>([first, second]))

    const boundary = [...rootGraph.links.values()].find(
      (candidate) => candidate.origin_id === exterior.id
    )
    if (!boundary) throw new Error('Expected merged boundary link')
    expect(
      useLinkPresentationStore().getPresentation(
        graphScopeOf(rootGraph),
        boundary.id
      )
    ).toBeUndefined()
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
    useLinkPresentationStore().patch(graphScopeOf(rootGraph), firstLink.id, {
      hidden: true,
      label: 'Shared'
    })
    useLinkPresentationStore().patch(graphScopeOf(rootGraph), secondLink.id, {
      hidden: true,
      label: 'Shared'
    })

    const { node: host } = rootGraph.convertToSubgraph(
      new Set<Positionable>([first, second])
    )

    const boundary = [...rootGraph.links.values()].find(
      (candidate) => candidate.origin_id === exterior.id
    )
    if (!boundary) throw new Error('Expected transferred link')
    expect(
      useLinkPresentationStore().getPresentation(
        graphScopeOf(rootGraph),
        boundary.id
      )
    ).toEqual({ hidden: true, label: 'Shared' })

    rootGraph.unpackSubgraph(host)

    expect([...rootGraph.links.values()]).toHaveLength(2)
    for (const link of rootGraph.links.values()) {
      expect(
        useLinkPresentationStore().getPresentation(
          graphScopeOf(rootGraph),
          link.id
        )
      ).toEqual({ hidden: true, label: 'Shared' })
    }
  })

  it.for<{
    name: string
    first: LinkPresentation
    second: LinkPresentation
    expected?: LinkPresentation
  }>([
    {
      name: 'different visibility',
      first: { hidden: true, label: 'Shared' },
      second: { label: 'Shared' }
    },
    {
      name: 'different labels',
      first: { hidden: true, label: 'First' },
      second: { hidden: true, label: 'Second' }
    },
    {
      name: 'matching presentation',
      first: { hidden: true, label: 'Shared' },
      second: { hidden: true, label: 'Shared' },
      expected: { hidden: true, label: 'Shared' }
    }
  ])(
    'merges output fan-out presentation with $name',
    ({ first, second, expected }) => {
      const root = createTestRootGraph()
      onTestFinished(enableSubgraphNodeCreation(root))
      const source = createTestNode(root, [], ['number'])
      const firstTarget = createTestNode(root, ['number'])
      const secondTarget = createTestNode(root, ['number'])
      const firstLink = source.connect(0, firstTarget, 0)
      const secondLink = source.connect(0, secondTarget, 0)
      if (!firstLink || !secondLink) throw new Error('Expected outgoing links')
      const store = useLinkPresentationStore()
      const scope = graphScopeOf(root)
      store.patch(scope, firstLink.id, first)
      store.patch(scope, secondLink.id, second)

      const { subgraph } = root.convertToSubgraph(new Set([source]))

      const boundaryLinks = subgraph.outputs[0].getLinks()
      expect(boundaryLinks).toHaveLength(1)
      expect(
        store.getPresentation(graphScopeOf(subgraph), boundaryLinks[0].id)
      ).toEqual(expected)
      for (const [target, presentation] of [
        [firstTarget, first],
        [secondTarget, second]
      ] as const) {
        const link = target.getInputLink(0)
        if (!link) throw new Error('Expected external link')
        expect(store.getPresentation(scope, link.id)).toEqual(presentation)
      }
    }
  )

  it.for(['node', 'onto reroute', 'from reroute', 'new link'] as const)(
    'transfers output boundary presentation for $0',
    (path) => {
      const subgraph = createTestSubgraph({
        outputs: [{ name: 'result', type: 'number' }]
      })
      const source = createTestNode(subgraph, [], ['number'])
      const replacement = createTestNode(subgraph, [], ['number'])
      const output = subgraph.outputs[0]
      const boundary = output.connect(source.outputs[0], source)
      if (!boundary) throw new Error('Expected output boundary link')
      const store = useLinkPresentationStore()
      const scope = graphScopeOf(subgraph)
      const presentation = { hidden: true, label: 'Moved output' }
      store.patch(scope, boundary.id, presentation)
      const connector = new LinkConnector(() => {})
      onTestFinished(() => connector.reset(true))
      const event = createMockCanvasPointerEvent(100, 100)

      if (path === 'from reroute') {
        const reroute = subgraph.setReroute({
          id: toRerouteId(1),
          pos: [100, 100],
          linkIds: [boundary.id]
        })
        if (!reroute) throw new Error('Expected source reroute')
        boundary.parentId = reroute.id
        connector.dragFromRerouteToOutput(subgraph, reroute)
      } else if (path === 'new link') {
        connector.dragNewFromSubgraphOutput(
          subgraph,
          subgraph.outputNode,
          output
        )
      } else {
        connector.moveOutputLink(subgraph, source, source.outputs[0])
      }

      if (path === 'onto reroute') {
        const target = createTestNode(subgraph, ['number'])
        const link = replacement.connect(0, target, 0)
        if (!link) throw new Error('Expected replacement link')
        const reroute = subgraph.setReroute({
          id: toRerouteId(1),
          pos: [100, 100],
          linkIds: [link.id]
        })
        if (!reroute) throw new Error('Expected target reroute')
        link.parentId = reroute.id
        connector.dropOnReroute(reroute, event)
      } else {
        connector.connectToNode(replacement, event)
      }

      const moved = output.getLinks()[0]
      expect(moved.origin_id).toBe(replacement.id)
      expect(moved.id).not.toBe(boundary.id)
      expect(store.getPresentation(scope, moved.id)).toEqual(
        path === 'new link' ? undefined : presentation
      )
      expect(store.getPresentation(scope, boundary.id)).toBeUndefined()
    }
  )

  it('preserves a subgraph input presentation across a nested conversion', () => {
    const root = createTestRootGraph()
    onTestFinished(enableSubgraphNodeCreation(root))
    const exterior = createTestNode(root, [], ['number'])
    const first = createTestNode(root, ['number'], ['number'])
    const second = createTestNode(root, ['number'])
    exterior.connect(0, first, 0)
    first.connect(0, second, 0)
    const { subgraph } = root.convertToSubgraph(
      new Set<Positionable>([first, second])
    )
    const boundary = [...subgraph.links.values()].find(
      (link) => link.origin_id === SUBGRAPH_INPUT_ID
    )
    if (!boundary) throw new Error('Expected subgraph input link')
    const store = useLinkPresentationStore()
    const scope = graphScopeOf(subgraph)
    store.patch(scope, boundary.id, { hidden: true, label: 'Nested' })

    const { node: host } = subgraph.convertToSubgraph(new Set(subgraph.nodes))

    const replacement = [...subgraph.links.values()].find(
      (link) =>
        link.origin_id === SUBGRAPH_INPUT_ID && link.target_id === host.id
    )
    if (!replacement) throw new Error('Expected nested boundary link')
    expect(store.getPresentation(scope, replacement.id)).toEqual({
      hidden: true,
      label: 'Nested'
    })
  })

  it('keeps presentation when the input end is moved to another node', () => {
    const rootGraph = createTestRootGraph()
    const origin = createTestNode(rootGraph, [], ['number'])
    const target = createTestNode(rootGraph, ['number'])
    const other = createTestNode(rootGraph, ['number'])
    const link = origin.connect(0, target, 0)
    if (!link) throw new Error('Failed to connect moving test link')
    useLinkPresentationStore().patch(graphScopeOf(rootGraph), link.id, {
      hidden: true,
      label: 'Moved'
    })

    const moving = new MovingInputLink(rootGraph, link)
    const events = new CustomEventTarget<LinkConnectorEventMap>()
    const newLink = moving.connectToInput(other, other.inputs[0], events)

    if (!newLink) throw new Error('Expected transferred link')
    expect(
      useLinkPresentationStore().getPresentation(
        graphScopeOf(rootGraph),
        newLink.id
      )
    ).toEqual({ hidden: true, label: 'Moved' })
  })

  it('carries presentation to every target when an input drag fans out through a reroute', () => {
    const graph = createTestRootGraph()
    const origin = createTestNode(graph, [], ['number'])
    const oldTarget = createTestNode(graph, ['number'])
    const otherOrigin = createTestNode(graph, [], ['number'])
    const first = createTestNode(graph, ['number'])
    const second = createTestNode(graph, ['number'])
    const original = origin.connect(0, oldTarget, 0)
    const firstLink = otherOrigin.connect(0, first, 0)
    const secondLink = otherOrigin.connect(0, second, 0)
    if (!original || !firstLink || !secondLink)
      throw new Error('Expected connected test links')
    const reroute = graph.setReroute({
      id: toRerouteId(1),
      pos: [100, 100],
      linkIds: [firstLink.id, secondLink.id]
    })
    if (!reroute) throw new Error('Expected test reroute')
    firstLink.parentId = reroute.id
    secondLink.parentId = reroute.id
    const store = useLinkPresentationStore()
    const scope = graphScopeOf(graph)
    store.patch(scope, original.id, { hidden: true, label: 'Fan out' })
    const connector = new LinkConnector(() => {})
    onTestFinished(() => connector.reset(true))

    connector.moveInputLink(graph, oldTarget, oldTarget.inputs[0])
    connector.dropOnReroute(reroute, createMockCanvasPointerEvent(100, 100))

    for (const target of [first, second]) {
      const link = target.getInputLink(0)
      if (!link) throw new Error('Expected retargeted link')
      expect(link.origin_id).toBe(origin.id)
      expect(store.getPresentation(scope, link.id)).toEqual({
        hidden: true,
        label: 'Fan out'
      })
    }
    expect(store.getPresentation(scope, original.id)).toBeUndefined()
  })

  it('preserves each ordinary reroute presentation when moving its source', () => {
    const graph = createTestRootGraph()
    const source = createTestNode(graph, [], ['number'])
    const replacement = createTestNode(graph, [], ['number'])
    const first = createTestNode(graph, ['number'])
    const second = createTestNode(graph, ['number'])
    const firstLink = source.connect(0, first, 0)
    const secondLink = source.connect(0, second, 0)
    if (!firstLink || !secondLink) throw new Error('Expected initial links')
    const scope = graphScopeOf(graph)
    const store = useLinkPresentationStore()
    const reroute = graph.setReroute({
      id: toRerouteId(1),
      pos: [100, 100],
      linkIds: [firstLink.id, secondLink.id]
    })
    if (!reroute) throw new Error('Expected reroute')
    firstLink.parentId = reroute.id
    secondLink.parentId = reroute.id
    store.patch(scope, firstLink.id, { hidden: true, label: 'First' })
    store.patch(scope, secondLink.id, { label: 'Second' })
    const connector = new LinkConnector(() => {})
    onTestFinished(() => connector.reset(true))

    connector.dragFromRerouteToOutput(graph, reroute)
    connector.connectToNode(replacement, createMockCanvasPointerEvent(0, 0))

    for (const [target, oldLink, presentation] of [
      [first, firstLink, { hidden: true, label: 'First' }],
      [second, secondLink, { label: 'Second' }]
    ] as const) {
      const moved = target.getInputLink(0)
      if (!moved) throw new Error('Expected moved link')
      expect(moved.origin_id).toBe(replacement.id)
      expect(moved.id).not.toBe(oldLink.id)
      expect(store.getPresentation(scope, moved.id)).toEqual(presentation)
      expect(store.getPresentation(scope, oldLink.id)).toBeUndefined()
    }
  })

  it('keeps presentation when the output end is moved to another node', () => {
    const rootGraph = createTestRootGraph()
    const origin = createTestNode(rootGraph, [], ['number'])
    const other = createTestNode(rootGraph, [], ['number'])
    const target = createTestNode(rootGraph, ['number'])
    const link = origin.connect(0, target, 0)
    if (!link) throw new Error('Failed to connect moving test link')
    useLinkPresentationStore().patch(graphScopeOf(rootGraph), link.id, {
      hidden: true,
      label: 'Rehomed'
    })

    const moving = new MovingOutputLink(rootGraph, link)
    const events = new CustomEventTarget<LinkConnectorEventMap>()
    const newLink = moving.connectToOutput(other, other.outputs[0], events)

    if (!newLink) throw new Error('Expected transferred link')
    expect(
      useLinkPresentationStore().getPresentation(
        graphScopeOf(rootGraph),
        newLink.id
      )
    ).toEqual({ hidden: true, label: 'Rehomed' })
  })
})
