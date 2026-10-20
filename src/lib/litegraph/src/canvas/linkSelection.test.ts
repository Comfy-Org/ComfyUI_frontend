import { describe, expect, it, vi } from 'vitest'

import { createTestNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import { LGraph } from '@/lib/litegraph/src/LGraph'
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
  getSelectedLinkIds,
  getSelectedLinksAnchor,
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
