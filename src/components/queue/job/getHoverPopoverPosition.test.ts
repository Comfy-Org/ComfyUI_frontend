import { describe, expect, it } from 'vitest'

import { getHoverPopoverPosition } from './getHoverPopoverPosition'

describe('getHoverPopoverPosition', () => {
  it('places the popover to the right when space is available', () => {
    const position = getHoverPopoverPosition(
      { top: 100, left: 40, right: 240 },
      1280
    )
    expect(position).toEqual({ top: 100, left: 248 })
  })

  it('places the popover to the left when right space is insufficient', () => {
    const position = getHoverPopoverPosition(
      { top: 100, left: 980, right: 1180 },
      1280
    )
    expect(position).toEqual({ top: 100, left: 672 })
  })

  it('clamps the top to viewport padding when rect.top is near the top edge', () => {
    const position = getHoverPopoverPosition(
      { top: 2, left: 40, right: 240 },
      1280
    )
    expect(position).toEqual({ top: 8, left: 248 })
  })

  it('clamps left to viewport padding when fallback would go off-screen', () => {
    const position = getHoverPopoverPosition(
      { top: 100, left: 100, right: 300 },
      320
    )
    expect(position).toEqual({ top: 100, left: 8 })
  })

  it('prefers right when both sides have equal space', () => {
    const position = getHoverPopoverPosition(
      { top: 200, left: 340, right: 640 },
      1280
    )
    expect(position).toEqual({ top: 200, left: 648 })
  })

  it('falls back to left when right space is less than popover width', () => {
    const position = getHoverPopoverPosition(
      { top: 100, left: 600, right: 1000 },
      1280
    )
    expect(position).toEqual({ top: 100, left: 292 })
  })

  it('handles narrow viewport where popover barely fits', () => {
    const position = getHoverPopoverPosition(
      { top: 50, left: 8, right: 100 },
      316
    )
    expect(position).toEqual({ top: 50, left: 8 })
  })
})
