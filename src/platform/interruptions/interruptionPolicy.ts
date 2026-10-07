export const INTERRUPTION_TIERS = [
  'blocking',
  'feedback',
  'announcement',
  'lifecycle',
  'research'
] as const

export type InterruptionTier = (typeof INTERRUPTION_TIERS)[number]

/**
 * `order` breaks ties inside a tier, lowest first. Without it two same-tier
 * surfaces that each yield to the other would both hide, then both reappear.
 */
export interface Interrupter {
  id: string
  tier: InterruptionTier
  order: number
}

export const SURFACES = {
  releaseToast: { tier: 'announcement', order: 0 },
  whatsNewPopup: { tier: 'announcement', order: 1 }
} as const satisfies Record<string, Omit<Interrupter, 'id'>>

export type SurfaceId = keyof typeof SURFACES

export type InterruptionDecision =
  | { kind: 'show' }
  | { kind: 'defer'; reason: 'outranked'; by: string }

function tierRank(tier: InterruptionTier): number {
  return INTERRUPTION_TIERS.indexOf(tier)
}

export function outranks(candidate: Interrupter, subject: Interrupter) {
  const candidateRank = tierRank(candidate.tier)
  const subjectRank = tierRank(subject.tier)
  return (
    candidateRank < subjectRank ||
    (candidateRank === subjectRank && candidate.order < subject.order)
  )
}

/**
 * A surface defers to any active interrupter that outranks it and shows
 * otherwise. Deferral is not a drop: the caller re-asks when the blocker leaves.
 */
export function decide(
  subject: Interrupter,
  active: readonly Interrupter[]
): InterruptionDecision {
  const blocker = active.find(
    (other) => other.id !== subject.id && outranks(other, subject)
  )
  return blocker
    ? { kind: 'defer', reason: 'outranked', by: blocker.id }
    : { kind: 'show' }
}
