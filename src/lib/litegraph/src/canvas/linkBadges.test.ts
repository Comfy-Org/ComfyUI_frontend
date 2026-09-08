import { describe, expect, it, vi } from 'vitest'

import type { Point, ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import { LLink } from '@/lib/litegraph/src/LLink'
import { toLinkId } from '@/types/linkId'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

import {
  BADGE_GAP,
  clearLinkBadgeHitAreas,
  drawHiddenLinkBadges,
  layoutHiddenLinkBadges,
  linkBadgeText,
  queryLinkBadgeAtPoint
} from './linkBadges'

const BADGE_COLOR = '#cab8ff'
const VISIBLE_AREA: ReadOnlyRect = [0, 0, 1000, 1000]

function createContext(): CanvasRenderingContext2D {
  return createMockCanvasRenderingContext2D({
    measureText: vi.fn().mockReturnValue({ width: 50 })
  })
}

function createLink(id: number, type: LLink['type'] = 'MODEL'): LLink {
  return new LLink(toLinkId(id), type, 4, 0, 5, 0)
}

function drawBadgesInView(
  host: object,
  ctx: CanvasRenderingContext2D,
  link: LLink,
  startPos: Point,
  endPos: Point,
  visibleArea: ReadOnlyRect = VISIBLE_AREA
) {
  const layout = layoutHiddenLinkBadges(
    host,
    ctx,
    link,
    { hidden: true },
    startPos,
    endPos,
    BADGE_COLOR
  )
  drawHiddenLinkBadges(ctx, layout, visibleArea)
  return layout
}

describe('linkBadgeText', () => {
  it('uses a trimmed label before the link type', () => {
    const link = createLink(1)

    expect(linkBadgeText(link.type, { label: '  Checkpoint  ' })).toBe(
      'Checkpoint'
    )
  })

  it('falls back to the link type', () => {
    expect(linkBadgeText(createLink(1).type, {})).toBe('MODEL')
  })

  it('falls back to an asterisk for a typeless link', () => {
    expect(linkBadgeText(createLink(1, '').type, {})).toBe('*')
  })

  it('falls back to an asterisk for a numeric link type', () => {
    expect(linkBadgeText(createLink(1, -1).type, {})).toBe('*')
  })
})

describe('link badge frame layout', () => {
  it('registers two endpoint hit areas', () => {
    const host = document.createElement('canvas')
    drawBadgesInView(
      host,
      createContext(),
      createLink(7),
      [100, 100],
      [400, 200]
    )

    expect(queryLinkBadgeAtPoint(host, 120, 100)).toBe(toLinkId(7))
    expect(queryLinkBadgeAtPoint(host, 360, 200)).toBe(toLinkId(7))
    expect(queryLinkBadgeAtPoint(host, 250, 150)).toBeUndefined()
  })

  it('offsets an unstacked output badge from its socket by the badge gap', () => {
    const host = document.createElement('canvas')
    drawBadgesInView(
      host,
      createContext(),
      createLink(7),
      [100, 100],
      [400, 200]
    )

    expect(queryLinkBadgeAtPoint(host, 100 + BADGE_GAP + 4, 100)).toBe(
      toLinkId(7)
    )
  })

  it('clears hit areas between frames', () => {
    const host = document.createElement('canvas')
    drawBadgesInView(
      host,
      createContext(),
      createLink(7),
      [100, 100],
      [400, 200]
    )

    clearLinkBadgeHitAreas(host)

    expect(queryLinkBadgeAtPoint(host, 120, 100)).toBeUndefined()
  })

  it('keeps hit areas isolated when another canvas is cleared', () => {
    const firstCanvas = document.createElement('canvas')
    const secondCanvas = document.createElement('canvas')
    const ctx = createContext()
    drawBadgesInView(firstCanvas, ctx, createLink(7), [100, 100], [400, 200])
    drawBadgesInView(secondCanvas, ctx, createLink(8), [100, 100], [400, 200])

    expect(queryLinkBadgeAtPoint(firstCanvas, 120, 100)).toBe(toLinkId(7))
    expect(queryLinkBadgeAtPoint(secondCanvas, 120, 100)).toBe(toLinkId(8))

    clearLinkBadgeHitAreas(firstCanvas)

    expect(queryLinkBadgeAtPoint(firstCanvas, 120, 100)).toBeUndefined()
    expect(queryLinkBadgeAtPoint(secondCanvas, 120, 100)).toBe(toLinkId(8))
  })

  it('creates fallback badges for a typeless link', () => {
    const host = document.createElement('canvas')
    const ctx = createContext()

    drawBadgesInView(host, ctx, createLink(7, ''), [100, 100], [400, 200])

    expect(ctx.fillText).toHaveBeenCalledTimes(2)
  })

  it('stacks overlapping endpoint badges into disjoint bands', () => {
    const host = document.createElement('canvas')
    const ctx = createContext()
    drawBadgesInView(host, ctx, createLink(1, 'IMAGE'), [100, 100], [400, 200])
    drawBadgesInView(host, ctx, createLink(2, 'IMAGE'), [100, 100], [400, 300])
    drawBadgesInView(host, ctx, createLink(3, 'MASK'), [100, 118], [400, 400])

    expect(queryLinkBadgeAtPoint(host, 120, 100)).toBe(toLinkId(1))
    expect(queryLinkBadgeAtPoint(host, 120, 122)).toBe(toLinkId(2))
    expect(queryLinkBadgeAtPoint(host, 120, 144)).toBe(toLinkId(3))
    expect(queryLinkBadgeAtPoint(host, 120, 111)).toBeUndefined()
    expect(queryLinkBadgeAtPoint(host, 120, 133)).toBeUndefined()
  })

  it('culls using reversed and stacked badge extents', () => {
    const host = document.createElement('canvas')
    const ctx = createContext()
    drawBadgesInView(host, ctx, createLink(1), [400, 100], [100, 100])
    vi.mocked(ctx.fillText).mockClear()

    drawBadgesInView(
      host,
      ctx,
      createLink(2),
      [400, 100],
      [100, 100],
      [414, 113, 10, 18]
    )

    expect(queryLinkBadgeAtPoint(host, 420, 122)).toBe(toLinkId(2))
    expect(ctx.fillText).toHaveBeenCalledWith('MODEL', 420, 123)
    expect(ctx.fillText).toHaveBeenCalledTimes(2)
  })

  it('keeps hit areas and rows for culled badges while skipping their paint', () => {
    const host = document.createElement('canvas')
    const ctx = createContext()

    drawBadgesInView(
      host,
      ctx,
      createLink(1),
      [100, 100],
      [400, 200],
      [5000, 5000, 10, 10]
    )

    expect(queryLinkBadgeAtPoint(host, 120, 100)).toBe(toLinkId(1))
    expect(queryLinkBadgeAtPoint(host, 360, 200)).toBe(toLinkId(1))
    expect(ctx.fillText).not.toHaveBeenCalled()
  })

  it('paints visible badges immediately', () => {
    const host = document.createElement('canvas')
    const ctx = createContext()
    drawBadgesInView(host, ctx, createLink(9), [100, 100], [400, 200])

    expect(ctx.fillText).toHaveBeenCalledTimes(2)
  })
})
