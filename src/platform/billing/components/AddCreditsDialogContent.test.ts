import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import type { HostedTopupCheckout } from '@comfyorg/ingest-types'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { billingApi } from '@/platform/billing/api/billingApi'
import {
  autoTopUpCardState,
  loadedAutoTopUp
} from '@/platform/billing/composables/__mocks__/useBillingAutoTopUpCard'
import {
  autoTopUpEnabledFact,
  canManageAutoTopUpFact
} from '@/platform/billing/composables/__mocks__/useBillingCapabilities'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { mockBillingContext } from '@/utils/__tests__/mockBillingContext'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'

import AddCreditsDialogContent from './AddCreditsDialogContent.vue'

const RETURN_URL = 'https://billing.comfy.org/return/topup'
const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_1'

const hoisted = vi.hoisted(() => ({
  createHostedCheckout: vi.fn(),
  balanceIncreased: undefined as (() => Promise<unknown>) | undefined
}))

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/platform/billing/api/billingApi'))
vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
vi.mock(import('@/platform/billing/composables/useBillingAutoTopUpCard'))
vi.mock(import('@/platform/workspace/utils/platformLink'), () => ({
  platformLink: (path: string) => `https://platform.test${path}`
}))
vi.mock<unknown>(
  import('@/platform/billing/composables/useTopupOperation'),
  async () => {
    const { computed } = await import('vue')
    return {
      useTopupOperation: () => ({
        topupOperation: computed(() => null),
        createHostedCheckout: hoisted.createHostedCheckout,
        quoteTopup: async () => 10_550
      })
    }
  }
)
vi.mock<unknown>(
  import('@/platform/billing/composables/useProcessingTopupPayment'),
  async () => {
    const { computed } = await import('vue')
    return {
      useProcessingTopupPayment: () => ({ payment: computed(() => null) })
    }
  }
)
vi.mock<unknown>(
  import('@/platform/billing/composables/useAutoTopUpSetupOffer'),
  () => ({
    useAutoTopUpSetupOffer: () => ({
      setupUrl: async () => null,
      track: vi.fn(),
      trackDeclined: vi.fn()
    })
  })
)
vi.mock<unknown>(
  import('@/platform/billing/composables/useTopUpPlanCreditCopy'),
  async () => {
    const { computed } = await import('vue')
    return { useAddCreditsPlanLine: () => computed(() => undefined) }
  }
)
vi.mock<unknown>(
  import('@/platform/billing/composables/usePendingTopup'),
  () => ({
    usePendingTopup: () => ({
      startPendingTopup: vi.fn(),
      clearPendingTopup: vi.fn()
    })
  })
)
vi.mock<unknown>(
  import('@/platform/billing/composables/topupBalanceRefresh'),
  () => ({
    watchForTopupBalanceUpdate: ({
      onBalanceIncreased
    }: {
      onBalanceIncreased: () => Promise<unknown>
    }) => {
      hoisted.balanceIncreased = onBalanceIncreased
      return () => {}
    }
  })
)
vi.mock<unknown>(import('@/platform/billing/topupCheckoutReturnUrl'), () => ({
  topupCheckoutReturnUrl: () => RETURN_URL
}))
vi.mock<unknown>(import('@/platform/billing/billingTab'), () => ({
  reserveBillingTab: () => ({ navigate: vi.fn(), close: vi.fn() })
}))

vi.mock(import('firebase/auth'), { spy: true })

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function servedCheckout(
  fields: Partial<HostedTopupCheckout>
): HostedTopupCheckout {
  return {
    session_id: 'cs_1',
    amount_cents: 5000,
    payment_amount_cents: 5000,
    state: 'fulfilled',
    ...fields
  }
}

function renderDialog({ atCheckout }: { atCheckout: boolean }) {
  vi.mocked(useFeatureFlags().flags).billingAutoTopUpAtCheckoutEnabled =
    atCheckout
  const capabilities = useBillingCapabilities()
  capabilities.autoTopUpEnabled = autoTopUpEnabledFact(true)
  capabilities.canManageAutoTopUp = canManageAutoTopUpFact(true)
  capabilities.autoTopUpSetup = computed(() => ({ state: 'ready' }))
  autoTopUpCardState.value = loadedAutoTopUp('off')
  mockBillingContext()
  render(AddCreditsDialogContent, {
    global: { plugins: [i18n] }
  })
  return userEvent.setup()
}

const checkbox = () =>
  screen.queryByRole('checkbox', { name: /Turn on auto top-up/ })
const continueButton = () => screen.getByRole('button', { name: 'Continue' })

async function payWithAutoTopUp(served: Partial<HostedTopupCheckout>) {
  const user = renderDialog({ atCheckout: true })
  vi.mocked(billingApi.getTopupCheckout).mockResolvedValue(
    servedCheckout(served)
  )
  await user.click(checkbox()!)
  await user.click(continueButton())
  await waitFor(() => expect(hoisted.balanceIncreased).toBeDefined())
  await hoisted.balanceIncreased!()
}

describe('AddCreditsDialogContent auto top-up with the purchase', () => {
  beforeEach(() => {
    stubFirebaseAuthHarness()
    hoisted.balanceIncreased = undefined
    hoisted.createHostedCheckout.mockResolvedValue({
      url: CHECKOUT_URL,
      sessionId: 'cs_1'
    })
    vi.spyOn(billingApi, 'getTopupCheckout')
  })

  it('offers no checkbox and sends no settings with billing_auto_top_up_at_checkout_enabled off', async () => {
    const user = renderDialog({ atCheckout: false })
    expect(checkbox()).toBeNull()

    await user.click(continueButton())
    await waitFor(() => expect(hoisted.balanceIncreased).toBeDefined())
    await hoisted.balanceIncreased!()

    expect(hoisted.createHostedCheckout).toHaveBeenCalledWith(
      5000,
      RETURN_URL,
      expect.any(AbortSignal),
      undefined
    )
    expect(billingApi.getTopupCheckout).not.toHaveBeenCalled()
  })

  it('sends the checked settings and shows auto top-up on from the served checkout', async () => {
    await payWithAutoTopUp({
      auto_top_up_activation: 'on',
      auto_top_up: {
        threshold_credits: 1000,
        target_credits: 11_550,
        monthly_budget_cents: 6_000_000,
        monthly_budget_is_default: true
      }
    })

    expect(hoisted.createHostedCheckout).toHaveBeenCalledWith(
      5000,
      RETURN_URL,
      expect.any(AbortSignal),
      {
        threshold_credits: 1000,
        target_credits: 11_550,
        monthly_budget_cents: null
      }
    )
    expect(billingApi.getTopupCheckout).toHaveBeenCalledWith('cs_1')
    expect(
      await screen.findByTestId('add-credits-auto-top-up-on')
    ).toBeVisible()
  })

  it.for([
    { name: 'failed', served: { auto_top_up_activation: 'failed' } },
    {
      name: 'not_attempted',
      served: { auto_top_up_activation: 'not_attempted' }
    }
  ] as const)(
    'says auto top-up did not turn on when the checkout read reports $name',
    async ({ served }) => {
      await payWithAutoTopUp(served)

      expect(
        await screen.findByTestId('add-credits-auto-top-up-failed')
      ).toBeVisible()
      expect(screen.queryByTestId('add-credits-auto-top-up-on')).toBeNull()
    }
  )
})
