import { describe, expect, it, vi } from 'vitest'

import type { Point, ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import { LLink } from '@/lib/litegraph/src/LLink'
import { toLinkId } from '@/types/linkId'
import { createMockCanvasRenderingContext2D } from '@/utils/__tests__/litegraphTestUtils'

import {
  clearLinkBadgeFrameState,
  createLinkBadgeFrameState,
  drawPendingLinkBadges,
  enqueueHiddenLinkBadges,
  linkBadgeText,
  queryLinkBadgeAtPoint
} from './linkBadges'

const BADGE_COLOR = '#cab8ff'
const VISIBLE_AREA: ReadOnlyRect = [0, 0, 1000, 1000]

function createContext(): CanvasRenderingContext2D {
  return createMockCanvasRenderingContext2D({
    measureText: vi.fn().mockReturnValue({ width: 50 } as TextMetrics)
  })
}

function createLink(id: number, type: LLink['type'] = 'MODEL'): LLink {
  return new LLink(toLinkId(id), type, 4, 0, 5, 0)
}

function enqueueBadgesInView(
  state: ReturnType<typeof createLinkBadgeFrameState>,
  ctx: CanvasRenderingContext2D,
  link: LLink,
  startPos: Point,
  endPos: Point,
  visibleArea: ReadOnlyRect = VISIBLE_AREA
) {
  return enqueueHiddenLinkBadges(
    state,
    ctx,
    link,
    [startPos, endPos],
    BADGE_COLOR,
    visibleArea
  )
}

describe('linkBadgeText', () => {
  it('uses a trimmed label before the link type', () => {
    const link = createLink(1)
    link.label = '  Checkpoint  '

    expect(linkBadgeText(link)).toBe('Checkpoint')
  })

  it('falls back to the link type', () => {
    expect(linkBadgeText(createLink(1))).toBe('MODEL')
  })

  it('falls back to an asterisk for a typeless link', () => {
    expect(linkBadgeText(createLink(1, ''))).toBe('*')
  })

  it('falls back to an asterisk for a numeric link type', () => {
    expect(linkBadgeText(createLink(1, -1))).toBe('*')
  })
})

describe('link badge frame layout', () => {
  it('registers two endpoint hit areas and returns their outer tips', () => {
    const state = createLinkBadgeFrameState()
    const tips = enqueueBadgesInView(
      state,
      createContext(),
      createLink(7),
      [100, 100],
      [400, 200]
    )

    expect(tips).toBeDefined()
    if (!tips) throw new Error('Expected badges to be visible')
    expect(state.hitAreas).toHaveLength(2)
    expect(queryLinkBadgeAtPoint(state, 120, 100)).toBe(toLinkId(7))
    expect(queryLinkBadgeAtPoint(state, 360, 200)).toBe(toLinkId(7))
    expect(queryLinkBadgeAtPoint(state, 250, 150)).toBeUndefined()
    expect(tips.outputTip[0]).toBeGreaterThan(100)
    expect(tips.outputTip[1]).toBe(100)
    expect(tips.inputTip[0]).toBeLessThan(400)
    expect(tips.inputTip[1]).toBe(200)
  })

  it('clears hit areas and pending paint between frames', () => {
    const state = createLinkBadgeFrameState()
    enqueueBadgesInView(
      state,
      createContext(),
      createLink(7),
      [100, 100],
      [400, 200]
    )

    clearLinkBadgeFrameState(state)

    expect(state.hitAreas).toHaveLength(0)
    expect(state.pendingBadges).toHaveLength(0)
  })

  it('keeps frame state isolated between canvases', () => {
    const firstState = createLinkBadgeFrameState()
    const secondState = createLinkBadgeFrameState()
    enqueueBadgesInView(
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

    const tips = enqueueBadgesInView(
      state,
      createContext(),
      createLink(7, ''),
      [100, 100],
      [400, 200]
    )

    expect(tips).toBeDefined()
    if (!tips) throw new Error('Expected fallback badges to be visible')
    expect(tips.outputTip[0]).toBeGreaterThan(100)
    expect(tips.inputTip[0]).toBeLessThan(400)
    expect(state.hitAreas).toHaveLength(2)
    expect(state.pendingBadges).toHaveLength(1)
  })

  it('stacks overlapping endpoint badges into disjoint bands', () => {
    const state = createLinkBadgeFrameState()
    const ctx = createContext()
    enqueueBadgesInView(
      state,
      ctx,
      createLink(1, 'IMAGE'),
      [100, 100],
      [400, 200]
    )
    enqueueBadgesInView(
      state,
      ctx,
      createLink(2, 'IMAGE'),
      [100, 100],
      [400, 300]
    )
    enqueueBadgesInView(
      state,
      ctx,
      createLink(3, 'MASK'),
      [100, 118],
      [400, 400]
    )

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
    enqueueBadgesInView(state, ctx, createLink(1), [400, 100], [100, 100])

    const tips = enqueueBadgesInView(
      state,
      ctx,
      createLink(2),
      [400, 100],
      [100, 100],
      [414, 113, 10, 18]
    )

    expect(tips).toBeDefined()
    expect(state.hitAreas).toHaveLength(4)
  })

  it('keeps hit areas and rows for culled badges while skipping their paint', () => {
    const state = createLinkBadgeFrameState()
    const ctx = createContext()

    const tips = enqueueBadgesInView(
      state,
      ctx,
      createLink(1),
      [100, 100],
      [400, 200],
      [5000, 5000, 10, 10]
    )

    expect(tips).toBeDefined()
    expect(state.hitAreas).toHaveLength(2)
    expect(state.pendingBadges).toHaveLength(0)
  })

  it('defers badge painting until the frame flush', () => {
    const state = createLinkBadgeFrameState()
    const ctx = createContext()
    enqueueBadgesInView(state, ctx, createLink(9), [100, 100], [400, 200])

    expect(ctx.fillText).not.toHaveBeenCalled()

    drawPendingLinkBadges(state, ctx)

    expect(ctx.fillText).toHaveBeenCalledTimes(2)
    expect(state.pendingBadges).toHaveLength(0)
  })
})
