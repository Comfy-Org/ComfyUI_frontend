import type { BillingBalance } from '@comfyorg/account-core/billing'

import type { BillingBalanceResponse } from '@comfyorg/billing-core'

import { asSafeNumber } from './safeInt64'

type TopupCap = Pick<
  BillingBalanceResponse,
  'max_topup_cents' | 'max_topup_credits'
>

function projectTopupCap(
  rawCents: bigint | undefined,
  rawCredits: bigint | undefined
): TopupCap {
  if (rawCents === undefined) return {}
  const max_topup_cents = asSafeNumber(rawCents)
  if (max_topup_cents === undefined) return {}
  if (rawCredits === undefined) return { max_topup_cents }
  const max_topup_credits = asSafeNumber(rawCredits)
  return max_topup_credits === undefined
    ? {}
    : { max_topup_cents, max_topup_credits }
}

/** The SDK's decoded balance in the host's shape, dropping a top-up cap a number cannot hold exactly. */
export function projectBillingBalance({
  max_topup_cents,
  max_topup_credits,
  ...balance
}: BillingBalance): BillingBalanceResponse {
  return {
    ...balance,
    ...projectTopupCap(max_topup_cents, max_topup_credits)
  }
}
