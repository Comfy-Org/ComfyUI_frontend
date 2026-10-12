import type { RootGraphId } from '@/types/graphScopeId'
import type { LinkId } from '@/types/linkId'

export const LINK_HIDE_TRANSITION = {
  snapMs: 380,
  springDamping: 4.5,
  springFrequency: 5.5,
  labelPopMs: 150,
  labelPopFromScale: 0.9,
  labelPopOvershoot: 1.70158
} as const

const startedAtByRoot = new Map<RootGraphId, Map<LinkId, number>>()

/** A damped spring from 0 to 1 that starts at rest and recoils once, slightly, past 1. */
export function springEase(t: number): number {
  const { springDamping, springFrequency } = LINK_HIDE_TRANSITION
  const angle = springFrequency * t
  return (
    1 -
    Math.exp(-springDamping * t) *
      (Math.cos(angle) + (springDamping / springFrequency) * Math.sin(angle))
  )
}

function easeOutBack(t: number): number {
  const c1 = LINK_HIDE_TRANSITION.labelPopOvershoot
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

function totalMs(): number {
  const { snapMs, labelPopMs } = LINK_HIDE_TRANSITION
  return Math.max(snapMs, labelPopMs)
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
  const elapsed = Math.max(0, now - startedAt)
  if (elapsed < totalMs()) return elapsed
  cancelLinkHideTransition(rootGraphId, linkId)
}

/** How far each half of a hiding link has snapped back toward its socket, or `undefined` once the snap is over. */
export function linkHideSnap(
  rootGraphId: RootGraphId,
  linkId: LinkId,
  now: number
): number | undefined {
  const elapsed = elapsedSinceHide(rootGraphId, linkId, now)
  const { snapMs } = LINK_HIDE_TRANSITION
  if (elapsed === undefined || elapsed >= snapMs) return
  return springEase(elapsed / snapMs)
}

/** Scale of a hidden link's labels as they pop in alongside the snap; 1 once settled. */
export function linkHideLabelScale(
  rootGraphId: RootGraphId,
  linkId: LinkId,
  now: number
): number {
  const elapsed = elapsedSinceHide(rootGraphId, linkId, now)
  if (elapsed === undefined) return 1
  const { labelPopMs, labelPopFromScale } = LINK_HIDE_TRANSITION
  const progress = Math.min(1, elapsed / labelPopMs)
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
