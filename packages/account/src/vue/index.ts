import { defineComponent, h, inject, onScopeDispose, readonly, ref } from 'vue'
import type { InjectionKey, Ref } from 'vue'
import { AccountError } from '../core/index.js'
import type {
  BillingBalanceResponse,
  BillingClient,
  Loadable
} from '../core/index.js'

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

function stateAttributes(state: Loadable<BillingBalanceResponse>) {
  return state.phase === 'error' ? { role: 'alert' } : undefined
}

const creditsDisplayRuntimeProps: ('source' | 'state' | 'provider')[] = [
  'source',
  'state',
  'provider'
]

export const CreditsDisplay = defineComponent(
  (props: CreditsDisplayProps) => {
    if (props.source === 'props') {
      if (!props.state) throw new MissingAccountProviderError()
      return () => {
        const state = props.state ?? { phase: 'empty' }
        return h('span', stateAttributes(state), renderState(state))
      }
    }
    const state = useCredits(props.provider)
    return () =>
      h('span', stateAttributes(state.value), renderState(state.value))
  },
  {
    name: 'CreditsDisplay',
    props: creditsDisplayRuntimeProps
  }
)

export { accountPackageId } from '../core/index.js'
