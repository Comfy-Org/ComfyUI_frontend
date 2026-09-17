import { onTestFinished, vi } from 'vitest'
import { computed } from 'vue'

import type { useBillingCapabilities as realUseBillingCapabilities } from '../useBillingCapabilities'

const defaults: ReturnType<typeof realUseBillingCapabilities> = {
  canTopUp: computed(() => true),
  canSubscribeSelfServe: computed(() => false),
  canCancel: computed(() => false),
  canReactivate: computed(() => false),
  canChangeSeats: computed(() => false),
  canInviteMembers: computed(() => false),
  canDowngradeToPersonal: computed(() => false),
  isReady: computed(() => true),
  snapshotAuthoritative: computed(() => true),
  initialize: vi.fn(async () => undefined),
  refresh: vi.fn(async () => undefined)
}

const capabilities = { ...defaults }

export const useBillingCapabilities = vi.fn(() => {
  onTestFinished(() => {
    Object.assign(capabilities, defaults)
  })
  return capabilities
})
