import { vi } from 'vitest'

import { useBillingContext } from '@/composables/billing/useBillingContext'

export function mockBillingContext() {
  const billing = useBillingContext()
  vi.mocked(useBillingContext).mockReturnValue(billing)
  return billing
}
