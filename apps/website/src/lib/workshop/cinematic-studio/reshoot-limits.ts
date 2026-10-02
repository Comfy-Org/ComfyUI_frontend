/**
 * How often one person may use Re-shoot, per rolling window. Generation is
 * the metered run; depth analysis is free, so it gets a ceiling of its own.
 * The page counts runs in the visitor's browser to warn before a refusal;
 * the app proxy's own limits still decide.
 */
export const RESHOOT_LIMITS = {
  generate: { runs: 3, windowMs: 60 * 60 * 1000 },
  depth: { runs: 3, windowMs: 60 * 60 * 1000 }
} as const

export type ReshootLimitKind = keyof typeof RESHOOT_LIMITS

export interface ReshootLimit {
  readonly runs: number
  readonly windowMs: number
}

export interface Allowance {
  readonly left: number
  readonly runs: number
  /** When the oldest counted run leaves the window, if none are left. */
  readonly nextAt?: number
}

/** The runs still allowed in the window ending now, from past run times. */
export function allowance(
  startedAt: readonly number[],
  limit: ReshootLimit,
  now: number
): Allowance {
  const recent = startedAt
    .filter((at) => at > now - limit.windowMs)
    .sort((a, b) => a - b)
  const left = Math.max(0, limit.runs - recent.length)
  return left > 0
    ? { left, runs: limit.runs }
    : {
        left,
        runs: limit.runs,
        nextAt: recent[recent.length - limit.runs] + limit.windowMs
      }
}

/** Keeps only the run times that can still count against the window. */
export function pruneRuns(
  startedAt: readonly number[],
  limit: ReshootLimit,
  now: number
): number[] {
  return startedAt.filter((at) => at > now - limit.windowMs)
}
