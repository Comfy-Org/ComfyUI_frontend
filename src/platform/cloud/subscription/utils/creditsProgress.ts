export interface CreditsProgress {
  /** Fraction (0–1) of the monthly allowance still remaining. */
  monthlyFraction: number
  /** Fraction (0–1) the additional (prepaid) credits occupy, stacked after monthly. */
  additionalFraction: number
}

const clampFraction = (value: number): number => Math.min(1, Math.max(0, value))

/**
 * Computes the two stacked segments of the credits progress bar. The track is
 * scaled to the monthly allowance; additional (prepaid) credits stack on top of
 * the remaining monthly credits without overflowing the track.
 */
export function computeCreditsProgress(
  monthlyRemaining: number,
  additional: number,
  monthlyTotal: number
): CreditsProgress {
  if (monthlyTotal <= 0) {
    return { monthlyFraction: 0, additionalFraction: 0 }
  }

  const monthlyFraction = clampFraction(monthlyRemaining / monthlyTotal)
  const additionalFraction = clampFraction(
    Math.min(additional / monthlyTotal, 1 - monthlyFraction)
  )

  return { monthlyFraction, additionalFraction }
}
