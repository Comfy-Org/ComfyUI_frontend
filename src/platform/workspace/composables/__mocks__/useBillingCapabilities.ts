import { vi } from 'vitest'
import { computed } from 'vue'

import type { useBillingCapabilities as realUseBillingCapabilities } from '../useBillingCapabilities'

const capabilities: ReturnType<typeof realUseBillingCapabilities> = {
  canTopUp: computed(() => true),
  canSubscribeSelfServe: computed(() => false),
  canCancel: computed(() => false),
  canReactivate: computed(() => false),
  canChangeSeats: computed(() => false),
  canInviteMembers: computed(() => false),
  canDowngradeToPersonal: computed(() => false),
  isReady: computed(() => true),
  snapshotAuthoritative: computed(() => true),
  initialize: vi.fn(async () => {}),
  refresh: vi.fn(async () => {})
}

export const useBillingCapabilities = vi.fn<typeof realUseBillingCapabilities>(
  () => capabilities
)
