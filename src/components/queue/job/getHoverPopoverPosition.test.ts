import { describe, expect, it } from 'vitest'

import { getHoverPopoverPosition } from './getHoverPopoverPosition'

describe('getHoverPopoverPosition', () => {
  const viewportHeight = 800

  it('places the popover to the right when space is available', () => {
    const position = getHoverPopoverPosition(
      { top: 100, left: 40, right: 240 },
      1280,
      viewportHeight
    )
    expect(position).toEqual({ top: 100, left: 248, maxHeight: 692 })
  })

  it('places the popover to the left when right space is insufficient', () => {
    const position = getHoverPopoverPosition(
      { top: 100, left: 980, right: 1180 },
      1280,
      viewportHeight
    )
    expect(position).toEqual({ top: 100, left: 672, maxHeight: 692 })
  })

  it('clamps the top to viewport padding when rect.top is near the top edge', () => {
    const position = getHoverPopoverPosition(
      { top: 2, left: 40, right: 240 },
      1280,
      viewportHeight
    )
    expect(position).toEqual({ top: 8, left: 248, maxHeight: 784 })
  })

  it('clamps left to viewport padding when fallback would go off-screen', () => {
    const position = getHoverPopoverPosition(
      { top: 100, left: 100, right: 300 },
      320,
      viewportHeight
    )
    expect(position).toEqual({ top: 100, left: 8, maxHeight: 692 })
  })

  it('prefers right when both sides have equal space', () => {
    const position = getHoverPopoverPosition(
      { top: 200, left: 340, right: 640 },
      1280,
      viewportHeight
    )
    expect(position).toEqual({ top: 200, left: 648, maxHeight: 592 })
  })

  it('falls back to left when right space is less than popover width', () => {
    const position = getHoverPopoverPosition(
      { top: 100, left: 600, right: 1000 },
      1280,
      viewportHeight
    )
    expect(position).toEqual({ top: 100, left: 292, maxHeight: 692 })
  })

  it('handles narrow viewport where popover barely fits', () => {
    const position = getHoverPopoverPosition(
      { top: 50, left: 8, right: 100 },
      316,
      viewportHeight
    )
    expect(position).toEqual({ top: 50, left: 8, maxHeight: 742 })
  })

  it('constrains maxHeight when anchor is near the bottom of the viewport', () => {
    const position = getHoverPopoverPosition(
      { top: 700, left: 40, right: 240 },
      1280,
      viewportHeight
    )
    expect(position).toEqual({ top: 700, left: 248, maxHeight: 92 })
  })

  it('provides minimal maxHeight when anchor is at the very bottom', () => {
    const position = getHoverPopoverPosition(
      { top: 790, left: 40, right: 240 },
      1280,
      viewportHeight
    )
    expect(position).toEqual({ top: 790, left: 248, maxHeight: 2 })
  })

  it('provides full maxHeight when anchor is at the top of the viewport', () => {
    const position = getHoverPopoverPosition(
      { top: 8, left: 40, right: 240 },
      1280,
      viewportHeight
    )
    expect(position).toEqual({ top: 8, left: 248, maxHeight: 784 })
  })
})
