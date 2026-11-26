import type {
  BillingRecoverOptions,
  TopupPurchaseResult
} from '@comfyorg/account-core/billing'
import { matchesServerCode } from '@comfyorg/account-core/billing'

import type { CheckoutPageEvent } from '@/checkout/checkoutPage'

type EndedPurchaseCode =
  | 'PURCHASE_SUPERSEDED'
  | 'PURCHASE_EXPIRED'
  | 'PURCHASE_NOT_FOUND'

/** Follow the purchase's latest attempt, stop on one this page can no longer pay, or fail the re-read when the purchase is unreadable. */
export type PurchaseRecovery =
  | {
      readonly kind: 'follow'
      readonly options: Pick<BillingRecoverOptions, 'operation'>
    }
  | { readonly kind: 'ended'; readonly code: EndedPurchaseCode }
  | { readonly kind: 'unreadable'; readonly event: CheckoutPageEvent }

export function purchaseRecovery(read: TopupPurchaseResult): PurchaseRecovery {
  if (read.status === 'error')
    return 'serverCode' in read && matchesServerCode(read, 'PURCHASE_NOT_FOUND')
      ? { kind: 'ended', code: 'PURCHASE_NOT_FOUND' }
      : {
          kind: 'unreadable',
          event: { type: 'recheckFailed', code: read.code }
        }
  const { status, billingOpId } = read.value
  if (status === 'superseded')
    return { kind: 'ended', code: 'PURCHASE_SUPERSEDED' }
  if (status === 'expired') return { kind: 'ended', code: 'PURCHASE_EXPIRED' }
  return {
    kind: 'follow',
    options:
      billingOpId === undefined
        ? {}
        : { operation: { id: billingOpId, kind: 'topup' } }
  }
}
