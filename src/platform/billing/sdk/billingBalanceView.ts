import type { BillingBalance } from '@comfyorg/account-core/billing'

import type { BillingBalanceResponse } from '@comfyorg/billing-core'

import { asSafeNumber } from './safeInt64'

interface TopupBound {
  cents?: number
  credits?: number
}

function projectTopupBound(
  rawCents: bigint | undefined,
  rawCredits: bigint | undefined
): TopupBound {
  if (rawCents === undefined) return {}
  const cents = asSafeNumber(rawCents)
  if (cents === undefined) return {}
  if (rawCredits === undefined) return { cents }
  const credits = asSafeNumber(rawCredits)
  return credits === undefined ? {} : { cents, credits }
}

/** The SDK's decoded balance in the host's shape, dropping a top-up bound a number cannot hold exactly. */
export function projectBillingBalance({
  max_topup_cents,
  max_topup_credits,
  min_topup_cents,
  min_topup_credits,
  ...balance
}: BillingBalance): BillingBalanceResponse {
  const max = projectTopupBound(max_topup_cents, max_topup_credits)
  const min = projectTopupBound(min_topup_cents, min_topup_credits)
  return {
    ...balance,
    ...(max.cents !== undefined && { max_topup_cents: max.cents }),
    ...(max.credits !== undefined && { max_topup_credits: max.credits }),
    ...(min.cents !== undefined && { min_topup_cents: min.cents }),
    ...(min.credits !== undefined && { min_topup_credits: min.credits })
  }
}
