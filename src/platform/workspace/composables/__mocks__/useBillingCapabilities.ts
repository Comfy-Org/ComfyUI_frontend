import { onTestFinished, vi } from 'vitest'
import { computed } from 'vue'

import { receiveServerFact } from '@/platform/serverFacts/serverFact'
import type { useBillingCapabilities as realUseBillingCapabilities } from '../useBillingCapabilities'

const defaults: ReturnType<typeof realUseBillingCapabilities> = {
  canTopUp: computed(() => true),
  topUpDenial: computed(() => undefined),
  canManageBilling: computed(() =>
    receiveServerFact('can_manage_billing', true)
  ),
  canSubscribeSelfServe: computed(() => false),
  canCancel: computed(() => false),
  canReactivate: computed(() => false),
  canRevertScheduledChange: computed(() =>
    receiveServerFact('can_revert_scheduled_change', false)
  ),
  canChangeSeats: computed(() => false),
  canManageMembers: computed(() =>
    receiveServerFact('can_manage_members', false)
  ),
  canInviteMembers: computed(() =>
    receiveServerFact('can_invite_members', false)
  ),
  canDeleteWorkspace: computed(() =>
    receiveServerFact('can_delete_workspace', false)
  ),
  deleteWorkspaceDenial: computed(() => undefined),
  canLeaveWorkspace: computed(() =>
    receiveServerFact('can_leave_workspace', false)
  ),
  leaveWorkspaceDenial: computed(() => undefined),
  canDowngradeToPersonal: computed(() => false),
  isReady: computed(() => true),
  hasResolvedCapabilities: computed(() => true),
  snapshotAuthoritative: computed(() => true),
  initialize: vi.fn(async () => undefined),
  refresh: vi.fn(async () => undefined)
}

const capabilities = { ...defaults }

export function canManageBillingFact(granted: boolean) {
  return computed(() => receiveServerFact('can_manage_billing', granted))
}

export const useBillingCapabilities = vi.fn(() => {
  onTestFinished(() => {
    Object.assign(capabilities, defaults)
  })
  return capabilities
})
