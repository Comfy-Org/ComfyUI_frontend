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
/** Wide enough for the cursor glyph to sit centred between card and target. */
export const CURSOR_GAP = 40
/** The card's travel to a new target; whatever moves that target waits it out. */
export const CARD_GLIDE_MS = 300
// Kept tight so the spotlight glow doesn't spill onto an adjacent clickable control.
export const SPOTLIGHT_PAD = 4

export interface SpotlightRect {
  x: number
  y: number
  width: number
  height: number
}

export function clampSpotlightRect(
  r: DOMRect,
  pad: number,
  viewport: Viewport
): SpotlightRect {
  const left = Math.max(SPOTLIGHT_EDGE_INSET, r.left - pad)
  const top = Math.max(SPOTLIGHT_EDGE_INSET, r.top - pad)
  const right = Math.min(viewport.width - SPOTLIGHT_EDGE_INSET, r.right + pad)
  const bottom = Math.min(
    viewport.height - SPOTLIGHT_EDGE_INSET,
    r.bottom + pad
  )
  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top)
  }
}

export function clampSpotlight(
  r: DOMRect,
  pad: number,
  viewport: Viewport
): BoxStyle {
  const { x, y, width, height } = clampSpotlightRect(r, pad, viewport)
  return {
    left: `${x}px`,
    top: `${y}px`,
    width: `${width}px`,
    height: `${height}px`
  }
}

/** Under `fill-rule="evenodd"`, the hole subpath is what lets input through. */
export function hitRegionPath(
  viewport: Viewport,
  hole: SpotlightRect | null
): string {
  const outer = `M0 0H${viewport.width}V${viewport.height}H0Z`
  if (!hole) return outer
  const { x, y, width, height } = hole
  return `${outer}M${x} ${y}h${width}v${height}h${-width}Z`
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
