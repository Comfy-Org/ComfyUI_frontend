import type { RootGraphId } from '@/types/graphScopeId'
import type { LinkId } from '@/types/linkId'

export const LINK_HIDE_EASINGS = {
  linear: (t: number) => t,
  easeOutCubic: (t: number) => 1 - (1 - t) ** 3,
  easeOutQuint: (t: number) => 1 - (1 - t) ** 5,
  easeOutBack: (t: number) => {
    const c1 = LINK_HIDE_TRANSITION.snapOvershoot
    return 1 + (c1 + 1) * (t - 1) ** 3 + c1 * (t - 1) ** 2
  },
  easeOutElastic: (t: number) => {
    if (t <= 0) return 0
    if (t >= 1) return 1
    const { elasticDecay, elasticFrequency } = LINK_HIDE_TRANSITION
    return (
      2 ** (-elasticDecay * t) *
        Math.sin((t * elasticFrequency - 0.75) * ((2 * Math.PI) / 3)) +
      1
    )
  },
  spring: (t: number) => {
    const { elasticDecay, elasticFrequency } = LINK_HIDE_TRANSITION
    const angle = elasticFrequency * t
    return (
      1 -
      Math.exp(-elasticDecay * t) *
        (Math.cos(angle) + (elasticDecay / elasticFrequency) * Math.sin(angle))
    )
  },
  easeOutBounce: (t: number) => {
    const n1 = 7.5625
    const d1 = 2.75
    if (t < 1 / d1) return n1 * t * t
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375
    return n1 * (t -= 2.625 / d1) * t + 0.984375
  }
} satisfies Record<string, (t: number) => number>

export type LinkHideEasing = keyof typeof LINK_HIDE_EASINGS
export type LinkHideStyle = 'dotted' | 'elastic'

export const LINK_HIDE_TRANSITION: {
  style: LinkHideStyle
  holdMs: number
  fadeMs: number
  dashOnWidths: number
  dashOffWidths: number
  snapMs: number
  snapEasing: LinkHideEasing
  snapOvershoot: number
  elasticDecay: number
  elasticFrequency: number
  labelPopMs: number
  labelPopDelayMs: number
  labelPopFromScale: number
  labelPopOvershoot: number
} = {
  style: 'dotted',
  holdMs: 200,
  fadeMs: 200,
  dashOnWidths: 1.5,
  dashOffWidths: 1.5,
  snapMs: 380,
  snapEasing: 'spring',
  snapOvershoot: 0.6,
  elasticDecay: 4.5,
  elasticFrequency: 5.5,
  labelPopMs: 150,
  labelPopDelayMs: 0,
  labelPopFromScale: 0.9,
  labelPopOvershoot: 1.70158
}

/** One frame of a link's hide transition: its opacity, and how far its two halves have snapped back toward their badges. */
export interface LinkHideFrame {
  style: LinkHideStyle
  alpha: number
  retract: number
}

function lineMs(): number {
  const { style, holdMs, fadeMs, snapMs } = LINK_HIDE_TRANSITION
  return style === 'elastic' ? snapMs : holdMs + fadeMs
}

function labelStartMs(): number {
  const { style, labelPopDelayMs } = LINK_HIDE_TRANSITION
  return style === 'elastic' ? labelPopDelayMs : lineMs()
}

function totalMs(): number {
  return Math.max(lineMs(), labelStartMs() + LINK_HIDE_TRANSITION.labelPopMs)
}

function easeOutBack(t: number): number {
  const c1 = LINK_HIDE_TRANSITION.labelPopOvershoot
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

const startedAtByRoot = new Map<RootGraphId, Map<LinkId, number>>()

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  )
}

/** Starts a render-only hide transition for each link, unless the user prefers reduced motion. */
export function startLinkHideTransitions(
  rootGraphId: RootGraphId,
  linkIds: Iterable<LinkId>,
  now: number
): void {
  if (prefersReducedMotion()) return
  const startedAt = startedAtByRoot.get(rootGraphId) ?? new Map()
  for (const linkId of linkIds) startedAt.set(linkId, now)
  if (startedAt.size > 0) startedAtByRoot.set(rootGraphId, startedAt)
}

export function clearRootLinkHideTransitions(
  rootGraphId: RootGraphId
): boolean {
  return startedAtByRoot.delete(rootGraphId)
}

export function cancelLinkHideTransition(
  rootGraphId: RootGraphId,
  linkId: LinkId
): boolean {
  const startedAt = startedAtByRoot.get(rootGraphId)
  if (!startedAt?.delete(linkId)) return false
  if (startedAt.size === 0) startedAtByRoot.delete(rootGraphId)
  return true
}

function elapsedSinceHide(
  rootGraphId: RootGraphId,
  linkId: LinkId,
  now: number
): number | undefined {
  const startedAt = startedAtByRoot.get(rootGraphId)?.get(linkId)
  if (startedAt === undefined) return
  const elapsed = now - startedAt
  if (elapsed < totalMs()) return elapsed
  cancelLinkHideTransition(rootGraphId, linkId)
}

/** The frame to draw for a link mid-transition, or `undefined` once its line has gone or never started. */
export function linkHideFrame(
  rootGraphId: RootGraphId,
  linkId: LinkId,
  now: number
): LinkHideFrame | undefined {
  const elapsed = elapsedSinceHide(rootGraphId, linkId, now)
  if (elapsed === undefined || elapsed >= lineMs()) return
  const { style, holdMs, fadeMs, snapMs, snapEasing } = LINK_HIDE_TRANSITION
  if (style === 'elastic') {
    return {
      style,
      alpha: 1,
      retract: LINK_HIDE_EASINGS[snapEasing](elapsed / snapMs)
    }
  }
  const alpha = elapsed <= holdMs ? 1 : 1 - (elapsed - holdMs) / fadeMs
  return { style, alpha, retract: 0 }
}

/** Scale of a hidden link's labels as they pop in: `undefined` before they appear, 1 once settled. */
export function linkHideLabelScale(
  rootGraphId: RootGraphId,
  linkId: LinkId,
  now: number
): number | undefined {
  const elapsed = elapsedSinceHide(rootGraphId, linkId, now)
  if (elapsed === undefined) return 1
  const sinceLabelStart = elapsed - labelStartMs()
  if (sinceLabelStart < 0) return
  const { labelPopMs, labelPopFromScale } = LINK_HIDE_TRANSITION
  const progress = Math.min(1, sinceLabelStart / labelPopMs)
  return labelPopFromScale + (1 - labelPopFromScale) * easeOutBack(progress)
}

export function hasLinkHideTransitions(
  rootGraphId: RootGraphId,
  now: number
): boolean {
  const startedAt = startedAtByRoot.get(rootGraphId)
  if (!startedAt) return false
  for (const [linkId, start] of startedAt) {
    if (now - start >= totalMs()) startedAt.delete(linkId)
  }
  if (startedAt.size > 0) return true
  startedAtByRoot.delete(rootGraphId)
  return false
}

export function linkHideDashPattern(lineWidth: number): number[] {
  const { dashOnWidths, dashOffWidths } = LINK_HIDE_TRANSITION
  return [lineWidth * dashOnWidths, lineWidth * dashOffWidths]
}
