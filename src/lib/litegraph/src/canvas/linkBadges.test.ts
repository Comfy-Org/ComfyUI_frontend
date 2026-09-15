import { describe, expect, it, vi } from 'vitest'

import type { Point, ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import { LLink } from '@/lib/litegraph/src/LLink'
import { toLinkId } from '@/types/linkId'
import type { LinkPresentation } from '@/types/linkPresentation'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

import {
  BADGE_GAP,
  clearLinkBadgeHitAreas,
  drawHiddenLinkBadges,
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
  return drawHiddenLinkBadges(
    host,
    ctx,
    link,
    { hidden: true },
    startPos,
    endPos,
    BADGE_COLOR,
    visibleArea
  )
}

describe('linkBadgeText', () => {
  it.for([
    {
      type: 'MODEL',
      presentation: { label: '  Checkpoint  ' },
      expected: 'Checkpoint'
    },
    { type: 'MODEL', presentation: {}, expected: 'MODEL' },
    { type: '', presentation: {}, expected: '*' },
    { type: -1, presentation: {}, expected: '*' }
  ] satisfies {
    type: LLink['type']
    presentation: LinkPresentation
    expected: string
  }[])(
    'renders $type with $presentation as $expected',
    ({ type, presentation, expected }) => {
      expect(linkBadgeText(type, presentation)).toBe(expected)
    }
  )
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

  it.for([
    { name: 'visible', visibleArea: VISIBLE_AREA, paintCount: 2 },
    { name: 'culled', visibleArea: [5000, 5000, 10, 10], paintCount: 0 }
  ] satisfies {
    name: string
    visibleArea: ReadOnlyRect
    paintCount: number
  }[])(
    'keeps endpoint hit areas for $name badges and paints $paintCount badges',
    ({ visibleArea, paintCount }) => {
      const host = document.createElement('canvas')
      const ctx = createContext()
      drawBadgesInView(
        host,
        ctx,
        createLink(1),
        [100, 100],
        [400, 200],
        visibleArea
      )

      expect(queryLinkBadgeAtPoint(host, 120, 100)).toBe(toLinkId(1))
      expect(queryLinkBadgeAtPoint(host, 360, 200)).toBe(toLinkId(1))
      expect(ctx.fillText).toHaveBeenCalledTimes(paintCount)
    }
  )

  it('includes badge edges and excludes points just beyond them', () => {
    const host = document.createElement('canvas')
    drawBadgesInView(
      host,
      createContext(),
      createLink(1),
      [100, 100],
      [400, 200]
    )

    expect(queryLinkBadgeAtPoint(host, 114, 91)).toBe(toLinkId(1))
    expect(queryLinkBadgeAtPoint(host, 176, 109)).toBe(toLinkId(1))
    expect(queryLinkBadgeAtPoint(host, 113, 91)).toBeUndefined()
    expect(queryLinkBadgeAtPoint(host, 177, 109)).toBeUndefined()
    expect(queryLinkBadgeAtPoint(host, 114, 90)).toBeUndefined()
    expect(queryLinkBadgeAtPoint(host, 176, 110)).toBeUndefined()
  })
})
