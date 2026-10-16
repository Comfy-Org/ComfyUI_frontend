import { computed, reactive, ref } from 'vue'

import { receiveServerFact } from '@/platform/serverFacts/serverFact'

interface BillingCapabilitiesMockState {
  canSubscribeSelfServe: boolean
  canCancel: boolean
  canReactivate: boolean
  canChangeSeats: boolean
  canManageMembers: boolean
  canInviteMembers: boolean
  canDowngradeToPersonal: boolean
}

const canTopUpState = ref(true)
const defaultCapabilityState: BillingCapabilitiesMockState = {
  canSubscribeSelfServe: false,
  canCancel: true,
  canReactivate: true,
  canChangeSeats: true,
  canManageMembers: true,
  canInviteMembers: true,
  canDowngradeToPersonal: true
}
const capabilityState = reactive<BillingCapabilitiesMockState>({
  ...defaultCapabilityState
})

export function setCanTopUpMock(canTopUp: boolean) {
  canTopUpState.value = canTopUp
}

export function setBillingCapabilitiesMock(
  capabilities: Partial<BillingCapabilitiesMockState>
) {
  Object.assign(capabilityState, defaultCapabilityState, capabilities)
}

export function setCanSubscribeSelfServeMock(canSubscribeSelfServe: boolean) {
  capabilityState.canSubscribeSelfServe = canSubscribeSelfServe
}

export function useBillingCapabilities() {
  return {
    canTopUp: computed(() => canTopUpState.value),
    canSubscribeSelfServe: computed(
      () => capabilityState.canSubscribeSelfServe
    ),
    canCancel: computed(() => capabilityState.canCancel),
    canReactivate: computed(() => capabilityState.canReactivate),
    canChangeSeats: computed(() => capabilityState.canChangeSeats),
    canManageMembers: computed(() =>
      receiveServerFact('can_manage_members', capabilityState.canManageMembers)
    ),
    canInviteMembers: computed(() =>
      receiveServerFact('can_invite_members', capabilityState.canInviteMembers)
    ),
    canDowngradeToPersonal: computed(
      () => capabilityState.canDowngradeToPersonal
    ),
    isReady: computed(() => true),
    snapshotAuthoritative: computed(() => true),
    initialize: () => undefined,
    refresh: () => undefined
  }
}
