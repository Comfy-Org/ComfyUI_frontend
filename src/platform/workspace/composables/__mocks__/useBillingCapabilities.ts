import { onTestFinished, vi } from 'vitest'
import { computed } from 'vue'

import { receiveServerFact } from '@/platform/serverFacts/serverFact'
import type { useBillingCapabilities as realUseBillingCapabilities } from '../useBillingCapabilities'

const defaults: ReturnType<typeof realUseBillingCapabilities> = {
  canTopUp: computed(() => true),
  canSubscribeSelfServe: computed(() => false),
  canCancel: computed(() => false),
  canReactivate: computed(() => false),
  canChangeSeats: computed(() => false),
  canManageMembers: computed(() =>
    receiveServerFact('can_manage_members', false)
  ),
  canInviteMembers: computed(() =>
    receiveServerFact('can_invite_members', false)
  ),
  canDowngradeToPersonal: computed(() => false),
  isReady: computed(() => true),
  hasResolvedCapabilities: computed(() => true),
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
