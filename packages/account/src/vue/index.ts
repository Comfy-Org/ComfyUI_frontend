import { defineComponent, h, inject, onScopeDispose, readonly, ref } from 'vue'
import type { InjectionKey, PropType, Ref } from 'vue'
import { AccountError } from '../core/index'
import type {
  BillingBalanceResponse,
  BillingClient,
  Loadable
} from '../core/index'

export const billingClientKey: InjectionKey<BillingClient> =
  Symbol('billingClient')

export class MissingAccountProviderError extends AccountError {
  constructor() {
    super('No account billing provider is available')
  }
}

export function useCredits(
  explicit?: BillingClient
): Readonly<Ref<Loadable<BillingBalanceResponse>>> {
  const client = explicit ?? inject(billingClientKey)
  if (!client) throw new MissingAccountProviderError()
  const state = ref(client.getCreditsState())
  const unsubscribe = client.subscribeCredits((next) => {
    state.value = next
  })
  onScopeDispose(unsubscribe)
  return readonly(state)
}

export type CreditsDisplayProps =
  | {
      source: 'props'
      state: Loadable<BillingBalanceResponse>
      provider?: never
    }
  | { source: 'provider'; state?: never; provider?: BillingClient }

function renderState(state: Loadable<BillingBalanceResponse>) {
  if (state.phase === 'value') return String(state.value.balance)
  if (state.phase === 'error') return 'Error'
  if (state.phase === 'empty') return 'Empty'
  return 'Loading'
}

export const CreditsDisplay = defineComponent({
  name: 'CreditsDisplay',
  props: {
    source: { type: String as PropType<'props' | 'provider'>, required: true },
    state: {
      type: Object as PropType<Loadable<BillingBalanceResponse>>,
      required: false
    },
    provider: { type: Object as PropType<BillingClient>, required: false }
  },
  setup(props) {
    if (props.source === 'props') {
      if (!props.state) throw new MissingAccountProviderError()
      return () => h('span', renderState(props.state ?? { phase: 'empty' }))
    }
    const state = useCredits(props.provider)
    return () => h('span', renderState(state.value))
  }
})

export { accountPackageId } from '../core/index'
