import type { BillingFailed, BillingSucceeded } from './stages'

export type CapabilityReadBillingEvent = {
  operation: 'capability_read'
} & (BillingSucceeded | Pick<BillingFailed, 'stage' | 'outcome'>)
