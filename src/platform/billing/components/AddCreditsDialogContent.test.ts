import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import type { HostedTopupCheckout } from '@comfyorg/ingest-types'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { readAutoTopUpActivation } from '@/platform/billing/addCredits/autoTopUpActivation'
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
import { useBillingSdkStore } from '@/platform/billing/sdk/billingSdkStore'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { mockBillingContext } from '@/utils/__tests__/mockBillingContext'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'

import type { watchForTopupBalanceUpdate } from '@/platform/billing/composables/topupBalanceRefresh'

import AddCreditsDialogContent from './AddCreditsDialogContent.vue'

type BalanceIncreased = Parameters<
  typeof watchForTopupBalanceUpdate
>[0]['onBalanceIncreased']

const RETURN_URL = 'https://billing.comfy.org/return/topup'
const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_1'

const hoisted = vi.hoisted(() => ({
  createHostedCheckout: vi.fn(),
  balanceIncreased: undefined as BalanceIncreased
}))

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/platform/billing/api/billingApi'))
vi.mock(import('@/platform/billing/addCredits/autoTopUpActivation'), {
  spy: true
})
vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
vi.mock(import('@/platform/billing/composables/useBillingAutoTopUpCard'))
vi.mock(import('@/platform/workspace/utils/platformLink'), () => ({
  platformLink: (path) => `https://platform.test${path}`
}))
vi.mock(
  import('@/platform/billing/composables/useTopupOperation'),
  async () => {
    const { computed } = await import('vue')
    return {
      useTopupOperation: () => ({
        billingClient: 'sdk',
        isAddingCredits: computed(() => false),
        topupOperation: computed(() => undefined),
        topup: vi.fn(),
        createHostedCheckout: hoisted.createHostedCheckout,
        dismissOperation: vi.fn(),
        adoptPendingOperation: vi.fn(),
        quoteTopup: async () => 10_550
      })
    }
  }
)
vi.mock(
  import('@/platform/billing/composables/useProcessingTopupPayment'),
  async () => {
    const { computed } = await import('vue')
    return {
      useProcessingTopupPayment: () => ({ payment: computed(() => null) })
    }
  }
)
vi.mock(
  import('@/platform/billing/composables/useAutoTopUpSetupOffer'),
  () => ({
    useAutoTopUpSetupOffer: () => ({
      setupUrl: async () => null,
      track: vi.fn(),
      trackDeclined: vi.fn()
    })
  })
)
vi.mock(
  import('@/platform/billing/composables/useTopUpPlanCreditCopy'),
  async () => {
    const { computed } = await import('vue')
    return { useAddCreditsPlanLine: () => computed(() => undefined) }
  }
)
vi.mock(import('@/platform/billing/composables/usePendingTopup'), () => ({
  usePendingTopup: () => ({
    startPendingTopup: vi.fn(),
    consumeCompletedTopup: vi.fn(),
    pendingTopupNeedsRefresh: vi.fn(),
    clearPendingTopup: vi.fn()
  })
}))
vi.mock(import('@/platform/billing/composables/topupBalanceRefresh'), () => ({
  watchForTopupBalanceUpdate: ({ onBalanceIncreased }) => {
    hoisted.balanceIncreased = onBalanceIncreased
    return () => {}
  }
}))
vi.mock(import('@/platform/billing/topupCheckoutReturnUrl'), () => ({
  topupCheckoutReturnUrl: () => RETURN_URL
}))
vi.mock(import('@/platform/billing/billingTab'), () => ({
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
  vi.mocked(useBillingSdkStore().readPaymentMethods).mockResolvedValue({
    status: 'ok',
    value: []
  })
  mockBillingContext()
  const { unmount } = render(AddCreditsDialogContent, {
    global: { plugins: [i18n] }
  })
  return { user: userEvent.setup(), unmount }
}

const ACTIVATED_CHECKOUT: Partial<HostedTopupCheckout> = {
  auto_top_up_activation: 'on',
  auto_top_up: {
    threshold_credits: 1000,
    target_credits: 11_550,
    monthly_budget_cents: 6_000_000,
    monthly_budget_is_default: true
  }
}

function switchWorkspaceInThisTab() {
  const workspaces = useTeamWorkspaceStore()
  const identity = workspaces.identityGeneration
  const transition = workspaces.workspaceTransitionGeneration
  vi.spyOn(workspaceApi, 'list').mockReturnValue(new Promise(() => {}))
  void workspaces.switchWorkspace('ws-other')
  expect(workspaces.identityGeneration).toBe(identity)
  expect(workspaces.workspaceTransitionGeneration).toBe(transition + 1)
}

const checkbox = () =>
  screen.queryByRole('checkbox', { name: /Turn on auto top-up/ })
const continueButton = () => screen.getByRole('button', { name: 'Continue' })

async function payWithAutoTopUp(served: Partial<HostedTopupCheckout>) {
  const rendered = renderDialog({ atCheckout: true })
  vi.mocked(billingApi.getTopupCheckout).mockResolvedValue(
    servedCheckout(served)
  )
  await rendered.user.click(
    await screen.findByRole('checkbox', { name: /Turn on auto top-up/ })
  )
  await rendered.user.click(continueButton())
  await waitFor(() => expect(hoisted.balanceIncreased).toBeDefined())
  return rendered
}

describe('AddCreditsDialogContent auto top-up with the purchase', () => {
  beforeEach(() => {
    stubFirebaseAuthHarness()
    hoisted.balanceIncreased = undefined
    hoisted.createHostedCheckout.mockResolvedValue({
      url: CHECKOUT_URL,
      sessionId: 'cs_1'
    })
  })

  it('offers no checkbox and sends no settings with billing_auto_top_up_at_checkout_enabled off', async () => {
    const { user } = renderDialog({ atCheckout: false })
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
    await payWithAutoTopUp(ACTIVATED_CHECKOUT)
    await hoisted.balanceIncreased!()

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
    expect(billingApi.getTopupCheckout).toHaveBeenCalledWith(
      'cs_1',
      expect.any(AbortSignal)
    )
    expect(
      await screen.findByTestId('add-credits-auto-top-up-on')
    ).toBeVisible()
  })

  it('shows the served activation failure', async () => {
    await payWithAutoTopUp({ auto_top_up_activation: 'failed' })
    await hoisted.balanceIncreased!()

    expect(
      await screen.findByTestId('add-credits-auto-top-up-failed')
    ).toBeVisible()
    expect(screen.queryByTestId('add-credits-auto-top-up-on')).toBeNull()
  })

  it('stops reading a pending activation once the dialog unmounts', async () => {
    const { unmount } = await payWithAutoTopUp({
      auto_top_up_activation: 'pending'
    })
    vi.useFakeTimers()
    const landing = hoisted.balanceIncreased!()
    await vi.advanceTimersByTimeAsync(0)
    expect(billingApi.getTopupCheckout).toHaveBeenCalledTimes(1)

    unmount()
    await vi.runAllTimersAsync()
    await landing

    expect(billingApi.getTopupCheckout).toHaveBeenCalledTimes(1)
  })

  it('mints no second checkout once the payment landed and its activation is still being read', async () => {
    const { user } = await payWithAutoTopUp({})
    let serve!: (checkout: HostedTopupCheckout) => void
    vi.mocked(billingApi.getTopupCheckout).mockReturnValue(
      new Promise((resolve) => {
        serve = resolve
      })
    )
    const landing = hoisted.balanceIncreased!()
    await waitFor(() =>
      expect(billingApi.getTopupCheckout).toHaveBeenCalledOnce()
    )

    await user.click(screen.getByTestId('add-credits-reopen'))

    expect(hoisted.createHostedCheckout).toHaveBeenCalledOnce()
    expect(screen.getByTestId('add-credits-reopen')).toBeDisabled()
    serve(servedCheckout({ auto_top_up_activation: 'not_attempted' }))
    await landing
  })

  it('drops a pending activation read once this tab switches workspace', async () => {
    await payWithAutoTopUp({})
    let serve!: (checkout: HostedTopupCheckout) => void
    vi.mocked(billingApi.getTopupCheckout).mockReturnValue(
      new Promise((resolve) => {
        serve = resolve
      })
    )
    const landing = hoisted.balanceIncreased!()
    await waitFor(() =>
      expect(billingApi.getTopupCheckout).toHaveBeenCalledOnce()
    )

    switchWorkspaceInThisTab()
    serve(servedCheckout(ACTIVATED_CHECKOUT))
    await landing

    expect(screen.queryByTestId('add-credits-auto-top-up-on')).toBeNull()
    expect(billingApi.getTopupCheckout).toHaveBeenCalledOnce()
  })

  it('publishes no activation when the identity resets after the read settles', async () => {
    await payWithAutoTopUp({})
    vi.mocked(readAutoTopUpActivation).mockImplementationOnce(async () => {
      useTeamWorkspaceStore().resetForIdentityChange()
      return {
        status: 'on',
        settings: {
          threshold_credits: 1000,
          target_credits: 11_550,
          monthly_budget_cents: null
        }
      }
    })

    await hoisted.balanceIncreased!()
    await new Promise((resolve) => setTimeout(resolve))

    expect(screen.queryByTestId('add-credits-auto-top-up-on')).toBeNull()
  })

  it('drops a checkout minted for the workspace this tab left', async () => {
    const { user } = renderDialog({ atCheckout: true })
    vi.mocked(billingApi.getTopupCheckout).mockResolvedValue(
      servedCheckout(ACTIVATED_CHECKOUT)
    )
    let mint!: (session: { url: string; sessionId: string }) => void
    hoisted.createHostedCheckout.mockReturnValue(
      new Promise((resolve) => {
        mint = resolve
      })
    )
    await user.click(
      await screen.findByRole('checkbox', { name: /Turn on auto top-up/ })
    )
    await user.click(continueButton())
    await waitFor(() =>
      expect(hoisted.createHostedCheckout).toHaveBeenCalledOnce()
    )

    switchWorkspaceInThisTab()
    mint({ url: CHECKOUT_URL, sessionId: 'cs_1' })

    expect(await screen.findByText("Couldn't open checkout")).toBeVisible()
    expect(hoisted.balanceIncreased).toBeUndefined()
  })
})
