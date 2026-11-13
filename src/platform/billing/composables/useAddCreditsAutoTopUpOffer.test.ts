import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { computed, effectScope } from 'vue'

import type { SavedPaymentMethod } from '@comfyorg/billing-core'
import { reportError } from '@comfyorg/telemetry/reportError'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { activateBillingScope } from '@/platform/billing/__tests__/activateBillingScope'
import {
  autoTopUpCard,
  loadedAutoTopUp
} from '@/platform/billing/composables/__mocks__/useBillingAutoTopUpCard'
import {
  autoTopUpEnabledFact,
  canManageAutoTopUpFact
} from '@/platform/billing/composables/__mocks__/useBillingCapabilities'
import { useAddCreditsAutoTopUpOffer } from '@/platform/billing/composables/useAddCreditsAutoTopUpOffer'
import { useBillingAutoTopUpCard } from '@/platform/billing/composables/useBillingAutoTopUpCard'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingSdkStore } from '@/platform/billing/sdk/billingSdkStore'

vi.mock(import('firebase/auth'), { spy: true })
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
vi.mock(import('@/platform/billing/composables/useBillingAutoTopUpCard'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@comfyorg/telemetry/reportError'))

const visa: SavedPaymentMethod = {
  id: 'pm_visa',
  type: 'card',
  brand: 'visa',
  last4: '4242',
  is_default: true
}
const mastercard: SavedPaymentMethod = {
  id: 'pm_mc',
  type: 'card',
  brand: 'mastercard',
  last4: '5555',
  is_default: false
}

function serveSavedMethods(methods: SavedPaymentMethod[]) {
  vi.mocked(useBillingSdkStore().readPaymentMethods).mockResolvedValue({
    status: 'ok',
    value: methods
  })
}
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
  vi.mocked(useBillingAutoTopUpCard).mockReturnValue(
    autoTopUpCard(loadedAutoTopUp(status))
  )
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  return scope.run(useAddCreditsAutoTopUpOffer)!
}

describe('useAddCreditsAutoTopUpOffer', () => {
  beforeEach(() => {
    activateBillingScope('actor-a', 'workspace-a')
    serveSavedMethods([])
  })

  it('says auto top-up is on with a link to Billing when the served status is on', () => {
    const { offer, billingUrl } = offerFor({ status: 'on' })

    expect(offer.value).toEqual({ kind: 'on' })
    expect(billingUrl.value).toBe('https://platform.test/profile/billing')
  })

  it('offers hidden while off when auto top-up at checkout is off, leaving the after-payment suggestion', async () => {
    const { offer } = offerFor({ status: 'off', atCheckout: false })

    await vi.waitFor(() => expect(offer.value.kind).toBe('hidden'))
  })

  it('shows nothing when the auto top-up rollout is off', () => {
    expect(
      offerFor({ status: 'on', rollout: false, atCheckout: true }).offer.value
    ).toEqual({ kind: 'hidden' })
  })

  describe('the consent card at checkout', () => {
    it.for([
      {
        name: 'names the default card when the workspace has one',
        methods: [mastercard, visa],
        defaultCard: { brand: 'visa', last4: '4242' }
      },
      {
        name: 'says there is no default card when none is marked default',
        methods: [mastercard],
        defaultCard: null
      },
      {
        name: 'says there is no default card when there are no saved cards',
        methods: [],
        defaultCard: null
      }
    ])('$name', async ({ methods, defaultCard }) => {
      serveSavedMethods(methods)
      const { offer } = offerFor({ status: 'off', atCheckout: true })

      await vi.waitFor(() =>
        expect(offer.value).toMatchObject({ kind: 'checkbox', defaultCard })
      )
    })

    it('offers no checkbox and reports when the saved cards read fails', async () => {
      vi.mocked(useBillingSdkStore().readPaymentMethods).mockResolvedValue({
        status: 'error',
        code: 'REQUEST_FAILED'
      })
      const { offer } = offerFor({ status: 'off', atCheckout: true })

      await vi.waitFor(() => expect(reportError).toHaveBeenCalledOnce())
      expect(offer.value).toEqual({ kind: 'hidden' })
    })

    it('offers no checkbox when the default is not one it can name as a card', async () => {
      serveSavedMethods([
        { id: 'pm_bank', type: 'us_bank_account', is_default: true }
      ])
      const { offer } = offerFor({ status: 'off', atCheckout: true })

      await vi.waitFor(() =>
        expect(useBillingSdkStore().readPaymentMethods).toHaveBeenCalledOnce()
      )
      await Promise.resolve()
      expect(offer.value).toEqual({ kind: 'hidden' })
      expect(reportError).not.toHaveBeenCalled()
    })

    it('offers no checkbox while the saved cards read is in flight', () => {
      vi.mocked(useBillingSdkStore().readPaymentMethods).mockReturnValue(
        new Promise(() => {})
      )

      expect(offerFor({ status: 'off', atCheckout: true }).offer.value).toEqual(
        { kind: 'hidden' }
      )
    })

    it('reads no saved cards when auto top-up at checkout is off', () => {
      offerFor({ status: 'off', atCheckout: false })

      expect(useBillingSdkStore().readPaymentMethods).not.toHaveBeenCalled()
    })
  })
})
