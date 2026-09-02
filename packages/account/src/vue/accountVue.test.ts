import { render, screen } from '@testing-library/vue'
import { defineComponent, h, provide } from 'vue'
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

function billing(
  state: Loadable<BillingBalanceResponse>
): BillingClient & { unsubscribe: ReturnType<typeof vi.fn> } {
  const unsubscribe = vi.fn()
  return {
    unsubscribe,
    getCreditsState: () => state,
    subscribeCredits: () => unsubscribe,
    refreshCredits: async () => undefined
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

  it('TP-4: useCredits returns readonly ref and disposes subscription', () => {
    const client = billing({ phase: 'value', value: { balance: 7 } })
    const Child = defineComponent({
      setup() {
        const credits = useCredits()
        expect(credits.value.phase).toBe('value')
        return () => h('span')
      }
    })
    const Host = defineComponent({
      setup() {
        provide(billingClientKey, client)
        return () => h(Child)
      }
    })
    const result = render(Host)
    result.unmount()
    expect(client.unsubscribe).toHaveBeenCalledOnce()
  })
})
