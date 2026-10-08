import { zBillingBalanceResponse } from '@comfyorg/ingest-types/zod'

export type BalanceRead = { cents: number } | { error: string }

export function readBalanceCents(body: unknown): BalanceRead {
  const parsed = zBillingBalanceResponse.safeParse(body)
  if (!parsed.success) return { error: 'Invalid billing balance response' }
  if (parsed.data.currency.toLowerCase() !== 'usd')
    return { error: 'Expected a USD billing balance' }
  const cents =
    parsed.data.effective_balance_micros ?? parsed.data.amount_micros
  return Number.isFinite(cents)
    ? { cents }
    : { error: 'Expected a finite billing balance' }
}
