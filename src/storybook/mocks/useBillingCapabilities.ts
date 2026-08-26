import { computed, ref } from 'vue'

const canTopUpState = ref(true)

export function setCanTopUpMock(canTopUp: boolean) {
  canTopUpState.value = canTopUp
}

export function useBillingCapabilities() {
  return {
    canTopUp: computed(() => canTopUpState.value),
    canSubscribeSelfServe: computed(() => false),
    isReady: computed(() => true),
    initialize: () => undefined,
    refresh: () => undefined
  }
}
