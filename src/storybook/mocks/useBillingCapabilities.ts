import { computed, ref } from 'vue'

const canTopUpState = ref(true)
const canSubscribeSelfServeState = ref(false)

export function setCanTopUpMock(canTopUp: boolean) {
  canTopUpState.value = canTopUp
}

export function setCanSubscribeSelfServeMock(canSubscribeSelfServe: boolean) {
  canSubscribeSelfServeState.value = canSubscribeSelfServe
}

export function useBillingCapabilities() {
  return {
    canTopUp: computed(() => canTopUpState.value),
    canSubscribeSelfServe: computed(() => canSubscribeSelfServeState.value),
    isReady: computed(() => true),
    initialize: () => undefined,
    refresh: () => undefined
  }
}
