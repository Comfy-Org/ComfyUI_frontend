import { onTestFinished, vi } from 'vitest'
import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { receiveServerFact } from '@/platform/serverFacts/serverFact'
import type { useBillingCapabilities as realUseBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'

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
  canEditWorkspace: computed(() =>
    receiveServerFact('can_edit_workspace', true)
  ),
  canLeaveWorkspace: computed(() =>
    receiveServerFact('can_leave_workspace', false)
  ),
  leaveWorkspaceDenial: computed(() => undefined),
  canManageSubscription: computed(() =>
    receiveServerFact('can_manage_subscription', false)
  ),
  canDowngradeToPersonal: computed(() => false),
  canManageAutoTopUp: computed(() =>
    receiveServerFact('can_manage_auto_top_up', false)
  ),
  autoTopUpSetup: computed(() => null),
  paymentRecoveryAvailable: computed(() =>
    receiveServerFact('payment_recovery_available', false)
  ),
  runDeniedPaymentPastDue: computed(() =>
    receiveServerFact('denied_reasons.can_run_workflows', false)
  ),
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

export function paymentRecoveryAvailableFact(
  available: MaybeRefOrGetter<boolean>
) {
  return computed(() =>
    receiveServerFact('payment_recovery_available', toValue(available))
  )
}

export function runDeniedPaymentPastDueFact(
  deniedPastDue: MaybeRefOrGetter<boolean>
) {
  return computed(() =>
    receiveServerFact(
      'denied_reasons.can_run_workflows',
      toValue(deniedPastDue)
    )
  )
}

export const useBillingCapabilities = vi.fn(() => {
  onTestFinished(() => {
    Object.assign(capabilities, defaults)
  })
  return capabilities
})
