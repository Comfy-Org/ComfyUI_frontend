import { vi } from 'vitest'
import { computed } from 'vue'

import type { useBillingCapabilities as realUseBillingCapabilities } from '../useBillingCapabilities'

export const useBillingCapabilities = vi.fn<typeof realUseBillingCapabilities>(
  () => ({
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
  })
)
