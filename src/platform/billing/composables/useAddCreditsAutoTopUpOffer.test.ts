import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { computed, effectScope } from 'vue'

import type { SavedPaymentMethod } from '@comfyorg/billing-core'
import { useTelemetry } from '@comfyorg/telemetry'
import { reportError } from '@comfyorg/telemetry/reportError'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { activateBillingScope } from '@/platform/billing/__tests__/activateBillingScope'
import { billingApi } from '@/platform/billing/api/billingApi'
import {
  autoTopUpCard,
  loadedAutoTopUp
} from '@/platform/billing/composables/__mocks__/useBillingAutoTopUpCard'
import {
  autoTopUpEnabledFact,
  canManageAutoTopUpFact
} from '@/platform/billing/composables/__mocks__/useBillingCapabilities'
import {
  useAddCreditsAutoTopUpOffer,
  usePrefetchAddCreditsAutoTopUpOffer
} from '@/platform/billing/composables/useAddCreditsAutoTopUpOffer'
import { useBillingAutoTopUpCard } from '@/platform/billing/composables/useBillingAutoTopUpCard'
import { openPlatformBillingHandoff } from '@/platform/billing/localBillingHandoff'
import {
  setLocalAutoTopUpAtCheckoutEnabled,
  setLocalBillingWebEnabled
} from '@/platform/billing/localBillingWebEnabled'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingSdkStore } from '@/platform/billing/sdk/billingSdkStore'

vi.mock(import('firebase/auth'), { spy: true })
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
vi.mock(import('@/platform/billing/composables/useBillingAutoTopUpCard'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/platform/billing/localBillingHandoff'))
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

  it('opens Platform billing through a handoff, and reports the click, once local billing uses one', () => {
    onTestFinished(() => setLocalBillingWebEnabled(false))
    const { offer, open } = offerFor({ status: 'on' })

    setLocalBillingWebEnabled(true)
    open()

    expect(offer.value).toEqual({ kind: 'on' })
    expect(openPlatformBillingHandoff).toHaveBeenCalledOnce()
    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        operation: 'platform_handoff',
        target: 'auto_top_up',
        action: 'manage'
      })
    )
  })

  it('offers hidden while off when auto top-up at checkout is off, leaving the after-payment suggestion', async () => {
    const { offer } = offerFor({ status: 'off', atCheckout: false })

    await vi.waitFor(() => expect(offer.value.kind).toBe('hidden'))
  })

  it('offers the checkbox through the local web handoff when Cloud serves auto top-up at checkout to the local account, reading saved cards on the local client', async () => {
    setLocalBillingWebEnabled(true)
    setLocalAutoTopUpAtCheckoutEnabled(true)
    onTestFinished(() => {
      setLocalBillingWebEnabled(false)
      setLocalAutoTopUpAtCheckoutEnabled(false)
    })
    vi.spyOn(billingApi, 'listSavedPaymentMethods').mockResolvedValue([visa])

    const { offer, activatesAtCheckout } = offerFor({
      status: 'off',
      atCheckout: false
    })

    await vi.waitFor(() =>
      expect(offer.value).toMatchObject({
        kind: 'checkbox',
        defaultCard: { brand: 'visa', last4: '4242' }
      })
    )
    expect(activatesAtCheckout()).toBe(true)
    expect(useBillingSdkStore().readPaymentMethods).not.toHaveBeenCalled()
  })

  it('hides the checkbox through the local handoff when Cloud does not serve auto top-up at checkout, whatever the Cloud flag says', async () => {
    setLocalBillingWebEnabled(true)
    onTestFinished(() => setLocalBillingWebEnabled(false))
    vi.spyOn(billingApi, 'listSavedPaymentMethods').mockResolvedValue([visa])

    const { offer, activatesAtCheckout } = offerFor({
      status: 'off',
      atCheckout: true
    })

    expect(activatesAtCheckout()).toBe(false)
    expect(billingApi.listSavedPaymentMethods).not.toHaveBeenCalled()
    expect(offer.value.kind).toBe('hidden')
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

    it('offers the checkbox at once from the saved cards an earlier read left, while the fresh read is in flight', () => {
      vi.mocked(
        useBillingSdkStore().savedPaymentMethodsSnapshot
      ).mockReturnValue([mastercard, visa])
      vi.mocked(useBillingSdkStore().readPaymentMethods).mockReturnValue(
        new Promise(() => {})
      )

      expect(
        offerFor({ status: 'off', atCheckout: true }).offer.value
      ).toMatchObject({
        kind: 'checkbox',
        defaultCard: { brand: 'visa', last4: '4242' }
      })
    })

    it('replaces the earlier default card with the fresh read', async () => {
      vi.mocked(
        useBillingSdkStore().savedPaymentMethodsSnapshot
      ).mockReturnValue([visa])
      serveSavedMethods([
        { ...visa, is_default: false },
        { ...mastercard, is_default: true }
      ])
      const { offer } = offerFor({ status: 'off', atCheckout: true })

      await vi.waitFor(() =>
        expect(offer.value).toMatchObject({
          kind: 'checkbox',
          defaultCard: { brand: 'mastercard', last4: '5555' }
        })
      )
    })

    it('reads no saved cards when auto top-up at checkout is off', () => {
      offerFor({ status: 'off', atCheckout: false })

      expect(useBillingSdkStore().readPaymentMethods).not.toHaveBeenCalled()
    })
  })
})

describe('usePrefetchAddCreditsAutoTopUpOffer', () => {
  beforeEach(() => {
    activateBillingScope('actor-a', 'workspace-a')
    serveSavedMethods([])
  })

  function prefetch({
    rollout,
    manages,
    atCheckout
  }: {
    rollout: boolean
    manages: boolean
    atCheckout: boolean
  }) {
    vi.mocked(useFeatureFlags().flags).billingAutoTopUpAtCheckoutEnabled =
      atCheckout
    const capabilities = useBillingCapabilities()
    capabilities.autoTopUpEnabled = autoTopUpEnabledFact(rollout)
    capabilities.canManageAutoTopUp = canManageAutoTopUpFact(manages)
    const card = autoTopUpCard()
    vi.mocked(useBillingAutoTopUpCard).mockReturnValue(card)
    const scope = effectScope()
    onTestFinished(() => scope.stop())
    scope.run(usePrefetchAddCreditsAutoTopUpOffer)
    return card
  }

  it.for<{
    case: string
    rollout: boolean
    manages: boolean
    atCheckout: boolean
    settings: boolean
    savedCards: boolean
  }>([
    {
      case: 'auto top-up and the checkout checkbox are served',
      rollout: true,
      manages: true,
      atCheckout: true,
      settings: true,
      savedCards: true
    },
    {
      case: 'the checkout checkbox is not served',
      rollout: true,
      manages: true,
      atCheckout: false,
      settings: true,
      savedCards: false
    },
    {
      case: 'auto top-up is not served',
      rollout: false,
      manages: true,
      atCheckout: true,
      settings: false,
      savedCards: false
    },
    {
      case: 'the actor cannot manage auto top-up',
      rollout: true,
      manages: false,
      atCheckout: true,
      settings: false,
      savedCards: false
    }
  ])(
    'starts only the reads the dialog will render from when $case',
    ({ rollout, manages, atCheckout, settings, savedCards }) => {
      const card = prefetch({ rollout, manages, atCheckout })

      expect(card.ensureRead).toHaveBeenCalledTimes(settings ? 1 : 0)
      expect(useBillingSdkStore().readPaymentMethods).toHaveBeenCalledTimes(
        savedCards ? 1 : 0
      )
    }
  )
})
