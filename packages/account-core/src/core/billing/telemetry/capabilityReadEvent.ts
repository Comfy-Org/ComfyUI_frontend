import type { BillingFailed, BillingSucceeded } from './stages.js'

export type CapabilityReadBillingEvent = {
  operation: 'capability_read'
} & (BillingSucceeded | Pick<BillingFailed, 'stage' | 'outcome'>)
