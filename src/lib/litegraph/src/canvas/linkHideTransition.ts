import type { RootGraphId } from '@/types/graphScopeId'
import type { LinkId } from '@/types/linkId'

export const LINK_HIDE_TRANSITION = {
  holdMs: 200,
  fadeMs: 200,
  dashOnWidths: 1.5,
  dashOffWidths: 1.5,
  labelPopMs: 150,
  labelPopFromScale: 0.9,
  labelPopOvershoot: 1.70158
} as const

function totalMs(): number {
  const { holdMs, fadeMs, labelPopMs } = LINK_HIDE_TRANSITION
  return holdMs + fadeMs + labelPopMs
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

/** Opacity of a link mid-transition, or `undefined` once its line has finished or never started. */
export function linkHideTransitionAlpha(
  rootGraphId: RootGraphId,
  linkId: LinkId,
  now: number
): number | undefined {
  const elapsed = elapsedSinceHide(rootGraphId, linkId, now)
  const { holdMs, fadeMs } = LINK_HIDE_TRANSITION
  if (elapsed === undefined || elapsed >= holdMs + fadeMs) return
  return elapsed <= holdMs ? 1 : 1 - (elapsed - holdMs) / fadeMs
}

/** Scale of a hidden link's labels as they pop in after the line fades; 1 when settled. */
export function linkHideLabelScale(
  rootGraphId: RootGraphId,
  linkId: LinkId,
  now: number
): number {
  const elapsed = elapsedSinceHide(rootGraphId, linkId, now)
  if (elapsed === undefined) return 1
  const { holdMs, fadeMs, labelPopMs, labelPopFromScale } = LINK_HIDE_TRANSITION
  const progress = Math.max(0, (elapsed - holdMs - fadeMs) / labelPopMs)
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
