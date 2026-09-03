import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCanvasContextMenuTarget } from '@/lib/litegraph/src/canvas/getCanvasContextMenuTarget'
import { getLinkBadgeFrameState } from '@/lib/litegraph/src/canvas/linkBadges'
import { LLink } from '@/lib/litegraph/src/LLink'
import { LinkRenderType } from '@/lib/litegraph/src/types/globalEnums'
import { toLinkId } from '@/types/linkId'
import { toRerouteId } from '@/types/rerouteId'
import { createUuidv4 } from '@/utils/uuid'

const { mockQueryLinkSegmentAtPoint, mockQueryRerouteAtPoint } = vi.hoisted(
  () => ({
    mockQueryLinkSegmentAtPoint: vi.fn<() => unknown>(() => null),
    mockQueryRerouteAtPoint: vi.fn<() => unknown>(() => null)
  })
)

vi.mock('@/renderer/core/layout/store/layoutStore', () => ({
  layoutStore: {
    queryLinkSegmentAtPoint: mockQueryLinkSegmentAtPoint,
    queryRerouteAtPoint: mockQueryRerouteAtPoint
  }
}))

const GRAPH_ID = createUuidv4()

interface StubGraph {
  rootGraph: { id: typeof GRAPH_ID }
  getLink: ReturnType<typeof vi.fn>
  getReroute: ReturnType<typeof vi.fn>
  getRerouteOnPos: ReturnType<typeof vi.fn>
  getGroupOnPos: ReturnType<typeof vi.fn>
}

interface StubCanvas {
  graph: StubGraph | null
  ctx: CanvasRenderingContext2D
  connections_width: number
  links_render_mode: number
  renderedPaths: Set<unknown>
  _visibleReroutes: Set<unknown>
}

describe('getCanvasContextMenuTarget', () => {
  let graph: StubGraph
  let canvas: StubCanvas
  let isPointInStroke: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockQueryLinkSegmentAtPoint.mockReturnValue(null)
    mockQueryRerouteAtPoint.mockReturnValue(null)
    graph = {
      rootGraph: { id: GRAPH_ID },
      getLink: vi.fn(),
      getReroute: vi.fn(() => ({ id: 9 })),
      getRerouteOnPos: vi.fn(() => undefined),
      getGroupOnPos: vi.fn(() => ({ id: 1 }))
    }
    isPointInStroke = vi.fn(() => false)
    canvas = {
      graph,
      ctx: fromPartial<CanvasRenderingContext2D>({
        lineWidth: 3,
        isPointInStroke
      }),
      connections_width: 3,
      links_render_mode: LinkRenderType.SPLINE_LINK,
      renderedPaths: new Set(),
      _visibleReroutes: new Set()
    }
  })

  function resolve() {
    return getCanvasContextMenuTarget(fromAny(canvas), 10, 20)
  }

  it('returns the group under the point', () => {
    const target = resolve()

    expect(graph.getGroupOnPos).toHaveBeenCalledWith(10, 20)
    expect(target.group).toEqual({ id: 1 })
    expect(target.reroute).toBeUndefined()
  })

  it('resolves a reroute from the layout store without the positional fallback', () => {
    const reroute = { id: 9 }
    mockQueryRerouteAtPoint.mockReturnValue({ id: 9 })
    graph.getReroute.mockReturnValue(reroute)
    canvas.renderedPaths.add(reroute)

    const target = resolve()

    expect(mockQueryRerouteAtPoint).toHaveBeenCalledWith(GRAPH_ID, {
      x: 10,
      y: 20
    })
    expect(graph.getReroute).toHaveBeenCalledWith(9)
    expect(graph.getRerouteOnPos).not.toHaveBeenCalled()
    expect(target.reroute).toEqual({ id: 9 })
  })

  it('falls back when a layout hit names a reroute in another graph', () => {
    mockQueryRerouteAtPoint.mockReturnValue({ id: 9 })
    graph.getReroute.mockReturnValue(undefined)
    graph.getRerouteOnPos.mockReturnValue({ id: 7 })

    const target = resolve()

    expect(graph.getRerouteOnPos).toHaveBeenCalledWith(
      10,
      20,
      canvas._visibleReroutes
    )
    expect(target.reroute).toEqual({ id: 7 })
  })

  it('falls back to the visible-scoped positional hit-test when the layout store misses', () => {
    graph.getRerouteOnPos.mockReturnValue({ id: 7 })

    const target = resolve()

    expect(graph.getRerouteOnPos).toHaveBeenCalledWith(
      10,
      20,
      canvas._visibleReroutes
    )
    expect(target.reroute).toEqual({ id: 7 })
  })

  it('returns a visible link hit on its curve', () => {
    const link = { id: toLinkId(4), hidden: false }
    mockQueryLinkSegmentAtPoint.mockReturnValue({
      linkId: link.id,
      rerouteId: null
    })
    graph.getLink.mockReturnValue(link)
    canvas.renderedPaths.add(link)

    const target = resolve()

    expect(mockQueryLinkSegmentAtPoint).toHaveBeenCalledWith(
      { x: 10, y: 20 },
      canvas.ctx
    )
    expect(target.link).toBe(link)
  })

  it('falls back to current-frame paths when the layout store has no geometry', () => {
    const link = new LLink(toLinkId(4), 'MODEL', 4, 0, 5, 0)
    link.path = fromPartial<Path2D>({})
    canvas.renderedPaths.add(link)
    isPointInStroke.mockReturnValue(true)

    const target = resolve()

    expect(isPointInStroke).toHaveBeenCalledWith(link.path, 10, 20)
    expect(target.link).toBe(link)
  })

  it('returns a hidden link hit on its badge', () => {
    const link = { id: toLinkId(5), hidden: true }
    getLinkBadgeFrameState(canvas).hitAreas.push({
      linkId: link.id,
      x: 5,
      y: 15,
      width: 20,
      height: 10
    })
    graph.getLink.mockReturnValue(link)

    const target = resolve()

    expect(target.link).toBe(link)
    expect(mockQueryLinkSegmentAtPoint).not.toHaveBeenCalled()
  })

  it('skips a revealed hidden curve and returns the visible link behind it', () => {
    const hiddenLink = new LLink(toLinkId(5), 'MODEL', 4, 0, 5, 0)
    hiddenLink.hidden = true
    hiddenLink.path = fromPartial<Path2D>({})
    const visibleLink = new LLink(toLinkId(6), 'MODEL', 6, 0, 7, 0)
    visibleLink.path = fromPartial<Path2D>({})
    canvas.renderedPaths.add(hiddenLink)
    canvas.renderedPaths.add(visibleLink)
    isPointInStroke.mockReturnValue(true)

    const target = resolve()

    expect(target.link).toBe(visibleLink)
  })

  it('does not return a hidden link from a stale curve layout', () => {
    const link = { id: toLinkId(5), hidden: true }
    mockQueryLinkSegmentAtPoint.mockReturnValue({
      linkId: link.id,
      rerouteId: null
    })
    graph.getLink.mockReturnValue(link)

    const target = resolve()

    expect(target.link).toBeUndefined()
  })

  it('gives a reroute precedence over a link at the same point', () => {
    const reroute = { id: 9 }
    mockQueryRerouteAtPoint.mockReturnValue({ id: 9 })
    graph.getReroute.mockReturnValue(reroute)
    canvas.renderedPaths.add(reroute)
    mockQueryLinkSegmentAtPoint.mockReturnValue({
      linkId: toLinkId(4),
      rerouteId: toRerouteId(9)
    })

    const target = resolve()

    expect(target.reroute).toEqual({ id: 9 })
    expect(target.link).toBeUndefined()
    expect(mockQueryLinkSegmentAtPoint).not.toHaveBeenCalled()
  })

  it('ignores a non-rendered layout reroute and resolves the badge beneath it', () => {
    const reroute = { id: 9 }
    const link = { id: toLinkId(5), hidden: true }
    mockQueryRerouteAtPoint.mockReturnValue({ id: 9 })
    graph.getReroute.mockReturnValue(reroute)
    graph.getLink.mockReturnValue(link)
    getLinkBadgeFrameState(canvas).hitAreas.push({
      linkId: link.id,
      x: 5,
      y: 15,
      width: 20,
      height: 10
    })

    const target = resolve()

    expect(target.reroute).toBeUndefined()
    expect(target.link).toBe(link)
    expect(graph.getRerouteOnPos).toHaveBeenCalledWith(
      10,
      20,
      canvas._visibleReroutes
    )
  })

  it('skips reroute detection when links are hidden', () => {
    canvas.links_render_mode = LinkRenderType.HIDDEN_LINK

    const target = resolve()

    expect(mockQueryRerouteAtPoint).not.toHaveBeenCalled()
    expect(mockQueryLinkSegmentAtPoint).not.toHaveBeenCalled()
    expect(graph.getRerouteOnPos).not.toHaveBeenCalled()
    expect(target.reroute).toBeUndefined()
    expect(target.group).toEqual({ id: 1 })
  })

  it('returns an empty target when the canvas has no graph', () => {
    canvas.graph = null

    expect(resolve()).toEqual({})
  })
})
