interface MonthlyCreditsUsage {
  /** Credits consumed from the monthly allowance (never negative). */
  used: number
  /** Credits left of the monthly allowance, clamped to `0..monthlyTotal`. */
  remaining: number
  /** Fraction (0–1) of the monthly allowance consumed — drives the bar fill. */
  usedFraction: number
}

/**
 * Computes monthly credit usage for the credits bar. `remaining` clamps to the
 * allowance, and `used` is its complement, so `used + remaining` always equals
 * `monthlyTotal` — a balance above the allowance cannot read as more left than
 * the plan grants.
 */
export function computeMonthlyUsage(
  monthlyRemaining: number,
  monthlyTotal: number
): MonthlyCreditsUsage {
  if (monthlyTotal <= 0) {
    return { used: 0, remaining: 0, usedFraction: 0 }
  }

  const remaining = Math.min(monthlyTotal, Math.max(0, monthlyRemaining))
  const used = monthlyTotal - remaining

  return { used, remaining, usedFraction: used / monthlyTotal }
}
