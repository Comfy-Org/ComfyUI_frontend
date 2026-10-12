import { describe, expect, it, vi } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/LGraph'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { LLink } from '@/lib/litegraph/src/LLink'
import { setLinkPolyline } from '@/renderer/core/canvas/linkPolylines'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { graphScopeOf } from '@/types/graphScopeId'

import {
  deleteSelectedLinks,
  getSelectedLinkBounds,
  getSelectedLinkIds,
  hideSelectedLinks,
  selectLinksForMarquee
} from './linkSelection'

const NO_MODIFIERS = { shiftKey: false, altKey: false }

function createGraphWithLinks() {
  const graph = new LGraph()
  const source = new LGraphNode('source')
  source.addOutput('value', 'number')
  graph.add(source)
  const links = [0, 1].map((index) => {
    const target = new LGraphNode(`target-${index}`)
    target.addInput('value', 'number')
    graph.add(target)
    const link = source.connect(0, target, 0)
    if (!link) throw new Error('connect failed')
    return link
  })
  return { graph, links }
}

function drawHorizontalLink(link: LLink, y: number) {
  setLinkPolyline(link, [
    { x: 0, y },
    { x: 100, y }
  ])
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
  it.for([
    {
      name: 'selects the links under an empty marquee',
      captured: 0,
      modifiers: NO_MODIFIERS,
      expected: [0, 1]
    },
    {
      name: 'ignores links when the marquee captured items',
      captured: 1,
      modifiers: NO_MODIFIERS,
      expected: []
    },
    {
      name: 'ignores links on a shift marquee',
      captured: 0,
      modifiers: { shiftKey: true, altKey: false },
      expected: []
    }
  ])('$name', ({ captured, modifiers, expected }) => {
    const { graph, links } = createGraphWithLinks()
    drawHorizontalLink(links[0], 10)
    drawHorizontalLink(links[1], 20)

    selectLinksForMarquee(graph, captured, [40, 0, 20, 40], modifiers)

    expect(getSelectedLinkIds(graph)).toEqual(
      expected.map((index) => links[index].id)
    )
  })

  it('reports the drawn bounds of the selected links', () => {
    const { graph, links } = createGraphWithLinks()
    drawHorizontalLink(links[0], 10)
    drawHorizontalLink(links[1], 20)

    selectLinksForMarquee(graph, 0, [40, 0, 20, 15], NO_MODIFIERS)

    expect(getSelectedLinkBounds(graph)).toEqual([[0, 10, 100, 0]])
  })

  it('skips hidden links', () => {
    const { graph, links } = createGraphWithLinks()
    drawHorizontalLink(links[0], 10)
    drawHorizontalLink(links[1], 20)
    useLinkPresentationStore().patch(graphScopeOf(graph), links[1].id, {
      hidden: true
    })

    selectLinksForMarquee(graph, 0, [40, 0, 20, 40], NO_MODIFIERS)

    expect(getSelectedLinkIds(graph)).toEqual([links[0].id])
  })

  it('hides every selected link in one change and clears the selection', () => {
    const { graph, links } = createGraphWithLinks()
    drawHorizontalLink(links[0], 10)
    drawHorizontalLink(links[1], 20)
    selectLinksForMarquee(graph, 0, [40, 0, 20, 40], NO_MODIFIERS)
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
    selectLinksForMarquee(graph, 0, [40, 0, 20, 40], NO_MODIFIERS)
    const events: string[] = []

    expect(deleteSelectedLinks(createHost(graph, events))).toBe(true)

    expect(links.map((link) => graph.getLink(link.id))).toEqual([
      undefined,
      undefined
    ])
    expect(events).toEqual(['before', 'after'])
    expect(getSelectedLinkIds(graph)).toEqual([])
  })

  it('does nothing without a link selection', () => {
    const { graph } = createGraphWithLinks()
    const host = createHost(graph)

    expect(deleteSelectedLinks(host)).toBe(false)
    expect(hideSelectedLinks(host)).toBe(false)
    expect(host.emitBeforeChange).not.toHaveBeenCalled()
  })
})
