interface MonthlyCreditsUsage {
  /** Credits consumed from the monthly allowance (never negative). */
  used: number
  /** Fraction (0–1) of the monthly allowance consumed — drives the bar fill. */
  usedFraction: number
}

/**
 * Computes monthly credit usage for the credits bar. The bar fills with the
 * consumed portion of the monthly allowance; `used` clamps at zero so a balance
 * that exceeds the nominal allowance (rolled-over credits) reads as nothing used.
 */
export function computeMonthlyUsage(
  monthlyRemaining: number,
  monthlyTotal: number
): MonthlyCreditsUsage {
  if (monthlyTotal <= 0) {
    return { used: 0, usedFraction: 0 }
  }

  const used = Math.min(
    monthlyTotal,
    Math.max(0, monthlyTotal - monthlyRemaining)
  )
  const usedFraction = Math.min(1, used / monthlyTotal)

  return { used, usedFraction }
}
