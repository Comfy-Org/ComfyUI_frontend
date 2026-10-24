import { describe, expect, it, vi } from 'vitest'

import { createTestNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import { SUBGRAPH_INPUT_ID } from '@/lib/litegraph/src/constants'
import { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LLink } from '@/lib/litegraph/src/LLink'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { LinkSegment, ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import { LinkRenderType } from '@/lib/litegraph/src/types/globalEnums'
import { setLinkPolyline } from '@/renderer/core/canvas/linkPolylines'
import type { Point } from '@/renderer/core/layout/types'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { graphScopeOf } from '@/types/graphScopeId'
import type { LinkId } from '@/types/linkId'

import {
  areSelectedLinksHidden,
  deleteSelectedLinks,
  getSelectedLinkDestinations,
  getSelectedLinkIds,
  getSelectedLinksAnchor,
  goToLinkDestination,
  hideSelectedLinks,
  selectLinksInMarquee,
  selectSlotLinks,
  showSelectedLinks
} from './linkSelection'

const ACROSS_BOTH_LINKS: ReadOnlyRect = [40, 0, 20, 40]

function createGraphWithLinks() {
  const graph = new LGraph()
  const source = createTestNode(graph, [], ['number'])
  const links = [0, 1].map(() => {
    const target = createTestNode(graph, ['number'])
    const link = source.connect(0, target, 0)
    if (!link) throw new Error('connect failed')
    return link
  })
  return { graph, links }
}

function drawPolyline(segment: LinkSegment, points: Point[]) {
  setLinkPolyline(segment, () => points)
}

function drawHorizontalLink(segment: LinkSegment, y: number) {
  drawPolyline(segment, [
    { x: 0, y },
    { x: 100, y }
  ])
}

function selectLinks(
  graph: LGraph,
  renderedPaths: Iterable<LinkSegment>,
  rect: ReadOnlyRect = ACROSS_BOTH_LINKS,
  anchorX = 60
) {
  selectLinksInMarquee({ graph, renderedPaths }, rect, anchorX)
}

function createHost(graph: LGraph, events: string[] = []) {
  return {
    graph,
    emitBeforeChange: vi.fn(() => events.push('before')),
    emitAfterChange: vi.fn(() => events.push('after')),
    setDirty: vi.fn()
  }
}

describe('link marquee selection', () => {
  it('selects the links drawn under the marquee', () => {
    const { graph, links } = createGraphWithLinks()
    drawHorizontalLink(links[0], 10)
    drawHorizontalLink(links[1], 20)

    selectLinks(graph, links)

    expect(getSelectedLinkIds(graph)).toEqual(links.map((link) => link.id))
  })

  it('selects the link behind a reroute segment drawn under the marquee', () => {
    const { graph, links } = createGraphWithLinks()
    const reroute = graph.createReroute([50, 10], links[0])
    if (!reroute) throw new Error('createReroute failed')
    drawHorizontalLink(reroute, 10)

    selectLinks(graph, [reroute])

    expect(getSelectedLinkIds(graph)).toEqual([links[0].id])
  })

  it.for([
    { name: 'the upper link at the release x', canvasX: 55, expected: 40 },
    { name: 'the sloped link where it is higher', canvasX: 10, expected: 10 }
  ])('anchors the menu above $name', ({ canvasX, expected }) => {
    const { graph, links } = createGraphWithLinks()
    drawHorizontalLink(links[0], 40)
    drawPolyline(links[1], [
      { x: 0, y: 0 },
      { x: 100, y: 100 }
    ])

    selectLinks(graph, links, [0, 0, 100, 50], canvasX)

    expect(getSelectedLinksAnchor(graph)).toEqual({ x: canvasX, y: expected })
  })

  it('ignores links that were not drawn in the last frame', () => {
    const { graph, links } = createGraphWithLinks()
    drawHorizontalLink(links[0], 10)
    drawHorizontalLink(links[1], 20)

    selectLinks(graph, [links[1]])

    expect(getSelectedLinkIds(graph)).toEqual([links[1].id])
  })

  it.for([
    {
      name: 'hidden',
      act: (graph: LGraph, linkId: LinkId) =>
        useLinkPresentationStore().patch(graphScopeOf(graph), linkId, {
          hidden: true
        })
    },
    {
      name: 'removed',
      act: (graph: LGraph, linkId: LinkId) => graph.removeLink(linkId)
    },
    {
      name: 'replaced by a reload',
      act: (graph: LGraph) => graph.configure(graph.serialize())
    }
  ])('drops a selected link once it is $name', ({ act }) => {
    const { graph, links } = createGraphWithLinks()
    drawHorizontalLink(links[0], 10)
    selectLinks(graph, [links[0]])

    act(graph, links[0].id)

    expect(getSelectedLinkIds(graph)).toEqual([])
  })

  it('skips hidden links', () => {
    const { graph, links } = createGraphWithLinks()
    drawHorizontalLink(links[0], 10)
    drawHorizontalLink(links[1], 20)
    useLinkPresentationStore().patch(graphScopeOf(graph), links[1].id, {
      hidden: true
    })

    selectLinks(graph, links)

    expect(getSelectedLinkIds(graph)).toEqual([links[0].id])
  })

  it('hides every selected link in one change and clears the selection', () => {
    const { graph, links } = createGraphWithLinks()
    drawHorizontalLink(links[0], 10)
    drawHorizontalLink(links[1], 20)
    selectLinks(graph, links)
    const events: string[] = []

    expect(hideSelectedLinks(createHost(graph, events))).toBe(true)

    const presentation = useLinkPresentationStore()
    expect(
      links.map(
        (link) =>
          presentation.getPresentation(graphScopeOf(graph), link.id)?.hidden
      )
    ).toEqual([true, true])
    expect(events).toEqual(['before', 'after'])
    expect(getSelectedLinkIds(graph)).toEqual([])
  })

  it('deletes every selected link in one change and clears the selection', () => {
    const { graph, links } = createGraphWithLinks()
    drawHorizontalLink(links[0], 10)
    drawHorizontalLink(links[1], 20)
    selectLinks(graph, links)
    const events: string[] = []

    expect(deleteSelectedLinks(createHost(graph, events))).toBe(true)

    expect(links.map((link) => graph.getLink(link.id))).toEqual([
      undefined,
      undefined
    ])
    expect(events).toEqual(['before', 'after'])
    expect(getSelectedLinkIds(graph)).toEqual([])
  })

  it('disconnects a deleted link from its subgraph output slot', () => {
    const subgraph = createTestSubgraph({
      outputs: [{ name: 'value', type: 'number' }]
    })
    const origin = createTestNode(subgraph, [], ['number'])
    const outputSlot = subgraph.outputNode.slots[0]
    const link = outputSlot.connect(origin.outputs[0], origin)
    if (!link) throw new Error('connect failed')
    drawHorizontalLink(link, 10)
    selectLinks(subgraph, [link])

    deleteSelectedLinks(createHost(subgraph))

    expect(subgraph.getLink(link.id)).toBeUndefined()
    expect(outputSlot.linkIds).toEqual([])
  })

  it('does nothing without a link selection', () => {
    const { graph } = createGraphWithLinks()
    const host = createHost(graph)

    expect(deleteSelectedLinks(host)).toBe(false)
    expect(hideSelectedLinks(host)).toBe(false)
    expect(host.emitBeforeChange).not.toHaveBeenCalled()
  })
})

describe('slot link selection', () => {
  function slotHost(
    graph: LGraph,
    links_render_mode: number = LinkRenderType.SPLINE_LINK
  ) {
    return { graph, links_render_mode, deselectAll: vi.fn() }
  }

  function hide(graph: LGraph, links: LLink[]) {
    for (const link of links)
      useLinkPresentationStore().patch(graphScopeOf(graph), link.id, {
        hidden: true
      })
  }

  function selectSourceOutput(graph: LGraph) {
    const host = slotHost(graph)
    const source = graph.nodes[0]
    return {
      host,
      selected: selectSlotLinks(host, source, 'output', 0, { x: 0, y: 0 })
    }
  }

  it('selects every link of an output, hidden ones included', () => {
    const { graph, links } = createGraphWithLinks()
    hide(graph, [links[1]])

    const { host, selected } = selectSourceOutput(graph)

    expect(selected).toBe(true)
    expect(host.deselectAll).toHaveBeenCalledOnce()
    expect(getSelectedLinkIds(graph)).toEqual(links.map((link) => link.id))
  })

  it('anchors the toolbox at the slot when no selected link is drawn', () => {
    const { graph } = createGraphWithLinks()
    const host = slotHost(graph)

    selectSlotLinks(host, graph.nodes[0], 'output', 0, { x: 30, y: 40 })

    expect(getSelectedLinksAnchor(graph)).toEqual({ x: 30, y: 40 })
  })

  it('anchors the toolbox at the slot when every selected link is hidden', () => {
    const { graph, links } = createGraphWithLinks()
    for (const [index, link] of links.entries()) drawHorizontalLink(link, index)
    hide(graph, links)
    const host = slotHost(graph)

    selectSlotLinks(host, graph.nodes[0], 'output', 0, { x: 30, y: 40 })

    expect(getSelectedLinksAnchor(graph)).toEqual({ x: 30, y: 40 })
  })

  it('anchors a slot selection at the slot, ignoring drawn links', () => {
    const { graph, links } = createGraphWithLinks()
    drawHorizontalLink(links[0], 5)
    drawHorizontalLink(links[1], 50)
    hide(graph, [links[0]])
    const host = slotHost(graph)

    selectSlotLinks(host, graph.nodes[0], 'output', 0, { x: 30, y: 40 })

    expect(getSelectedLinksAnchor(graph)).toEqual({ x: 30, y: 40 })
  })

  it('selects the one link of an input', () => {
    const { graph, links } = createGraphWithLinks()
    const host = slotHost(graph)

    selectSlotLinks(host, graph.nodes[2], 'input', 0, { x: 0, y: 0 })

    expect(getSelectedLinkIds(graph)).toEqual([links[1].id])
  })

  it('ignores a node from another graph', () => {
    const { graph } = createGraphWithLinks()
    const other = createGraphWithLinks().graph
    const host = slotHost(other)

    expect(
      selectSlotLinks(host, graph.nodes[0], 'output', 0, { x: 0, y: 0 })
    ).toBe(false)
    expect(host.deselectAll).not.toHaveBeenCalled()
  })

  it('does nothing for a slot without links', () => {
    const graph = new LGraph()
    const node = createTestNode(graph, [], ['number'])
    const host = slotHost(graph)

    expect(selectSlotLinks(host, node, 'output', 0, { x: 0, y: 0 })).toBe(false)
    expect(host.deselectAll).not.toHaveBeenCalled()
    expect(getSelectedLinkIds(graph)).toEqual([])
  })

  it('does nothing while links are hidden on the whole canvas', () => {
    const { graph } = createGraphWithLinks()
    const host = slotHost(graph, LinkRenderType.HIDDEN_LINK)

    expect(
      selectSlotLinks(host, graph.nodes[0], 'output', 0, { x: 0, y: 0 })
    ).toBe(false)
    expect(host.deselectAll).not.toHaveBeenCalled()
    expect(getSelectedLinkIds(graph)).toEqual([])
  })

  it.for([
    { name: 'none hidden', hidden: [], expected: false },
    { name: 'some hidden', hidden: [0], expected: false },
    { name: 'all hidden', hidden: [0, 1], expected: true }
  ])(
    'reports hidden only when all are hidden: $name',
    ({ hidden, expected }) => {
      const { graph, links } = createGraphWithLinks()
      hide(
        graph,
        hidden.map((index) => links[index])
      )
      selectSourceOutput(graph)

      expect(areSelectedLinksHidden(graph)).toBe(expected)
    }
  )

  it('hiding a partly hidden selection hides the rest', () => {
    const { graph, links } = createGraphWithLinks()
    hide(graph, [links[0]])
    selectSourceOutput(graph)

    hideSelectedLinks(createHost(graph))

    const presentation = useLinkPresentationStore()
    expect(
      links.map(
        (link) =>
          presentation.getPresentation(graphScopeOf(graph), link.id)?.hidden
      )
    ).toEqual([true, true])
  })

  it.for([
    {
      name: 'Show with every link visible',
      hidden: [],
      act: showSelectedLinks
    },
    {
      name: 'Hide with every link hidden',
      hidden: [0, 1],
      act: hideSelectedLinks
    }
  ])('$name changes nothing and keeps the selection', ({ hidden, act }) => {
    const { graph, links } = createGraphWithLinks()
    hide(
      graph,
      hidden.map((index) => links[index])
    )
    selectSourceOutput(graph)
    const events: string[] = []

    expect(act(createHost(graph, events))).toBe(false)

    expect(events).toEqual([])
    expect(getSelectedLinkIds(graph)).toEqual(links.map((link) => link.id))
  })

  it('shows every selected link in one change and clears the selection', () => {
    const { graph, links } = createGraphWithLinks()
    hide(graph, links)
    selectSourceOutput(graph)
    const events: string[] = []

    expect(showSelectedLinks(createHost(graph, events))).toBe(true)

    expect(areSelectedLinksHidden(graph)).toBe(false)
    expect(
      links.map((link) =>
        useLinkPresentationStore().getPresentation(graphScopeOf(graph), link.id)
      )
    ).toEqual([undefined, undefined])
    expect(events).toEqual(['before', 'after'])
    expect(getSelectedLinkIds(graph)).toEqual([])
  })
})

describe('going to the other end of a socket', () => {
  const VIEWPORT: ReadOnlyRect = [0, 0, 800, 600]

  function place(node: LGraphNode, x: number, y: number): LGraphNode {
    node.pos = [x, y]
    node.updateArea()
    return node
  }

  function connect(source: LGraphNode, target: LGraphNode, slot = 0): LLink {
    const link = source.connect(0, target, slot)
    if (!link) throw new Error('connect failed')
    return link
  }

  function createFanOut() {
    const graph = new LGraph()
    const source = place(createTestNode(graph, [], ['number']), 0, 300)
    const targets = [600, 100, 350].map((y) =>
      place(createTestNode(graph, ['number']), 400, y)
    )
    const links = targets.map((target) => connect(source, target))
    return { graph, source, targets, links }
  }

  function clickSocket(
    graph: LGraph,
    node: LGraphNode,
    type: 'input' | 'output'
  ) {
    const host = {
      graph,
      links_render_mode: LinkRenderType.SPLINE_LINK,
      deselectAll: vi.fn()
    }
    selectSlotLinks(host, node, type, 0, { x: 0, y: 0 })
  }

  function goTo(
    graph: LGraph,
    node: { id: LGraphNode['id'] },
    reducedMotion = false
  ) {
    const host = {
      graph,
      ds: { fitToBounds: vi.fn() },
      animateToBounds: vi.fn(),
      setDirty: vi.fn()
    }
    const moved = goToLinkDestination(host, node.id, {
      viewport: VIEWPORT,
      reducedMotion
    })
    return { host, moved }
  }

  function destinationIds(graph: LGraph) {
    return getSelectedLinkDestinations(graph).map(({ nodeId }) => nodeId)
  }

  it('leads from an input socket to its source node', () => {
    const { graph, source, targets } = createFanOut()
    clickSocket(graph, targets[1], 'input')

    expect(destinationIds(graph)).toEqual([source.id])
    const { host, moved } = goTo(graph, source)

    expect(moved).toBe(true)
    expect(host.animateToBounds).toHaveBeenCalledWith(source.boundingRect, {
      zoom: 0,
      viewport: VIEWPORT
    })
  })

  it('lists the nodes an output socket leads to, top to bottom', () => {
    const { graph, source, targets } = createFanOut()

    clickSocket(graph, source, 'output')

    expect(destinationIds(graph)).toEqual(
      [targets[1], targets[2], targets[0]].map(({ id }) => id)
    )
  })

  it('selects the link of the input it lands on, anchored there', () => {
    const { graph, source, targets, links } = createFanOut()
    clickSocket(graph, source, 'output')

    goTo(graph, targets[2])

    const [x, y] = targets[2].getInputPos(0)
    expect(getSelectedLinkIds(graph)).toEqual([links[2].id])
    expect(getSelectedLinksAnchor(graph)).toEqual({ x, y })
  })

  it('leads back to the output with every linked node on offer', () => {
    const { graph, source, targets, links } = createFanOut()
    clickSocket(graph, source, 'output')
    goTo(graph, targets[2])

    expect(destinationIds(graph)).toEqual([source.id])
    const { host } = goTo(graph, source)

    const [x, y] = source.getOutputPos(0)
    expect(host.animateToBounds).toHaveBeenCalledWith(
      source.boundingRect,
      expect.anything()
    )
    expect(getSelectedLinkIds(graph)).toEqual(links.map(({ id }) => id))
    expect(getSelectedLinksAnchor(graph)).toEqual({ x, y })
    expect(destinationIds(graph)).toEqual(
      [targets[1], targets[2], targets[0]].map(({ id }) => id)
    )
    expect(goTo(graph, targets[0]).moved).toBe(true)
  })

  it('lands on the node behind a reroute', () => {
    const { graph, source, targets, links } = createFanOut()
    graph.createReroute([200, 300], links[0])

    clickSocket(graph, targets[0], 'input')

    expect(destinationIds(graph)).toEqual([source.id])
  })

  it('follows a hidden link and leaves it hidden', () => {
    const { graph, source, targets, links } = createFanOut()
    const presentation = useLinkPresentationStore()
    presentation.patch(graphScopeOf(graph), links[0].id, { hidden: true })
    clickSocket(graph, source, 'output')

    expect(goTo(graph, targets[0]).moved).toBe(true)

    expect(getSelectedLinkIds(graph)).toEqual([links[0].id])
    expect(
      presentation.getPresentation(graphScopeOf(graph), links[0].id)?.hidden
    ).toBe(true)
  })

  it('offers no destination for a marquee selection', () => {
    const { graph, links } = createGraphWithLinks()
    drawHorizontalLink(links[0], 10)
    drawHorizontalLink(links[1], 20)
    selectLinks(graph, links)

    expect(getSelectedLinkDestinations(graph)).toEqual([])
    expect(goTo(graph, graph.nodes[1]).moved).toBe(false)
    expect(getSelectedLinkIds(graph)).toEqual(links.map((link) => link.id))
  })

  it('goes nowhere for a node that is not at the other end', () => {
    const { graph, source, targets } = createFanOut()
    clickSocket(graph, targets[0], 'input')

    expect(goTo(graph, targets[1]).moved).toBe(false)
    expect(destinationIds(graph)).toEqual([source.id])
  })

  it('makes one destination of several links into the same node', () => {
    const graph = new LGraph()
    const source = createTestNode(graph, [], ['number'])
    const target = createTestNode(graph, ['number', 'number'])
    connect(source, target, 0)
    connect(source, target, 1)

    clickSocket(graph, source, 'output')

    expect(
      getSelectedLinkDestinations(graph).map(({ nodeId, links }) => [
        nodeId,
        links.length
      ])
    ).toEqual([[target.id, 2]])
  })

  it('leads from a node inside a subgraph to the subgraph inputs and back', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'number' }]
    })
    const target = createTestNode(subgraph, ['number'])
    subgraph.inputNode.slots[0].connect(target.inputs[0], target)
    clickSocket(subgraph, target, 'input')

    expect(
      getSelectedLinkDestinations(subgraph).map(({ kind }) => kind)
    ).toEqual(['subgraphInputs'])
    const { host } = goTo(subgraph, { id: SUBGRAPH_INPUT_ID })

    expect(host.animateToBounds).toHaveBeenCalledWith(
      subgraph.inputNode.boundingRect,
      expect.anything()
    )
    expect(destinationIds(subgraph)).toEqual([target.id])
  })

  it.for([
    { name: 'animates the pan', reducedMotion: false, animated: 1, instant: 0 },
    {
      name: 'moves in one step when motion is reduced',
      reducedMotion: true,
      animated: 0,
      instant: 1
    }
  ])('$name', ({ reducedMotion, animated, instant }) => {
    const { graph, source, targets } = createFanOut()
    clickSocket(graph, targets[0], 'input')

    const { host } = goTo(graph, source, reducedMotion)

    expect(host.animateToBounds).toHaveBeenCalledTimes(animated)
    expect(host.ds.fitToBounds).toHaveBeenCalledTimes(instant)
    expect(host.setDirty).toHaveBeenCalledTimes(instant)
  })
})
