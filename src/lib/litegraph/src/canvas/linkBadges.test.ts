import { fromPartial } from '@total-typescript/shoehorn'
import { assert, describe, expect, it, vi } from 'vitest'

import type { Point, ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import { LLink } from '@/lib/litegraph/src/LLink'
import { toLinkId } from '@/types/linkId'
import type { LinkPresentation } from '@/types/linkPresentation'
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
  const layouts = layoutHiddenLinkBadges(host, ctx, [
    {
      link,
      presentation: { hidden: true },
      startPos,
      endPos,
      color: BADGE_COLOR
    }
  ])
  for (const layout of layouts.values()) {
    drawHiddenLinkBadges(ctx, layout, visibleArea)
  }
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
    layoutHiddenLinkBadges(host, ctx, [
      {
        link: createLink(3, 'MASK'),
        presentation: { hidden: true },
        startPos: [100, 118],
        endPos: [400, 400],
        color: BADGE_COLOR
      },
      {
        link: createLink(2, 'IMAGE'),
        presentation: { hidden: true },
        startPos: [100, 100],
        endPos: [400, 300],
        color: BADGE_COLOR
      },
      {
        link: createLink(1, 'IMAGE'),
        presentation: { hidden: true },
        startPos: [100, 100],
        endPos: [400, 200],
        color: BADGE_COLOR
      }
    ])

    expect(queryLinkBadgeAtPoint(host, 120, 100)).toBe(toLinkId(1))
    expect(queryLinkBadgeAtPoint(host, 120, 122)).toBe(toLinkId(2))
    expect(queryLinkBadgeAtPoint(host, 120, 144)).toBe(toLinkId(3))
    expect(queryLinkBadgeAtPoint(host, 120, 111)).toBeUndefined()
    expect(queryLinkBadgeAtPoint(host, 120, 133)).toBeUndefined()
  })

  it('keeps non-overlapping badges aligned with their slots', () => {
    const host = document.createElement('canvas')
    layoutHiddenLinkBadges(host, createContext(), [
      {
        link: new LLink(toLinkId(1), 'MODEL', 4, 0, 5, 0),
        presentation: { hidden: true },
        startPos: [100, 100],
        endPos: [400, 300],
        color: BADGE_COLOR
      },
      {
        link: new LLink(toLinkId(2), 'MODEL', 4, 1, 5, 1),
        presentation: { hidden: true },
        startPos: [100, 120],
        endPos: [400, 320],
        color: BADGE_COLOR
      }
    ])

    expect(queryLinkBadgeAtPoint(host, 120, 100)).toBe(toLinkId(1))
    expect(queryLinkBadgeAtPoint(host, 120, 112)).toBe(toLinkId(2))
    expect(queryLinkBadgeAtPoint(host, 340, 312)).toBe(toLinkId(2))
  })

  it('preserves slot order when a wider upper badge collides with another node', () => {
    const host = document.createElement('canvas')
    const ctx = createMockCanvasRenderingContext2D({
      measureText: vi.fn((text: string) =>
        fromPartial<TextMetrics>({ width: text.length * 6 })
      )
    })
    const layouts = layoutHiddenLinkBadges(host, ctx, [
      {
        link: new LLink(toLinkId(3), 'MODEL', 2, 0, 20, 0),
        presentation: { hidden: true, label: 'Long upper output' },
        startPos: [34, 100],
        endPos: [900, 400],
        color: BADGE_COLOR
      },
      {
        link: new LLink(toLinkId(4), 'MODEL', 2, 1, 21, 0),
        presentation: { hidden: true, label: 'X' },
        startPos: [34, 120],
        endPos: [900, 500],
        color: BADGE_COLOR
      },
      {
        link: new LLink(toLinkId(1), 'MODEL', 10, 0, 1, 0),
        presentation: { hidden: true, label: 'Other input' },
        startPos: [700, -200],
        endPos: [200, 100],
        color: BADGE_COLOR
      },
      {
        link: new LLink(toLinkId(2), 'MODEL', 11, 0, 1, 1),
        presentation: { hidden: true, label: 'Other input' },
        startPos: [700, -100],
        endPos: [200, 120],
        color: BADGE_COLOR
      }
    ])
    const upper = layouts.get(toLinkId(3))
    const lower = layouts.get(toLinkId(4))
    assert.exists(upper)
    assert.exists(lower)

    expect(upper.output.tip[1]).toBeGreaterThan(120)
    expect(lower.output.hitArea.boundingRect[1]).toBeGreaterThan(
      upper.output.hitArea.boundingRect[1] +
        upper.output.hitArea.boundingRect[3]
    )
    expect(queryLinkBadgeAtPoint(host, 50, upper.output.tip[1])).toBe(
      toLinkId(3)
    )
    expect(queryLinkBadgeAtPoint(host, 50, lower.output.tip[1])).toBe(
      toLinkId(4)
    )
  })

  it('culls using reversed and stacked badge extents', () => {
    const host = document.createElement('canvas')
    const ctx = createContext()
    const layouts = layoutHiddenLinkBadges(
      host,
      ctx,
      [1, 2].map((id) => ({
        link: createLink(id),
        presentation: { hidden: true },
        startPos: [400, 100],
        endPos: [100, 100],
        color: BADGE_COLOR
      }))
    )
    for (const layout of layouts.values()) {
      drawHiddenLinkBadges(ctx, layout, [414, 113, 10, 18])
    }

    expect(queryLinkBadgeAtPoint(host, 420, 122)).toBe(toLinkId(2))
    expect(ctx.fillText).toHaveBeenCalledWith('MODEL', 420, 123)
    expect(ctx.fillText).toHaveBeenCalledTimes(2)
  })

  it.for([
    {
      name: 'another node',
      originId: 6,
      targetId: 7,
      startPos: [100, 100],
      endPos: [600, 300]
    },
    {
      name: 'the opposite side of the same node',
      originId: 6,
      targetId: 4,
      startPos: [600, 300],
      endPos: [190, 100]
    }
  ] satisfies {
    name: string
    originId: number
    targetId: number
    startPos: Point
    endPos: Point
  }[])('keeps overlapping badges from $name separately hittable', (other) => {
    const host = document.createElement('canvas')
    layoutHiddenLinkBadges(host, createContext(), [
      {
        link: createLink(1),
        presentation: { hidden: true },
        startPos: [100, 100],
        endPos: [400, 200],
        color: BADGE_COLOR
      },
      {
        link: new LLink(
          toLinkId(2),
          'MODEL',
          other.originId,
          0,
          other.targetId,
          0
        ),
        presentation: { hidden: true },
        startPos: other.startPos,
        endPos: other.endPos,
        color: BADGE_COLOR
      }
    ])

    expect(queryLinkBadgeAtPoint(host, 120, 100)).toBe(toLinkId(1))
    expect(queryLinkBadgeAtPoint(host, 120, 122)).toBe(toLinkId(2))
  })

  it.for([
    { name: 'visible', visibleArea: VISIBLE_AREA, paintCount: 2 },
    {
      name: 'output-only visible',
      visibleArea: [120, 95, 1, 1],
      paintCount: 2
    },
    {
      name: 'input-only visible',
      visibleArea: [330, 195, 1, 1],
      paintCount: 2
    },
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

describe('badge ordering tie breakers', () => {
  it('places output before input even when the input is supplied first', () => {
    const host = {}
    const layouts = layoutHiddenLinkBadges(host, createContext(), [
      {
        link: new LLink(toLinkId(1), 'MODEL', 6, 0, 4, 0),
        presentation: { hidden: true },
        startPos: [600, 300],
        endPos: [190, 100],
        color: BADGE_COLOR
      },
      {
        link: new LLink(toLinkId(2), 'MODEL', 4, 0, 5, 0),
        presentation: { hidden: true },
        startPos: [100, 100],
        endPos: [400, 200],
        color: BADGE_COLOR
      }
    ])
    expect(layouts.get(toLinkId(2))?.output.tip[1]).toBe(100)
    expect(layouts.get(toLinkId(1))?.input.tip[1]).toBe(122)
    expect(queryLinkBadgeAtPoint(host, 120, 100)).toBe(toLinkId(2))
    expect(queryLinkBadgeAtPoint(host, 120, 122)).toBe(toLinkId(1))
  })

  it('uses slot order before link ID and insertion order at equal socket Y', () => {
    const host = {}
    const layouts = layoutHiddenLinkBadges(host, createContext(), [
      {
        link: new LLink(toLinkId(1), 'MODEL', 4, 3, 5, 0),
        presentation: { hidden: true },
        startPos: [100, 100],
        endPos: [400, 200],
        color: BADGE_COLOR
      },
      {
        link: new LLink(toLinkId(2), 'MODEL', 4, 1, 6, 0),
        presentation: { hidden: true },
        startPos: [100, 100],
        endPos: [600, 300],
        color: BADGE_COLOR
      }
    ])
    expect(layouts.get(toLinkId(2))?.output.tip[1]).toBe(100)
    expect(layouts.get(toLinkId(1))?.output.tip[1]).toBe(122)
    expect(queryLinkBadgeAtPoint(host, 120, 100)).toBe(toLinkId(2))
    expect(queryLinkBadgeAtPoint(host, 120, 122)).toBe(toLinkId(1))
  })
})
