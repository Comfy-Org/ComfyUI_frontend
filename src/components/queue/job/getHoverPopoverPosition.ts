const POPOVER_GAP = 8
const POPOVER_WIDTH = 300
const VIEWPORT_PADDING = 8

type AnchorRect = Pick<DOMRect, 'top' | 'left' | 'right'>

type HoverPopoverPosition = {
  top: number
  left: number
}

export function getHoverPopoverPosition(
  rect: AnchorRect,
  viewportWidth: number
): HoverPopoverPosition {
  const availableLeft = rect.left - POPOVER_GAP
  const availableRight = viewportWidth - rect.right - POPOVER_GAP
  const preferredLeft = rect.right + POPOVER_GAP
  const fallbackLeft = rect.left - POPOVER_WIDTH - POPOVER_GAP
  const maxLeft = Math.max(
    VIEWPORT_PADDING,
    viewportWidth - POPOVER_WIDTH - VIEWPORT_PADDING
  )

  if (
    availableRight >= POPOVER_WIDTH &&
    (availableRight >= availableLeft || availableLeft < POPOVER_WIDTH)
  ) {
    return {
      top: Math.max(VIEWPORT_PADDING, rect.top),
      left: Math.min(maxLeft, preferredLeft)
    }
  }

  return {
    top: Math.max(VIEWPORT_PADDING, rect.top),
    left: Math.max(VIEWPORT_PADDING, Math.min(maxLeft, fallbackLeft))
  }
}
