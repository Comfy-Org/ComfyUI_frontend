import { describe, expect, it, vi } from 'vitest'

import { LLink } from '@/lib/litegraph/src/LLink'
import { toLinkId } from '@/types/linkId'
import { createMockCanvas2DContext } from '@/utils/__tests__/litegraphTestUtils'

import {
  clearLinkBadgeFrameState,
  createLinkBadgeFrameState,
  drawPendingLinkBadges,
  enqueueHiddenLinkBadges,
  linkBadgeText,
  queryLinkBadgeAtPoint
} from './linkBadges'

function createContext(): CanvasRenderingContext2D {
  return createMockCanvas2DContext({
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    measureText: vi.fn().mockReturnValue({ width: 50 } as TextMetrics),
    roundRect: vi.fn(),
    fillText: vi.fn()
  })
}

function createLink(id: number, type: string = 'MODEL'): LLink {
  return new LLink(toLinkId(id), type, 4, 0, 5, 0)
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
})

describe('link badge frame layout', () => {
  it('registers two endpoint hit areas and returns their outer tips', () => {
    const state = createLinkBadgeFrameState()
    const tips = enqueueHiddenLinkBadges(
      state,
      createContext(),
      createLink(7),
      [100, 100],
      [400, 200],
      '#cab8ff'
    )

    expect(state.hitAreas).toHaveLength(2)
    expect(queryLinkBadgeAtPoint(state, 120, 100)).toBe(toLinkId(7))
    expect(queryLinkBadgeAtPoint(state, 360, 200)).toBe(toLinkId(7))
    expect(queryLinkBadgeAtPoint(state, 250, 150)).toBeUndefined()
    expect(tips?.outputTip[0]).toBeGreaterThan(100)
    expect(tips?.outputTip[1]).toBe(100)
    expect(tips?.inputTip[0]).toBeLessThan(400)
    expect(tips?.inputTip[1]).toBe(200)
  })

  it('clears hit areas and pending paint between frames', () => {
    const state = createLinkBadgeFrameState()
    enqueueHiddenLinkBadges(
      state,
      createContext(),
      createLink(7),
      [100, 100],
      [400, 200],
      '#cab8ff'
    )

    clearLinkBadgeFrameState(state)

    expect(state.hitAreas).toHaveLength(0)
    expect(state.pendingBadges).toHaveLength(0)
  })

  it('keeps frame state isolated between canvases', () => {
    const firstState = createLinkBadgeFrameState()
    const secondState = createLinkBadgeFrameState()
    enqueueHiddenLinkBadges(
      firstState,
      createContext(),
      createLink(7),
      [100, 100],
      [400, 200],
      '#cab8ff'
    )

    expect(queryLinkBadgeAtPoint(firstState, 120, 100)).toBe(toLinkId(7))
    expect(queryLinkBadgeAtPoint(secondState, 120, 100)).toBeUndefined()
  })

  it('creates fallback badges for a typeless link', () => {
    const state = createLinkBadgeFrameState()

    const tips = enqueueHiddenLinkBadges(
      state,
      createContext(),
      createLink(7, ''),
      [100, 100],
      [400, 200],
      '#cab8ff'
    )

    expect(tips.outputTip[0]).toBeGreaterThan(100)
    expect(tips.inputTip[0]).toBeLessThan(400)
    expect(state.hitAreas).toHaveLength(2)
    expect(state.pendingBadges).toHaveLength(1)
  })

  it('stacks overlapping endpoint badges into disjoint bands', () => {
    const state = createLinkBadgeFrameState()
    const ctx = createContext()
    enqueueHiddenLinkBadges(
      state,
      ctx,
      createLink(1, 'IMAGE'),
      [100, 100],
      [400, 200],
      '#cab8ff'
    )
    enqueueHiddenLinkBadges(
      state,
      ctx,
      createLink(2, 'IMAGE'),
      [100, 100],
      [400, 300],
      '#cab8ff'
    )
    enqueueHiddenLinkBadges(
      state,
      ctx,
      createLink(3, 'MASK'),
      [100, 118],
      [400, 400],
      '#cab8ff'
    )

    const outputAreas = state.hitAreas.filter((area) => area.x > 100)
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

  it('defers badge painting until the frame flush', () => {
    const state = createLinkBadgeFrameState()
    const ctx = createContext()
    enqueueHiddenLinkBadges(
      state,
      ctx,
      createLink(9),
      [100, 100],
      [400, 200],
      '#cab8ff'
    )

    expect(ctx.fillText).not.toHaveBeenCalled()

    drawPendingLinkBadges(state, ctx)

    expect(ctx.fillText).toHaveBeenCalledTimes(2)
    expect(state.pendingBadges).toHaveLength(0)
  })
})
