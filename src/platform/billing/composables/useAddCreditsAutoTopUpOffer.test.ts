import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  autoTopUpCardState,
  loadedAutoTopUp
} from '@/platform/billing/composables/__mocks__/useBillingAutoTopUpCard'
import {
  autoTopUpEnabledFact,
  canManageAutoTopUpFact
} from '@/platform/billing/composables/__mocks__/useBillingCapabilities'
import { useAddCreditsAutoTopUpOffer } from '@/platform/billing/composables/useAddCreditsAutoTopUpOffer'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
vi.mock(import('@/platform/billing/composables/useBillingAutoTopUpCard'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/platform/workspace/utils/platformLink'), () => ({
  platformLink: (path: string) => `https://platform.test${path}`
}))

function offerFor({
  status,
  rollout = true,
  atCheckout = false
}: {
  status: Parameters<typeof loadedAutoTopUp>[0]
  rollout?: boolean
  atCheckout?: boolean
}) {
  vi.mocked(useFeatureFlags().flags).billingAutoTopUpAtCheckoutEnabled =
    atCheckout
  const capabilities = useBillingCapabilities()
  capabilities.autoTopUpEnabled = autoTopUpEnabledFact(rollout)
  capabilities.canManageAutoTopUp = canManageAutoTopUpFact(true)
  capabilities.autoTopUpSetup = computed(() => ({ state: 'ready' }))
  autoTopUpCardState.value = loadedAutoTopUp(status)
  return useAddCreditsAutoTopUpOffer()
}

describe('useAddCreditsAutoTopUpOffer', () => {
  it('says auto top-up is on with a link to Billing when the served status is on', () => {
    const { offer, billingUrl } = offerFor({ status: 'on' })

    expect(offer.value).toEqual({ kind: 'on' })
    expect(billingUrl.value).toBe('https://platform.test/profile/billing')
  })

  it.for([
    {
      name: 'auto top-up at checkout is on',
      atCheckout: true,
      kind: 'checkbox'
    },
    {
      name: 'auto top-up at checkout is off, leaving the after-payment suggestion',
      atCheckout: false,
      kind: 'hidden'
    }
  ])('offers $kind while off when $name', ({ atCheckout, kind }) => {
    expect(offerFor({ status: 'off', atCheckout }).offer.value.kind).toBe(kind)
  })

  it('shows nothing when the auto top-up rollout is off', () => {
    expect(
      offerFor({ status: 'on', rollout: false, atCheckout: true }).offer.value
    ).toEqual({ kind: 'hidden' })
  })
})
