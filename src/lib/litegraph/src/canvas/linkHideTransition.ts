import type { RootGraphId } from '@/types/graphScopeId'
import type { LinkId } from '@/types/linkId'

export const LINK_HIDE_TRANSITION = {
  holdMs: 350,
  fadeMs: 250,
  dashOnWidths: 2,
  dashOffWidths: 2
} as const

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

export function cancelLinkHideTransition(
  rootGraphId: RootGraphId,
  linkId: LinkId
): boolean {
  const startedAt = startedAtByRoot.get(rootGraphId)
  if (!startedAt?.delete(linkId)) return false
  if (startedAt.size === 0) startedAtByRoot.delete(rootGraphId)
  return true
}

/** Opacity of a link mid-transition, or `undefined` once it has finished or never started. */
export function linkHideTransitionAlpha(
  rootGraphId: RootGraphId,
  linkId: LinkId,
  now: number
): number | undefined {
  const startedAt = startedAtByRoot.get(rootGraphId)?.get(linkId)
  if (startedAt === undefined) return
  const elapsed = now - startedAt
  const { holdMs, fadeMs } = LINK_HIDE_TRANSITION
  if (elapsed >= holdMs + fadeMs) {
    cancelLinkHideTransition(rootGraphId, linkId)
    return
  }
  return elapsed <= holdMs ? 1 : 1 - (elapsed - holdMs) / fadeMs
}

export function hasLinkHideTransitions(
  rootGraphId: RootGraphId,
  now: number
): boolean {
  const startedAt = startedAtByRoot.get(rootGraphId)
  if (!startedAt) return false
  const { holdMs, fadeMs } = LINK_HIDE_TRANSITION
  for (const [linkId, start] of startedAt) {
    if (now - start >= holdMs + fadeMs) startedAt.delete(linkId)
  }
  if (startedAt.size > 0) return true
  startedAtByRoot.delete(rootGraphId)
  return false
}

export function linkHideDashPattern(lineWidth: number): number[] {
  const { dashOnWidths, dashOffWidths } = LINK_HIDE_TRANSITION
  return [lineWidth * dashOnWidths, lineWidth * dashOffWidths]
}
