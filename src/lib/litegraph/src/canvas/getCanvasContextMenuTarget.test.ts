import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCanvasContextMenuTarget } from '@/lib/litegraph/src/canvas/getCanvasContextMenuTarget'
import {
  drawHiddenLinkBadges,
  layoutHiddenLinkBadges
} from '@/lib/litegraph/src/canvas/linkBadges'
import { LGraph } from '@/lib/litegraph/src/LGraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { LGraphGroup } from '@/lib/litegraph/src/LGraphGroup'
import { LLink } from '@/lib/litegraph/src/LLink'
import { Reroute } from '@/lib/litegraph/src/Reroute'
import {
  LinkMarkerShape,
  LinkRenderType
} from '@/lib/litegraph/src/types/globalEnums'
import { useLinkPresentationStore } from '@/stores/linkPresentationStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toGroupId } from '@/types/groupId'
import { toLinkId } from '@/types/linkId'
import { toRerouteId } from '@/types/rerouteId'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvas
} from '@/utils/__tests__/canvasTestUtils'

const { mockQueryRerouteAtPoint } = vi.hoisted(() => ({
  mockQueryRerouteAtPoint: vi.fn<() => unknown>(() => null)
}))

vi.mock<unknown>(
  import('@/renderer/core/layout/store/layoutStore'), // oxlint-disable-line comfy/no-restricted-paths

  () => ({
    layoutStore: {
      queryRerouteAtPoint: mockQueryRerouteAtPoint
    }
  })
)

describe('getCanvasContextMenuTarget', () => {
  let graph: LGraph
  let canvas: LGraphCanvas
  let group: LGraphGroup
  let reroute: Reroute

  beforeEach(() => {
    mockQueryRerouteAtPoint.mockReturnValue(null)
    graph = new LGraph()
    group = new LGraphGroup('Group', toGroupId(1))
    reroute = new Reroute(toRerouteId(9), graph)
    vi.spyOn(graph, 'getReroute').mockReturnValue(reroute)
    vi.spyOn(graph, 'getRerouteOnPos').mockReturnValue(undefined)
    vi.spyOn(graph, 'getGroupOnPos').mockReturnValue(group)
    canvas = createTestCanvas(graph, createMockCanvasRenderingContext2D())
    canvas.links_render_mode = LinkRenderType.SPLINE_LINK
    canvas.linkMarkerShape = LinkMarkerShape.Circle
  })

  function resolve() {
    return getCanvasContextMenuTarget(canvas, 10, 20)
  }

  function createLink(id: number, centre: [number, number] = [12, 18]): LLink {
    const link = new LLink(toLinkId(id), 'MODEL', 4, 0, 5, 0)
    link._pos = centre
    graph.links.set(link.id, link)
    return link
  }

  function hide(link: LLink): void {
    useLinkPresentationStore().patch(graphScopeOf(graph), link.id, {
      hidden: true
    })
  }

  it('returns the group under the point', () => {
    const target = resolve()

    expect(graph.getGroupOnPos).toHaveBeenCalledWith(10, 20)
    expect(target.group).toBe(group)
    expect(target.reroute).toBeUndefined()
  })

  it('resolves a reroute from the layout store without the positional fallback', () => {
    mockQueryRerouteAtPoint.mockReturnValue({ id: 9 })
    canvas.renderedPaths.add(reroute)

    const target = resolve()

    expect(mockQueryRerouteAtPoint).toHaveBeenCalledWith(graph.rootGraph.id, {
      x: 10,
      y: 20
    })
    expect(graph.getReroute).toHaveBeenCalledWith(9)
    expect(graph.getRerouteOnPos).not.toHaveBeenCalled()
    expect(target.group).toBe(group)
    expect(target.reroute).toBe(reroute)
  })

  it('falls back when a layout hit names a reroute in another graph', () => {
    mockQueryRerouteAtPoint.mockReturnValue({ id: 9 })
    vi.mocked(graph.getReroute).mockReturnValue(undefined)
    const fallback = new Reroute(toRerouteId(7), graph)
    vi.mocked(graph.getRerouteOnPos).mockReturnValue(fallback)

    const target = resolve()

    expect(graph.getRerouteOnPos).toHaveBeenCalledWith(
      10,
      20,
      canvas._visibleReroutes
    )
    expect(target.reroute).toBe(fallback)
  })

  it('falls back to the visible-scoped positional hit-test when the layout store misses', () => {
    const fallback = new Reroute(toRerouteId(7), graph)
    vi.mocked(graph.getRerouteOnPos).mockReturnValue(fallback)

    const target = resolve()

    expect(graph.getRerouteOnPos).toHaveBeenCalledWith(
      10,
      20,
      canvas._visibleReroutes
    )
    expect(target.reroute).toBe(fallback)
  })

  it('returns a visible link whose centre marker is under the point', () => {
    const link = createLink(4)
    canvas.renderedPaths.add(link)

    const target = resolve()

    expect(target.group).toBe(group)
    expect(target.link).toBe(link)
    expect(target.linkSegment).toBe(link)
  })

  it('ignores a visible link away from its centre marker', () => {
    canvas.renderedPaths.add(createLink(4, [100, 200]))

    const target = resolve()

    expect(target.group).toBe(group)
    expect(target.link).toBeUndefined()
  })

  it('ignores centre markers when link markers are off', () => {
    canvas.linkMarkerShape = LinkMarkerShape.None
    canvas.renderedPaths.add(createLink(4))

    expect(resolve().link).toBeUndefined()
  })

  it('returns a hidden link hit on its badge', () => {
    const link = createLink(5)
    hide(link)
    layoutHiddenLinkBadges(canvas, canvas.ctx, [
      {
        link,
        presentation: { hidden: true },
        startPos: [-10, 20],
        endPos: [200, 20],
        color: '#cab8ff'
      }
    ])
    drawHiddenLinkBadges(canvas.ctx, canvas, [0, 0, 800, 600])
    const target = resolve()

    expect(target.group).toBe(group)
    expect(target.link).toBe(link)
  })

  it('returns the still-hidden links of a stack hit on its pill', () => {
    const links = [5, 6, 7].map((id) => {
      const link = new LLink(toLinkId(id), 'MODEL', 4, 0, id, 0)
      graph.links.set(link.id, link)
      hide(link)
      return link
    })
    layoutHiddenLinkBadges(
      canvas,
      canvas.ctx,
      links.map((link) => ({
        link,
        presentation: { hidden: true },
        startPos: [-10, 20],
        endPos: [200, 20],
        color: '#cab8ff'
      }))
    )
    useLinkPresentationStore().patch(graphScopeOf(graph), links[2].id, {
      hidden: false
    })

    const target = resolve()

    expect(target.stackedLinks).toEqual([links[0], links[1]])
    expect(target.link).toBeUndefined()
  })

  it('skips a revealed hidden link and returns the visible link behind it', () => {
    const hiddenLink = createLink(5)
    hide(hiddenLink)
    const visibleLink = createLink(6)
    canvas.renderedPaths.add(hiddenLink)
    canvas.renderedPaths.add(visibleLink)

    const target = resolve()

    expect(target.link).toBe(visibleLink)
  })

  it('gives a reroute precedence over a link at the same point', () => {
    mockQueryRerouteAtPoint.mockReturnValue({ id: 9 })
    canvas.renderedPaths.add(reroute)
    canvas.renderedPaths.add(createLink(4))

    const target = resolve()

    expect(target.group).toBe(group)
    expect(target.reroute).toBe(reroute)
    expect(target.link).toBeUndefined()
  })

  it('ignores a non-rendered layout reroute and resolves the badge beneath it', () => {
    const link = createLink(5)
    hide(link)
    mockQueryRerouteAtPoint.mockReturnValue({ id: 9 })
    layoutHiddenLinkBadges(canvas, canvas.ctx, [
      {
        link,
        presentation: { hidden: true },
        startPos: [-10, 20],
        endPos: [200, 20],
        color: '#cab8ff'
      }
    ])
    drawHiddenLinkBadges(canvas.ctx, canvas, [0, 0, 800, 600])

    const target = resolve()

    expect(target.reroute).toBeUndefined()
    expect(target.group).toBe(group)
    expect(target.link).toBe(link)
    expect(graph.getRerouteOnPos).toHaveBeenCalledWith(
      10,
      20,
      canvas._visibleReroutes
    )
  })

  it('skips reroute and link detection when links are hidden', () => {
    canvas.links_render_mode = LinkRenderType.HIDDEN_LINK
    canvas.renderedPaths.add(createLink(4))

    const target = resolve()

    expect(mockQueryRerouteAtPoint).not.toHaveBeenCalled()
    expect(target.link).toBeUndefined()
    expect(graph.getRerouteOnPos).not.toHaveBeenCalled()
    expect(target.reroute).toBeUndefined()
    expect(target.group).toBe(group)
  })

  it('returns an empty target when the canvas has no graph', () => {
    canvas.graph = null

    expect(resolve()).toEqual({})
  })
})
