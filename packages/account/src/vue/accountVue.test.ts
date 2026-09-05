import { render, screen } from '@testing-library/vue'
import { defineComponent, h, nextTick, provide } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type {
  BillingClient,
  Loadable,
  BillingBalanceResponse
} from '../core/index'
import {
  CreditsDisplay,
  MissingAccountProviderError,
  billingClientKey,
  useCredits
} from './index'

function billing(state: Loadable<BillingBalanceResponse>): BillingClient & {
  publish(state: Loadable<BillingBalanceResponse>): void
  unsubscribe: ReturnType<typeof vi.fn>
} {
  const unsubscribe = vi.fn()
  let listener: ((state: Loadable<BillingBalanceResponse>) => void) | undefined
  return {
    unsubscribe,
    dispose: vi.fn(),
    getCreditsState: () => state,
    subscribeCredits: (next) => {
      listener = next
      return unsubscribe
    },
    refreshCredits: async () => undefined,
    publish: (next) => listener?.(next)
  }
}

describe('TP-4 Vue contract', () => {
  it.for([7, 0, -2])(
    'TP-4: CreditsDisplay preserves numeric balance %s',
    (balance) => {
      render(CreditsDisplay, {
        props: {
          source: 'props',
          state: { phase: 'value', value: { balance } }
        }
      })
      expect(screen.getByText(String(balance))).toBeTruthy()
    }
  )

  it('TP-4: missing provider throws MissingAccountProviderError', () => {
    expect(() =>
      render(CreditsDisplay, { props: { source: 'provider' } })
    ).toThrow(MissingAccountProviderError)
  })

  it('regression: CreditsDisplay marks errors as alerts', () => {
    render(CreditsDisplay, {
      props: {
        source: 'props',
        state: { phase: 'error', error: new Error('offline') }
      }
    })
    expect(screen.getByRole('alert').textContent).toBe('Error')
  })

  it('TP-4: useCredits reflects updates and disposes subscription', async () => {
    const client = billing({ phase: 'value', value: { balance: 7 } })
    const Child = defineComponent({
      setup() {
        const credits = useCredits()
        expect(credits.value.phase).toBe('value')
        return () => h('span', renderCredits(credits.value))
      }
    })
    const Host = defineComponent({
      setup() {
        provide(billingClientKey, client)
        return () => h(Child)
      }
    })
    const result = render(Host)
    client.publish({ phase: 'value', value: { balance: 0 } })
    await nextTick()
    expect(screen.getByText('0')).toBeTruthy()
    client.publish({ phase: 'error', error: new Error('offline') })
    await nextTick()
    expect(screen.getByText('error')).toBeTruthy()
    result.unmount()
    expect(client.unsubscribe).toHaveBeenCalledOnce()
  })
})

function renderCredits(state: Loadable<BillingBalanceResponse>) {
  if (state.phase === 'value') return String(state.value.balance)
  return state.phase
}
