export interface Viewport {
  width: number
  height: number
}

export interface BoxStyle {
  left: string
  top: string
  width: string
  height: string
}

// Keeps the spotlight's 2px outline clear of the viewport edge.
const SPOTLIGHT_EDGE_INSET = 2

export const CARD_WIDTH = 300
export const VIEWPORT_MARGIN = 12
// Gap between the card and its target / the viewport edge.
export const CARD_GAP = 16
// Keeps the card clear of the top bar.
export const TOP_SAFE_INSET = 56
// Breathing room the spotlight glow adds around its target rect. Kept tight so
// the glow doesn't spill onto an adjacent control the user might click.
export const SPOTLIGHT_PAD = 4
// Page dim: the spotlight's giant box-shadow and the no-target blocker fill.
export const SCRIM_COLOR = 'rgba(0,0,0,0.62)'

/** The spotlight box: the target rect grown by `pad`, clamped to the viewport. */
export function clampSpotlight(
  r: DOMRect,
  pad: number,
  viewport: Viewport
): BoxStyle {
  const left = Math.max(SPOTLIGHT_EDGE_INSET, r.left - pad)
  const top = Math.max(SPOTLIGHT_EDGE_INSET, r.top - pad)
  const right = Math.min(viewport.width - SPOTLIGHT_EDGE_INSET, r.right + pad)
  const bottom = Math.min(
    viewport.height - SPOTLIGHT_EDGE_INSET,
    r.bottom + pad
  )
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${Math.max(0, right - left)}px`,
    height: `${Math.max(0, bottom - top)}px`
  }
}

/**
 * A single polygon tracing the viewport then the target rect; the `evenodd`
 * fill-rule subtracts the inner loop, leaving a hole at the target's bounds.
 */
export function blockerClipPath(r: DOMRect): string {
  const x1 = `${r.left}px`
  const y1 = `${r.top}px`
  const x2 = `${r.right}px`
  const y2 = `${r.bottom}px`
  return `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${x1} ${y1}, ${x1} ${y2}, ${x2} ${y2}, ${x2} ${y1}, ${x1} ${y1})`
}

/** Horizontal position for a centered card with no target, clamped on narrow viewports. */
export function noTargetCardLeft(viewportWidth: number): number {
  return Math.max(VIEWPORT_MARGIN, (viewportWidth - CARD_WIDTH) / 2)
}
