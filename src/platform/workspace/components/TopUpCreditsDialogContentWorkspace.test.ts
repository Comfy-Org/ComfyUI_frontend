import { useToast } from '@/components/ui/toast/toastStore'
import type { BalanceInfo } from '@/composables/billing/types'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { fakeBillingSdk } from '@/platform/workspace/billing/sdk/billingSdkTestUtils'
import type { BillingSdk } from '@/platform/workspace/billing/sdk/createBillingSdk'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import {
  clearCheckoutJourney,
  getActiveCheckoutJourney,
  resolveCheckoutJourney
} from '@/platform/workspace/utils/checkoutJourney'
import { useAuthStore } from '@/stores/authStore'
import { useDialogStore } from '@/stores/dialogStore'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useTelemetry } from '@/platform/telemetry'
import { TelemetryRegistry } from '@/platform/telemetry/TelemetryRegistry'
import { DatadogRumTelemetryProvider } from '@/platform/telemetry/providers/cloud/DatadogRumTelemetryProvider'
import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import {
  WorkspaceApiError,
  workspaceApi
} from '@/platform/workspace/api/workspaceApi'
import { provideCheckoutOperationReader } from '@/platform/workspace/billing/billingRefresh'
import { disarmHostedBillingReturnRefresh } from '@/platform/workspace/billing/openHostedBillingTab'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { mockBillingContext } from '@/utils/__tests__/mockBillingContext'

import TopUpCreditsDialogContentWorkspace from './TopUpCreditsDialogContentWorkspace.vue'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'

const mockRumAddAction = vi.hoisted(() => vi.fn())

vi.mock<unknown>(import('@datadog/browser-rum'), () => ({
  datadogRum: { addAction: mockRumAddAction }
}))

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

const mockDistributionTypes = vi.hoisted(() => ({
  isCloud: true,
  isDesktop: false
}))

vi.mock(import('@/platform/distribution/types'), () => mockDistributionTypes)

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))

vi.mock(import('@/platform/settings/composables/useSettingsDialog'))

vi.mock(import('@/platform/telemetry'))

vi.mock(import('@/composables/useFeatureFlags'))

const mockCreateBillingSdk = vi.hoisted(() => vi.fn<() => BillingSdk>())
vi.mock(import('@/platform/workspace/billing/sdk/createBillingSdk'), () => ({
  createBillingSdk: mockCreateBillingSdk
}))

vi.mock(import('firebase/auth'), { spy: true })

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const checkoutUrl = 'https://checkout.stripe.com/c/pay/cs_test'

function renderDialog(
  props: Partial<
    InstanceType<typeof TopUpCreditsDialogContentWorkspace>['$props']
  > = {}
) {
  mockBillingContext()
  return render(TopUpCreditsDialogContentWorkspace, {
    props,
    global: { plugins: [i18n] }
  })
}

function checkoutTab() {
  return { opener: window, location: { href: '' }, close: vi.fn() }
}

function stubCheckoutTab() {
  const tab = checkoutTab()
  const open = vi.spyOn(window, 'open').mockReturnValue(tab as never)
  return { tab, open }
}

function checkoutOpensAt(url: string) {
  return vi
    .spyOn(workspaceApi, 'createTopupCheckout')
    .mockResolvedValue({ checkout_url: url })
}

const continueButton = () =>
  screen.getByRole('button', { name: 'Continue to payment' })

async function continueToPayment(user = userEvent.setup()) {
  await user.click(continueButton())
}

const handOffHeading = () =>
  screen.findByRole('heading', { name: 'Checkout opened in a new tab' })

beforeEach(() => {
  stubFirebaseAuthHarness()
  mockDistributionTypes.isCloud = true
  vi.mocked(useDialogStore().closeDialog).mockImplementation(() => {})
  Object.assign(useAuthStore(), { userId: 'user-1' })
  Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-1' })
  sessionStorage.clear()
  clearCheckoutJourney()
})

afterEach(() => {
  disarmHostedBillingReturnRefresh()
})

describe('TopUpCreditsDialogContentWorkspace', () => {
  it('opens at the amount step and offers payment once capabilities allow it', async () => {
    const canTopUp = ref(false)
    useBillingCapabilities().canTopUp = computed(() => canTopUp.value)
    const create = checkoutOpensAt(checkoutUrl)
    stubCheckoutTab()
    renderDialog()

    expect(
      screen.getByRole('heading', { name: 'Add more credits' })
    ).toBeInTheDocument()
    expect(continueButton()).toBeDisabled()
    await continueToPayment()
    expect(create).not.toHaveBeenCalled()

    canTopUp.value = true
    await nextTick()
    expect(continueButton()).toBeEnabled()
  })

  it('opens the hosted checkout for the chosen amount and hands off to it', async () => {
    const create = checkoutOpensAt(checkoutUrl)
    const { tab, open } = stubCheckoutTab()
    renderDialog()

    await userEvent.click(screen.getByRole('button', { name: '$25' }))
    await continueToPayment()

    expect(await handOffHeading()).toBeInTheDocument()
    expect(
      screen.getByText(
        'Credits are added to this workspace as soon as your payment goes through.'
      )
    ).toBeInTheDocument()
    expect(create).toHaveBeenCalledExactlyOnceWith(2500, window.location.href)
    expect(open).toHaveBeenCalledExactlyOnceWith('', '_blank')
    expect(tab.location.href).toBe(checkoutUrl)
    expect(useDialogStore().closeDialog).not.toHaveBeenCalled()
  })

  it('never looks up or charges a saved card', async () => {
    vi.mocked(useFeatureFlags().flags).billingSdkTopupRailEnabled = false
    const listCards = vi.spyOn(workspaceApi, 'listSavedPaymentMethods')
    const charge = vi.spyOn(workspaceApi, 'createTopup')
    checkoutOpensAt(checkoutUrl)
    stubCheckoutTab()
    renderDialog()

    await continueToPayment()
    await handOffHeading()

    expect(listCards).not.toHaveBeenCalled()
    expect(charge).not.toHaveBeenCalled()
    expect(mockBillingContext().topup).not.toHaveBeenCalled()
  })

  it('closes from the hand-off screen', async () => {
    checkoutOpensAt(checkoutUrl)
    stubCheckoutTab()
    renderDialog()
    await continueToPayment()
    await handOffHeading()

    const [, closeButton] = screen.getAllByRole('button', { name: 'Close' })
    await userEvent.click(closeButton)

    expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
      key: 'top-up-credits'
    })
  })

  it('reopens checkout in a new tab with a fresh session', async () => {
    const freshCheckoutUrl = 'https://checkout.stripe.com/c/pay/cs_fresh'
    const create = vi
      .spyOn(workspaceApi, 'createTopupCheckout')
      .mockResolvedValueOnce({ checkout_url: checkoutUrl })
      .mockResolvedValueOnce({ checkout_url: freshCheckoutUrl })
    const firstTab = checkoutTab()
    const secondTab = checkoutTab()
    const open = vi
      .spyOn(window, 'open')
      .mockReturnValueOnce(firstTab as never)
      .mockReturnValueOnce(secondTab as never)
    renderDialog()
    await continueToPayment()
    await handOffHeading()

    await userEvent.click(
      screen.getByRole('button', { name: 'Reopen checkout' })
    )

    await waitFor(() => expect(secondTab.location.href).toBe(freshCheckoutUrl))
    expect(create).toHaveBeenCalledTimes(2)
    expect(open).toHaveBeenNthCalledWith(2, '', '_blank')
    expect(firstTab.location.href).toBe(checkoutUrl)
    expect(await handOffHeading()).toBeInTheDocument()
  })

  it('links to the fresh session when the reopened tab is blocked', async () => {
    const freshCheckoutUrl = 'https://checkout.stripe.com/c/pay/cs_fresh'
    vi.spyOn(workspaceApi, 'createTopupCheckout')
      .mockResolvedValueOnce({ checkout_url: checkoutUrl })
      .mockResolvedValueOnce({ checkout_url: freshCheckoutUrl })
    vi.spyOn(window, 'open')
      .mockReturnValueOnce(checkoutTab() as never)
      .mockReturnValue(null)
    renderDialog()
    await continueToPayment()
    await handOffHeading()

    await userEvent.click(
      screen.getByRole('button', { name: 'Reopen checkout' })
    )

    expect(
      await screen.findByRole('link', { name: 'Open checkout' })
    ).toHaveAttribute('href', freshCheckoutUrl)
  })

  it('offers the blocked checkout as a link that opens without a new session', async () => {
    const create = checkoutOpensAt(checkoutUrl)
    vi.spyOn(window, 'open').mockReturnValue(null)
    const appUrl = window.location.href
    renderDialog()

    await continueToPayment()

    expect(
      await screen.findByRole('heading', { name: "Checkout didn't open" })
    ).toBeInTheDocument()
    expect(window.location.href).toBe(appUrl)
    const link = screen.getByRole('link', { name: 'Open checkout' })
    expect(link).toHaveAttribute('href', checkoutUrl)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener')

    await userEvent.click(link)

    expect(await handOffHeading()).toBeInTheDocument()
    expect(create).toHaveBeenCalledOnce()
    expect(useDialogStore().closeDialog).not.toHaveBeenCalled()
  })

  it('stays on the hand-off screen and explains a reopen that could not start', async () => {
    vi.spyOn(workspaceApi, 'createTopupCheckout')
      .mockResolvedValueOnce({ checkout_url: checkoutUrl })
      .mockRejectedValueOnce(
        new WorkspaceApiError('Upstream failed', 503, 'REQUEST_FAILED')
      )
    const secondTab = checkoutTab()
    vi.spyOn(window, 'open')
      .mockReturnValueOnce(checkoutTab() as never)
      .mockReturnValueOnce(secondTab as never)
    renderDialog()
    await continueToPayment()
    await handOffHeading()

    await userEvent.click(
      screen.getByRole('button', { name: 'Reopen checkout' })
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "The payment page couldn't open. Nothing was charged. Try again."
    )
    expect(secondTab.close).toHaveBeenCalledOnce()
    expect(await handOffHeading()).toBeInTheDocument()
  })

  it('stays on the amount step and explains a checkout that could not start', async () => {
    vi.spyOn(workspaceApi, 'createTopupCheckout').mockRejectedValue(
      new WorkspaceApiError('Bad return url', 400, 'INVALID_RETURN_URL')
    )
    const { tab } = stubCheckoutTab()
    renderDialog()

    await continueToPayment()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "The payment page couldn't open. Nothing was charged. Try again."
    )
    expect(tab.close).toHaveBeenCalledOnce()
    expect(useToast().error).not.toHaveBeenCalled()
    expect(continueButton()).toBeEnabled()
  })

  it('abandons a checkout that resolves after the dialog was dismissed', async () => {
    let resolveCheckout: (value: { checkout_url: string }) => void = () => {}
    vi.spyOn(workspaceApi, 'createTopupCheckout').mockReturnValue(
      new Promise((resolve) => {
        resolveCheckout = resolve
      })
    )
    const { tab } = stubCheckoutTab()
    const { unmount } = renderDialog()
    await continueToPayment()

    unmount()
    resolveCheckout({ checkout_url: checkoutUrl })

    await waitFor(() => expect(tab.close).toHaveBeenCalledOnce())
    expect(tab.location.href).toBe('')
  })

  it('hands checkout to the Desktop host and returns it to the billing-web return page', async () => {
    const create = checkoutOpensAt(checkoutUrl)
    window.__comfyDesktop2 = {}
    remoteConfig.value = { billing_web_url: 'https://testbilling.comfy.org' }
    const open = vi.spyOn(window, 'open').mockReturnValue(null)

    try {
      renderDialog()
      await continueToPayment()

      expect(await handOffHeading()).toBeInTheDocument()
      expect(create).toHaveBeenCalledWith(
        5000,
        'https://testbilling.comfy.org/return/topup'
      )
      expect(open).toHaveBeenCalledWith(checkoutUrl, '_blank')
    } finally {
      delete window.__comfyDesktop2
      remoteConfig.value = {}
    }
  })

  it('creates the checkout on the SDK rail while its flag is on', async () => {
    const harness = fakeBillingSdk()
    mockCreateBillingSdk.mockReturnValue(harness.sdk)
    vi.mocked(harness.sdk.topup.createHostedTopupCheckout).mockResolvedValue({
      status: 'ok',
      url: checkoutUrl
    })
    vi.mocked(useFeatureFlags().flags).billingSdkTopupRailEnabled = true
    const { tab } = stubCheckoutTab()
    renderDialog()

    await continueToPayment()

    expect(await handOffHeading()).toBeInTheDocument()
    expect(tab.location.href).toBe(checkoutUrl)
    expect(harness.sdk.topup.createHostedTopupCheckout).toHaveBeenCalledWith({
      amountCents: 5000,
      returnUrl: window.location.href
    })
    expect(harness.sdk.topup.createTopupCheckout).not.toHaveBeenCalled()
  })

  describe('after the hand-off', () => {
    const readCheckoutOperation = vi.fn(async () => false)

    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      checkoutOpensAt(checkoutUrl)
      stubCheckoutTab()
      return provideCheckoutOperationReader(readCheckoutOperation)
    })

    async function handOff() {
      renderDialog()
      await continueToPayment(
        userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      )
      await handOffHeading()
    }

    it('reads the billing status until the server reports the pending top-up', async () => {
      readCheckoutOperation
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
      await handOff()

      await vi.advanceTimersByTimeAsync(60_000)

      expect(readCheckoutOperation).toHaveBeenCalledTimes(2)
    })

    it('closes itself once the server settles the top-up it reported pending', async () => {
      vi.spyOn(workspaceApi, 'getBillingOpStatus').mockResolvedValue({
        id: 'op-topup',
        status: 'succeeded',
        started_at: new Date().toISOString()
      })
      readCheckoutOperation.mockImplementation(async () => {
        void useBillingOperationStore().startOperation('op-topup', 'topup', {
          resumed: true
        })
        return true
      })
      await handOff()
      expect(useDialogStore().closeDialog).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(8_000)

      expect(workspaceApi.getBillingOpStatus).toHaveBeenCalledWith('op-topup')
      expect(useDialogStore().closeDialog).toHaveBeenCalledWith({
        key: 'top-up-credits'
      })
    })

    it('reads the billing status once the customer follows the blocked checkout link', async () => {
      vi.spyOn(window, 'open').mockReturnValue(null)
      renderDialog()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await continueToPayment(user)
      const link = await screen.findByRole('link', { name: 'Open checkout' })
      await vi.advanceTimersByTimeAsync(8_000)
      expect(readCheckoutOperation).not.toHaveBeenCalled()

      await user.click(link)
      await vi.advanceTimersByTimeAsync(4_000)

      expect(readCheckoutOperation).toHaveBeenCalledOnce()
    })

    it('does not read the billing status before a checkout opens', async () => {
      renderDialog()

      await vi.advanceTimersByTimeAsync(60_000)

      expect(readCheckoutOperation).not.toHaveBeenCalled()
    })
  })

  describe('telemetry', () => {
    it.for([
      {
        name: 'a preset',
        choose: async (user: ReturnType<typeof userEvent.setup>) => {
          await user.click(screen.getByRole('button', { name: '$25' }))
        },
        amount: 25
      },
      {
        name: 'a typed amount',
        choose: async (user: ReturnType<typeof userEvent.setup>) => {
          await user.tripleClick(
            screen.getByRole('spinbutton', { name: 'Amount (USD)' })
          )
          await user.keyboard('75{Enter}')
        },
        amount: 75
      }
    ])(
      'reports $name and the opening surface when the customer continues to payment',
      async ({ choose, amount }) => {
        checkoutOpensAt(checkoutUrl)
        stubCheckoutTab()
        renderDialog({ source: 'deep_link' })
        const user = userEvent.setup()

        await choose(user)
        await continueToPayment(user)

        expect(
          useTelemetry()?.trackApiCreditTopupButtonPurchaseClicked
        ).toHaveBeenCalledExactlyOnceWith(amount)
        expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
          operation: 'topup',
          stage: 'intent',
          outcome: 'pending',
          payment_intent_source: 'deep_link'
        })
      }
    )

    it('reaches Datadog with the payment intent and its source', async () => {
      const registry = new TelemetryRegistry()
      registry.registerProvider(new DatadogRumTelemetryProvider())
      vi.mocked(useTelemetry).mockReturnValue(registry)
      checkoutOpensAt(checkoutUrl)
      stubCheckoutTab()
      renderDialog({ source: 'avatar_menu_plans' })

      await continueToPayment()

      await waitFor(() =>
        expect(mockRumAddAction).toHaveBeenCalledWith('billing.topup.intent', {
          operation: 'topup',
          stage: 'intent',
          outcome: 'pending',
          payment_intent_source: 'avatar_menu_plans',
          billing_surface: 'cloud_app'
        })
      )
    })
  })

  describe('checkout journey', () => {
    it('attributes the topup journey to the surface that opened the dialog', async () => {
      renderDialog({ source: 'agent_paywall' })

      await waitFor(() =>
        expect(useTelemetry()?.trackCheckoutJourneyEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            phase: 'entered',
            entry_flow: 'topup',
            entry_source: 'agent_paywall'
          })
        )
      )
    })

    it('keeps the surface on the journey so an operation recovered after reload can report it', async () => {
      renderDialog({ source: 'deep_link' })

      await waitFor(() =>
        expect(getActiveCheckoutJourney()).toMatchObject({
          entry_source: 'settings_billing',
          payment_intent_source: 'deep_link'
        })
      )
    })

    it('keeps the settings-billing attribution when no source is named', async () => {
      renderDialog()

      await waitFor(() =>
        expect(useTelemetry()?.trackCheckoutJourneyEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            phase: 'entered',
            entry_source: 'settings_billing'
          })
        )
      )
    })

    it('does not inherit a prior surface when a top-up is opened from a different one', async () => {
      resolveCheckoutJourney({
        actorUid: 'user-1',
        workspaceId: 'workspace-1',
        entryFlow: 'topup',
        entrySource: 'settings_billing',
        assignment: { status: 'unavailable' }
      })

      renderDialog({ source: 'agent_paywall' })

      await waitFor(() =>
        expect(useTelemetry()?.trackCheckoutJourneyEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            phase: 'entered',
            entry_source: 'agent_paywall'
          })
        )
      )
      expect(getActiveCheckoutJourney()?.entry_source).toBe('agent_paywall')
    })

    it('still resumes a journey from the same surface rather than restarting it', async () => {
      const first = resolveCheckoutJourney({
        actorUid: 'user-1',
        workspaceId: 'workspace-1',
        entryFlow: 'topup',
        entrySource: 'settings_billing',
        intent: 'settings_billing',
        assignment: { status: 'unavailable' }
      })
      assert(first.status === 'active')

      renderDialog()
      await nextTick()

      expect(getActiveCheckoutJourney()?.journey_id).toBe(
        first.record.journey_id
      )
    })

    it.for([
      { exit: 'dialog_close', leave: (unmount: () => void) => unmount() },
      {
        exit: 'page_exit',
        leave: () => window.dispatchEvent(new Event('pagehide'))
      }
    ] as const)('reports a $exit from a top-up', async ({ exit, leave }) => {
      const { unmount } = renderDialog()
      await nextTick()

      leave(unmount)

      expect(
        (vi.mocked(useTelemetry()?.trackCheckoutJourneyEvent)?.mock.calls ?? [])
          .map(([event]) => event)
          .filter((event) => event.phase === 'abandoned')
      ).toEqual([
        expect.objectContaining({
          entry_flow: 'topup',
          last_phase: 'entered',
          exit
        })
      ])
    })
  })

  function renderWithBalance(overrides: Partial<BalanceInfo>) {
    const balance: BalanceInfo = {
      amountMicros: 10_000,
      currency: 'usd',
      effectiveBalanceMicros: 10_000,
      effectiveBalanceAuthoritative: true,
      suggestedTopupAmountCents: null,
      ...overrides
    }
    Object.assign(mockBillingContext(), { balance: computed(() => balance) })
    renderDialog()
  }

  it.for([
    { name: 'the server suggestion', suggested: 11_400, amount: '114' },
    {
      name: 'the default without a suggestion',
      suggested: null,
      amount: '50'
    },
    {
      name: 'the default for a suggestion that is not whole dollars',
      suggested: 11_450,
      amount: '50'
    }
  ])('opens at $name', ({ suggested, amount }) => {
    renderWithBalance({ suggestedTopupAmountCents: suggested })

    expect(
      screen.getByRole('spinbutton', { name: 'Amount (USD)' })
    ).toHaveValue(amount)
  })

  function renderBeforeBalanceArrives() {
    const balance = ref<BalanceInfo | null>(null)
    Object.assign(mockBillingContext(), { balance })
    renderDialog()
    return (suggestedTopupAmountCents: number) => {
      balance.value = {
        amountMicros: -10_000,
        currency: 'usd',
        effectiveBalanceMicros: -10_000,
        effectiveBalanceAuthoritative: true,
        suggestedTopupAmountCents
      }
    }
  }

  it('adopts a suggestion that arrives after the dialog opens', async () => {
    const create = checkoutOpensAt(checkoutUrl)
    stubCheckoutTab()
    const balanceArrives = renderBeforeBalanceArrives()

    balanceArrives(11_400)
    await nextTick()
    await continueToPayment()

    expect(create).toHaveBeenCalledWith(11_400, window.location.href)
  })

  it('keeps an amount the user chose when the suggestion arrives later', async () => {
    const create = checkoutOpensAt(checkoutUrl)
    stubCheckoutTab()
    const balanceArrives = renderBeforeBalanceArrives()

    await userEvent.click(screen.getByRole('button', { name: '$25' }))
    balanceArrives(11_400)
    await nextTick()
    await continueToPayment()

    expect(create).toHaveBeenCalledWith(2_500, window.location.href)
  })

  it('keeps the amount handed to checkout when the suggestion arrives afterwards', async () => {
    const create = checkoutOpensAt(checkoutUrl)
    vi.spyOn(window, 'open')
      .mockReturnValueOnce(checkoutTab() as never)
      .mockReturnValueOnce(checkoutTab() as never)
    const balanceArrives = renderBeforeBalanceArrives()
    await continueToPayment()
    await handOffHeading()

    balanceArrives(11_400)
    await nextTick()
    await userEvent.click(
      screen.getByRole('button', { name: 'Reopen checkout' })
    )

    await waitFor(() => expect(create).toHaveBeenCalledTimes(2))
    expect(create.mock.calls.map(([amountCents]) => amountCents)).toEqual([
      5_000, 5_000
    ])
  })

  it('explains that the top-up covers a negative balance first', () => {
    renderWithBalance({
      amountMicros: -10_000,
      effectiveBalanceMicros: -10_000,
      suggestedTopupAmountCents: 11_400
    })

    expect(
      screen.getByText(
        'Your balance is −21,100 credits. This top-up covers that first.'
      )
    ).toBeInTheDocument()
  })

  it.for<{ name: string; balance: Partial<BalanceInfo> }>([
    { name: 'a positive balance', balance: {} },
    {
      name: 'a balance the server could not read',
      balance: {
        amountMicros: -10_000,
        effectiveBalanceMicros: -10_000,
        effectiveBalanceAuthoritative: false
      }
    }
  ])('says nothing about the balance for $name', ({ balance }) => {
    renderWithBalance(balance)

    expect(
      screen.queryByText(/This top-up covers that first/)
    ).not.toBeInTheDocument()
  })
})
