import type { CoachPlacement } from './onboardingTours'

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

export type ResolvedPlacement = Exclude<CoachPlacement, 'auto'>

// Keeps the spotlight's 2px outline clear of the viewport edge.
const SPOTLIGHT_EDGE_INSET = 2
// Gap between the card and its target / the viewport edge.
const CARD_GAP = 16
// Keeps the card clear of the top bar.
const TOP_SAFE_INSET = 56
const CARD_TOP_NUDGE = 8

export const CARD_WIDTH = 300
export const VIEWPORT_MARGIN = 12
// Breathing room the spotlight glow adds around its target rect.
export const SPOTLIGHT_PAD = 8
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

/** `auto` lands the card on whichever horizontal side of the target has more room. */
export function resolvePlacement(
  placement: CoachPlacement,
  r: DOMRect,
  viewportWidth: number
): ResolvedPlacement {
  if (placement !== 'auto') return placement
  return viewportWidth - r.right >= r.left ? 'right' : 'left'
}

/** Top-left corner the card should sit at for a resolved placement. */
export function cardCorner(
  placement: ResolvedPlacement,
  r: DOMRect,
  cardHeight: number
): { x: number; y: number } {
  switch (placement) {
    case 'left':
      return {
        x: r.left - CARD_WIDTH - CARD_GAP,
        y: Math.max(TOP_SAFE_INSET, r.top + CARD_TOP_NUDGE)
      }
    case 'leftCenter':
      return {
        x: r.left - CARD_WIDTH - CARD_GAP,
        y: r.top + r.height / 2 - cardHeight / 2
      }
    case 'right':
      return { x: r.right + CARD_GAP, y: r.top + CARD_TOP_NUDGE }
    case 'bottom':
      return {
        x: r.left + r.width / 2 - CARD_WIDTH / 2,
        y: r.bottom + CARD_GAP
      }
    case 'center':
      return {
        x: r.left + r.width / 2 - CARD_WIDTH / 2,
        y: r.top + r.height / 2 - cardHeight / 2
      }
  }
  return placement satisfies never
}

/** Clamps a card corner so the card stays on screen below the top bar. */
export function clampCardPosition(
  corner: { x: number; y: number },
  cardHeight: number,
  viewport: Viewport
): { left: string; top: string } {
  return {
    left: `${Math.max(VIEWPORT_MARGIN, Math.min(corner.x, viewport.width - CARD_WIDTH - CARD_GAP))}px`,
    top: `${Math.max(TOP_SAFE_INSET, Math.min(corner.y, viewport.height - cardHeight - CARD_GAP))}px`
  }
}

/** Horizontal position for a centered card with no target, clamped on narrow viewports. */
export function noTargetCardLeft(viewportWidth: number): number {
  return Math.max(VIEWPORT_MARGIN, (viewportWidth - CARD_WIDTH) / 2)
}
