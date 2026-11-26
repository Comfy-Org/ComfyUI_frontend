import type { BillingFailed } from './stages'

export type CapabilityReadBillingEvent = {
  operation: 'capability_read'
} & Pick<BillingFailed, 'stage' | 'outcome'>
