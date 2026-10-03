import type {
  BillingFailed,
  BillingStarted,
  BillingSucceeded
} from './stages.js'
import type { BillingTierKey } from './vocabulary.js'

export type DowngradeToPersonalBillingEvent = {
  operation: 'downgrade_to_personal'
  member_removal_count: number
  member_removal_failures: number
  target_tier?: BillingTierKey
  /**
   * Client-observed end-to-end wall time from this attempt's canonical
   * `started` event through to this terminal event.
   */
  duration_ms?: number
} & (BillingStarted | BillingSucceeded | BillingFailed)
