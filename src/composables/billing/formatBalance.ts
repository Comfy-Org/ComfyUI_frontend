import { formatCreditsFromCents } from '@/base/credits/comfyCredits'

/**
 * Formats a cent value to display credits.
 * Backend returns cents despite the *_micros naming convention.
 */
export function formatBalance(
  maybeCents: number | undefined,
  locale: string
): string {
  const cents = maybeCents ?? 0
  return formatCreditsFromCents({
    cents,
    locale,
    numberOptions: {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }
  })
}
