import type {
  WebEntryBounceReason,
  WebEntryBounceTarget
} from '@comfyorg/account-core/billing'
import type {
  BillingEntry,
  BillingEntryErrorCode
} from '@comfyorg/billing-contract'

import { trackOncePerTab } from '@/telemetry/trackOncePerTab'

interface EntryBounce {
  readonly reason: WebEntryBounceReason
  readonly to: WebEntryBounceTarget
}

export function reportEntryReceived(entry: BillingEntry): void {
  trackOncePerTab({
    operation: 'web_entry',
    stage: 'received',
    outcome: 'pending',
    intent: entry.intent,
    product: entry.product,
    has_plan: entry.plan !== undefined,
    ...(entry.source === undefined
      ? {}
      : { payment_intent_source: entry.source }),
    ...(entry.correlationId === undefined
      ? {}
      : { correlation_id: entry.correlationId })
  })
}

export function reportEntryRejected(code: BillingEntryErrorCode): void {
  trackOncePerTab({
    operation: 'web_entry',
    stage: 'rejected',
    outcome: 'pending',
    error_code: code
  })
}

export function reportEntryBounced({ reason, to }: EntryBounce): void {
  trackOncePerTab({
    operation: 'web_entry',
    stage: 'bounced',
    outcome: 'pending',
    reason,
    to
  })
}
