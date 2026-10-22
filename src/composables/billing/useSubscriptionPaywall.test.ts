import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import type { BillingType } from '@/composables/billing/types'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useBillingDialogs } from '@/composables/billing/useBillingDialogs'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'

import { useSubscriptionPaywall } from './useSubscriptionPaywall'

vi.mock(import('@/composables/billing/useBillingContext'))
vi.mock(import('@/composables/billing/useBillingDialogs'))
vi.mock(
  import('@/platform/cloud/subscription/composables/useSubscriptionDialog')
)

const options = { reason: 'subscribe_to_run' } as const

function billingOn(type: () => BillingType) {
  const billing = useBillingContext()
  vi.mocked(useBillingContext).mockReturnValue(billing)
  billing.type = computed(type)
  return billing
}

describe('useSubscriptionPaywall', () => {
  it.for([
    { type: 'workspace' as const, pricing: [[options]], gated: [] },
    { type: 'legacy' as const, pricing: [], gated: [[options]] }
  ])(
    'opens the $type paywall at once when the type is known',
    ({ type, pricing, gated }) => {
      billingOn(() => type)

      useSubscriptionPaywall().showSubscriptionDialog(options)

      expect(vi.mocked(useSubscriptionDialog().show).mock.calls).toEqual(
        pricing
      )
      expect(
        vi.mocked(useBillingDialogs().showSubscriptionRequiredDialog).mock.calls
      ).toEqual(gated)
    }
  )

  it('waits for the workspace type, then opens the paywall of the rail that loaded', async () => {
    const type = ref<BillingType>('unknown')
    const billing = billingOn(() => type.value)
    let routingKnown!: (known: boolean) => void
    const routing = new Promise<boolean>((resolve) => {
      routingKnown = resolve
    })
    vi.mocked(billing.whenRoutingKnown).mockReturnValue(routing)

    useSubscriptionPaywall().showSubscriptionDialog(options)
    expect(useSubscriptionDialog().show).not.toHaveBeenCalled()

    type.value = 'workspace'
    routingKnown(true)
    await routing

    expect(vi.mocked(useSubscriptionDialog().show).mock.calls).toEqual([
      [options]
    ])
    expect(
      useBillingDialogs().showSubscriptionRequiredDialog
    ).not.toHaveBeenCalled()
  })

  it('drops the click when the workspace type never loads', async () => {
    const billing = billingOn(() => 'unknown')
    const routing = Promise.resolve(false)
    vi.mocked(billing.whenRoutingKnown).mockReturnValue(routing)

    useSubscriptionPaywall().showSubscriptionDialog(options)
    await routing

    expect(useSubscriptionDialog().show).not.toHaveBeenCalled()
    expect(
      useBillingDialogs().showSubscriptionRequiredDialog
    ).not.toHaveBeenCalled()
  })
})
