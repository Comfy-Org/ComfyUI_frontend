import { onScopeDispose, readonly, ref } from 'vue'
import type { Ref } from 'vue'
import type {
  BillingCommands,
  BillingState,
  BillingStep,
  ReasonKey,
  SubscribeRequest,
  TopupRequest
} from '../core/index.js'

export function useBillingOperation(
  commands: BillingCommands
): Readonly<Ref<BillingState>> {
  const state = ref(commands.getState())
  const unsubscribe = commands.subscribeState((next) => {
    state.value = next
  })
  onScopeDispose(unsubscribe)
  void commands.start()
  return readonly(state)
}
export function useCheckout(commands: BillingCommands) {
  const state = useBillingOperation(commands)
  let last: SubscribeRequest | undefined
  return {
    state,
    async submit(input: SubscribeRequest) {
      last = input
      await commands.subscribe(input)
    },
    async retry() {
      if (last) await commands.subscribe(last)
    }
  }
}
export function useTopUp(commands: BillingCommands) {
  const state = useBillingOperation(commands)
  let last: TopupRequest | undefined
  return {
    state,
    async submit(input: TopupRequest) {
      last = input
      await commands.topUp(input)
    },
    async retry() {
      if (last) await commands.topUp(last)
    }
  }
}
export interface CheckoutStepsProps {
  step: BillingStep
  reason?: ReasonKey
  copy?: Readonly<Record<string, string>>
  noChargeConfirmed?: boolean
  disabled?: boolean
}
