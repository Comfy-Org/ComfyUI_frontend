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

const SPOTLIGHT_EDGE_INSET = 2

export const CARD_WIDTH = 300
export const VIEWPORT_MARGIN = 12
export const CARD_GAP = 16
// Kept tight so the spotlight glow doesn't spill onto an adjacent clickable control.
export const SPOTLIGHT_PAD = 4

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

export function noTargetCardLeft(viewportWidth: number): number {
  return Math.max(VIEWPORT_MARGIN, (viewportWidth - CARD_WIDTH) / 2)
}

const TOP_BAR_HEIGHT_VAR = '--comfy-topbar-height'

/** The top bar's height, read from the theme token, plus the standard gap. */
export function topSafeInset(): number {
  const root = document.documentElement
  const raw = getComputedStyle(root).getPropertyValue(TOP_BAR_HEIGHT_VAR).trim()
  const px = raw.endsWith('rem')
    ? parseFloat(raw) * parseFloat(getComputedStyle(root).fontSize)
    : parseFloat(raw)
  return (Number.isFinite(px) ? px : 0) + CARD_GAP
}
