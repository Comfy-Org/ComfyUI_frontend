import { describe, expect, it, vi } from 'vitest'

import type { Point, ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import { LLink } from '@/lib/litegraph/src/LLink'
import { toLinkId } from '@/types/linkId'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

import {
  BADGE_GAP,
  clearLinkBadgeFrameState,
  createLinkBadgeFrameState,
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
  state: ReturnType<typeof createLinkBadgeFrameState>,
  ctx: CanvasRenderingContext2D,
  link: LLink,
  startPos: Point,
  endPos: Point,
  visibleArea: ReadOnlyRect = VISIBLE_AREA
) {
  return drawHiddenLinkBadges(
    state,
    ctx,
    link,
    { hidden: true },
    [startPos, endPos],
    BADGE_COLOR,
    visibleArea
  )
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
    const state = createLinkBadgeFrameState()
    drawBadgesInView(
      state,
      createContext(),
      createLink(7),
      [100, 100],
      [400, 200]
    )

    expect(state.hitAreas).toHaveLength(2)
    expect(queryLinkBadgeAtPoint(state, 120, 100)).toBe(toLinkId(7))
    expect(queryLinkBadgeAtPoint(state, 360, 200)).toBe(toLinkId(7))
    expect(queryLinkBadgeAtPoint(state, 250, 150)).toBeUndefined()
  })

  it('offsets an unstacked output badge from its socket by the badge gap', () => {
    const state = createLinkBadgeFrameState()
    drawBadgesInView(
      state,
      createContext(),
      createLink(7),
      [100, 100],
      [400, 200]
    )

    expect(queryLinkBadgeAtPoint(state, 100 + BADGE_GAP + 4, 100)).toBe(
      toLinkId(7)
    )
  })

  it('clears hit areas between frames', () => {
    const state = createLinkBadgeFrameState()
    drawBadgesInView(
      state,
      createContext(),
      createLink(7),
      [100, 100],
      [400, 200]
    )

    clearLinkBadgeFrameState(state)

    expect(state.hitAreas).toHaveLength(0)
  })

  it('keeps frame state isolated between canvases', () => {
    const firstState = createLinkBadgeFrameState()
    const secondState = createLinkBadgeFrameState()
    drawBadgesInView(
      firstState,
      createContext(),
      createLink(7),
      [100, 100],
      [400, 200]
    )

    expect(queryLinkBadgeAtPoint(firstState, 120, 100)).toBe(toLinkId(7))
    expect(queryLinkBadgeAtPoint(secondState, 120, 100)).toBeUndefined()
  })

  it('creates fallback badges for a typeless link', () => {
    const state = createLinkBadgeFrameState()
    const ctx = createContext()

    drawBadgesInView(state, ctx, createLink(7, ''), [100, 100], [400, 200])

    expect(state.hitAreas).toHaveLength(2)
    expect(ctx.fillText).toHaveBeenCalledTimes(2)
  })

  it('stacks overlapping endpoint badges into disjoint bands', () => {
    const state = createLinkBadgeFrameState()
    const ctx = createContext()
    drawBadgesInView(state, ctx, createLink(1, 'IMAGE'), [100, 100], [400, 200])
    drawBadgesInView(state, ctx, createLink(2, 'IMAGE'), [100, 100], [400, 300])
    drawBadgesInView(state, ctx, createLink(3, 'MASK'), [100, 118], [400, 400])

    const outputAreas = state.hitAreas.filter((area) => {
      const centerX = area.x + area.width / 2
      return Math.abs(centerX - 100) < Math.abs(centerX - 400)
    })
    const bands = [1, 2, 3].map((id) => {
      const area = outputAreas.find((area) => area.linkId === toLinkId(id))
      if (!area) throw new Error(`Missing output badge for link ${id}`)
      return { top: area.y, bottom: area.y + area.height }
    })
    const overlaps = (
      first: (typeof bands)[number],
      second: (typeof bands)[number]
    ) => first.top < second.bottom && first.bottom > second.top

    expect(overlaps(bands[0], bands[1])).toBe(false)
    expect(overlaps(bands[0], bands[2])).toBe(false)
    expect(overlaps(bands[1], bands[2])).toBe(false)
  })

  it('culls using reversed and stacked badge extents', () => {
    const state = createLinkBadgeFrameState()
    const ctx = createContext()
    drawBadgesInView(state, ctx, createLink(1), [400, 100], [100, 100])

    drawBadgesInView(
      state,
      ctx,
      createLink(2),
      [400, 100],
      [100, 100],
      [414, 113, 10, 18]
    )

    expect(state.hitAreas).toHaveLength(4)
  })

  it('keeps hit areas and rows for culled badges while skipping their paint', () => {
    const state = createLinkBadgeFrameState()
    const ctx = createContext()

    drawBadgesInView(
      state,
      ctx,
      createLink(1),
      [100, 100],
      [400, 200],
      [5000, 5000, 10, 10]
    )

    expect(state.hitAreas).toHaveLength(2)
    expect(ctx.fillText).not.toHaveBeenCalled()
  })

  it('paints visible badges immediately', () => {
    const state = createLinkBadgeFrameState()
    const ctx = createContext()
    drawBadgesInView(state, ctx, createLink(9), [100, 100], [400, 200])

    expect(ctx.fillText).toHaveBeenCalledTimes(2)
  })
})
