import { vi } from 'vitest'

import { useBillingContext } from '@/platform/billing/composables/useBillingContext'

export function mockBillingContext() {
  const billing = useBillingContext()
  vi.mocked(useBillingContext).mockReturnValue(billing)
  return billing
}
