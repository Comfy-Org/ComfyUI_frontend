import type { HostedTopupCheckout } from '@comfyorg/ingest-types'
import { getActivePinia } from 'pinia'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, nextTick, ref } from 'vue'
import type { Ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import type {
  BalanceInfo,
  SubscriptionInfo
} from '@/platform/billing/composables/types'
import { useBillingRouting } from '@/platform/billing/composables/useBillingRouting'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import enMessages from '@/locales/en/main.json'
import { reportError } from '@/platform/telemetry/reportError'
import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApiError'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import CurrentUserPopoverWorkspace from '@/platform/workspace/components/CurrentUserPopoverWorkspace.vue'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useProcessingTopupPayment } from '@/platform/billing/composables/useProcessingTopupPayment'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

const state = vi.hoisted(() => ({ isCloud: true }))

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@/platform/billing/composables/useBillingRouting'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))
vi.mock(
  import('@/platform/billing/subscription/composables/useSubscriptionDialog')
)
vi.mock(import('@/platform/settings/composables/useSettingsDialog'))
vi.mock(import('@/platform/billing/composables/useBillingDialogs'))
vi.mock(import('@/platform/workspace/composables/useWorkspaceDialogs'))
vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/platform/telemetry/reportError'))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return state.isCloud
  }
}))
vi.mock(import('@/platform/billing/billingWeb'), () => ({
  getBillingWebUrl: () => new URL('http://localhost:5174')
}))
vi.mock(import('@/config/comfyApi'), () => ({
  getComfyCloudBaseUrl: () => 'https://testcloud.comfy.org'
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const PROCESSING_LINE = "Payment processing. You don't need to pay again."

function serveCheckout(checkoutState: HostedTopupCheckout['state']) {
  vi.spyOn(workspaceApi, 'listTopupCheckouts').mockResolvedValue({
    checkouts: [
      {
        amount_cents: 2500,
        created_at: '2026-10-20T00:00:00Z',
        session_id: 'cs_bank'
      }
    ],
    next_cursor: null
  })
  vi.spyOn(workspaceApi, 'getTopupCheckout').mockResolvedValue({
    amount_cents: 2500,
    payment_amount_cents: 2500,
    session_id: 'cs_bank',
    state: checkoutState
  })
}

function renderPopover() {
  useTeamWorkspaceStore().initState = 'ready'
  Object.assign(useTeamWorkspaceStore(), {
    workspaceName: 'Personal Workspace',
    isInPersonalWorkspace: true
  })
  return render(CurrentUserPopoverWorkspace, {
    global: {
      plugins: [getActivePinia()!, i18n],
      stubs: {
        WorkspaceSwitcherPopover: defineComponent({ template: '<div />' }),
        SubscribeButton: defineComponent({ template: '<button />' }),
        WorkspaceProfilePic: true,
        DeploymentSwitcher: defineComponent({ template: '<div />' })
      }
    }
  })
}

describe('credits flyout payment processing', () => {
  beforeEach(() => {
    state.isCloud = true
    useCurrentUser().userDisplayName = computed(() => 'Liz')
    useCurrentUser().userEmail = computed(() => 'liz@example.com')
    useCurrentUser().userPhotoUrl = computed(() => null)
    useBillingCapabilities().canTopUp = computed(() => true)
    vi.mocked(useFeatureFlags().flags).hostedBillingDestination = 'stripe'
    const billingContext = useBillingContext()
    billingContext.billingStatus = computed(() => 'paid')
    billingContext.canAccessSubscriptionFeatures = computed(() => true)
    billingContext.subscription = computed(
      () =>
        ({
          isActive: true,
          tier: null,
          duration: null,
          isCancelled: false,
          planSlug: 'pro-monthly',
          scheduledChange: null,
          renewalDate: null,
          endDate: null,
          hasFunds: true,
          agentHasFunds: true
        }) satisfies SubscriptionInfo
    )
    billingContext.balance = computed(
      () => ({ amountMicros: 100, currency: 'USD' }) satisfies BalanceInfo
    )
    billingContext.isLoading = ref(false)
    vi.mocked(useBillingContext).mockReturnValue(billingContext)
    const workspaceUI = vi.mocked(useWorkspaceUI())
    workspaceUI.permissions = computed(() => ({
      canViewOtherMembers: false,
      canViewPendingInvites: false,
      canManageSubscription: false,
      canManageSubscriptionLifecycle: false,
      canDowngradeToPersonal: false
    }))
    workspaceUI.canReactivatePlan = computed(() => false)
    workspaceUI.canOpenPricingSurface = computed(() => false)
    vi.mocked(useBillingRouting()).shouldUseWorkspaceBilling = computed(
      () => true
    )
  })

  it('does not read checkouts while unified billing settings are off', () => {
    const list = vi.spyOn(workspaceApi, 'listTopupCheckouts')
    renderPopover()

    expect(screen.getByTestId('add-credits-button')).toBeInTheDocument()
    expect(screen.queryByText(PROCESSING_LINE)).not.toBeInTheDocument()
    expect(list).not.toHaveBeenCalled()
  })

  it('shows the processing line from the checkout state', async () => {
    vi.mocked(useFeatureFlags().flags).unifiedBillingSettingsEnabled = true
    serveCheckout('payment_processing')
    renderPopover()

    expect(await screen.findByText(PROCESSING_LINE)).toBeInTheDocument()
    expect(workspaceApi.getTopupCheckout).toHaveBeenCalledWith('cs_bank')
  })

  it('leaves the line out when the checkout is still open', async () => {
    vi.mocked(useFeatureFlags().flags).unifiedBillingSettingsEnabled = true
    serveCheckout('open')
    renderPopover()

    await waitFor(() =>
      expect(workspaceApi.getTopupCheckout).toHaveBeenCalledWith('cs_bank')
    )
    expect(screen.queryByText(PROCESSING_LINE)).not.toBeInTheDocument()
  })
})

function checkout(
  state: HostedTopupCheckout['state'],
  paymentAmountCents: number | null,
  sessionId: string
): HostedTopupCheckout {
  return {
    amount_cents: 2500,
    payment_amount_cents: paymentAmountCents,
    session_id: sessionId,
    state
  }
}

function listed(sessionId: string) {
  return {
    amount_cents: 2500,
    created_at: '2026-10-20T00:00:00Z',
    session_id: sessionId
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<T>((settle, fail) => {
    resolve = settle
    reject = fail
  })
  return { promise, resolve, reject }
}

function renderPayment(shown: Ref<boolean>) {
  return render(
    defineComponent({
      setup() {
        const { payment } = useProcessingTopupPayment(shown)
        const label = computed(() => {
          if (!payment.value) return 'none'
          const cents = payment.value.paymentAmountCents
          return cents === null ? 'withheld' : String(cents)
        })
        return { label }
      },
      template: '<p role="status">{{ label }}</p>'
    })
  )
}

function enableProcessingRead() {
  vi.mocked(useFeatureFlags().flags).unifiedBillingSettingsEnabled = true
}

function leaveAndReturn() {
  window.dispatchEvent(new Event('blur'))
  window.dispatchEvent(new Event('focus'))
}

describe('useProcessingTopupPayment', () => {
  it('does not read checkouts while the surface is hidden', async () => {
    enableProcessingRead()
    const list = vi.spyOn(workspaceApi, 'listTopupCheckouts')
    const shown = ref(false)
    renderPayment(shown)

    await nextTick()
    expect(screen.getByRole('status')).toHaveTextContent('none')
    expect(list).not.toHaveBeenCalled()

    serveCheckout('payment_processing')
    shown.value = true
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('2500')
    )

    shown.value = false
    await nextTick()
    expect(screen.getByRole('status')).toHaveTextContent('none')
  })

  it('keeps the newer amount when an older checkout read finishes later', async () => {
    enableProcessingRead()
    const shown = ref(true)
    const first = deferred<HostedTopupCheckout>()
    vi.spyOn(workspaceApi, 'listTopupCheckouts').mockResolvedValue({
      checkouts: [listed('cs_bank')],
      next_cursor: null
    })
    let reads = 0
    vi.spyOn(workspaceApi, 'getTopupCheckout').mockImplementation(() => {
      reads += 1
      return reads === 1
        ? first.promise
        : Promise.resolve(checkout('payment_processing', 100, 'cs_bank'))
    })
    renderPayment(shown)

    await waitFor(() =>
      expect(workspaceApi.getTopupCheckout).toHaveBeenCalledTimes(1)
    )
    shown.value = false
    await nextTick()
    shown.value = true

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('100')
    )
    first.resolve(checkout('payment_processing', 2500, 'cs_bank'))
    await first.promise
    await nextTick()
    expect(screen.getByRole('status')).toHaveTextContent('100')
  })

  it('withholds the amount when another checkout detail fails', async () => {
    enableProcessingRead()
    const cause = new WorkspaceApiError('unavailable', 503)
    vi.spyOn(workspaceApi, 'listTopupCheckouts').mockResolvedValue({
      checkouts: [listed('cs_bank'), listed('cs_other')],
      next_cursor: null
    })
    vi.spyOn(workspaceApi, 'getTopupCheckout').mockImplementation(
      (sessionId) => {
        if (sessionId === 'cs_other') return Promise.reject(cause)
        return Promise.resolve(checkout('payment_processing', 2500, sessionId))
      }
    )
    renderPayment(ref(true))

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('withheld')
    )
    expect(reportError).toHaveBeenCalledWith(cause, {
      errorType: 'failure_reading_topup_checkout',
      surface: 'billing'
    })
  })

  it('reports a failed checkout detail without a processing notice', async () => {
    enableProcessingRead()
    const cause = new WorkspaceApiError('unavailable', 503)
    vi.spyOn(workspaceApi, 'listTopupCheckouts').mockResolvedValue({
      checkouts: [listed('cs_bank')],
      next_cursor: null
    })
    vi.spyOn(workspaceApi, 'getTopupCheckout').mockRejectedValue(cause)
    renderPayment(ref(true))

    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(cause, {
        errorType: 'failure_reading_topup_checkout',
        surface: 'billing'
      })
    )
    await nextTick()
    expect(screen.getByRole('status')).toHaveTextContent('none')
  })

  it('drops the processing notice when focus returns to a failed checkout', async () => {
    enableProcessingRead()
    serveCheckout('payment_processing')
    renderPayment(ref(true))

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('2500')
    )
    const reads = vi.mocked(workspaceApi.getTopupCheckout).mock.calls.length
    vi.mocked(workspaceApi.getTopupCheckout).mockResolvedValue(
      checkout('failed', null, 'cs_bank')
    )
    leaveAndReturn()

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('none')
    )
    expect(workspaceApi.getTopupCheckout).toHaveBeenCalledTimes(reads + 1)
  })

  it('keeps the processing notice when a return read fails', async () => {
    enableProcessingRead()
    serveCheckout('payment_processing')
    renderPayment(ref(true))

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('2500')
    )
    const cause = new WorkspaceApiError('bad gateway', 502)
    vi.mocked(workspaceApi.listTopupCheckouts).mockRejectedValue(cause)
    leaveAndReturn()

    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(cause, {
        errorType: 'failure_reading_topup_checkout',
        surface: 'billing'
      })
    )
    expect(screen.getByRole('status')).toHaveTextContent('2500')
  })

  it('keeps the processing notice without its amount when a return detail read fails', async () => {
    enableProcessingRead()
    serveCheckout('payment_processing')
    renderPayment(ref(true))

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('2500')
    )
    const cause = new WorkspaceApiError('bad gateway', 502)
    vi.mocked(workspaceApi.getTopupCheckout).mockRejectedValue(cause)
    leaveAndReturn()

    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(cause, {
        errorType: 'failure_reading_topup_checkout',
        surface: 'billing'
      })
    )
    await nextTick()
    expect(screen.getByRole('status')).toHaveTextContent('withheld')
  })

  it('withholds the amount when a cached open sibling cannot be refreshed', async () => {
    enableProcessingRead()
    vi.spyOn(workspaceApi, 'listTopupCheckouts').mockResolvedValue({
      checkouts: [listed('cs_bank'), listed('cs_other')],
      next_cursor: null
    })
    vi.spyOn(workspaceApi, 'getTopupCheckout').mockImplementation((sessionId) =>
      Promise.resolve(
        sessionId === 'cs_other'
          ? checkout('open', null, sessionId)
          : checkout('payment_processing', 2500, sessionId)
      )
    )
    renderPayment(ref(true))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('2500')
    )

    const cause = new WorkspaceApiError('bad gateway', 502)
    vi.mocked(workspaceApi.getTopupCheckout).mockImplementation((sessionId) =>
      sessionId === 'cs_other'
        ? Promise.reject(cause)
        : Promise.resolve(checkout('payment_processing', 2500, sessionId))
    )
    leaveAndReturn()

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('withheld')
    )
  })

  it('drops the notice when the processing checkout is fulfilled while another detail fails', async () => {
    enableProcessingRead()
    serveCheckout('payment_processing')
    renderPayment(ref(true))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('2500')
    )

    const cause = new WorkspaceApiError('bad gateway', 502)
    vi.mocked(workspaceApi.listTopupCheckouts).mockResolvedValue({
      checkouts: [listed('cs_bank'), listed('cs_other')],
      next_cursor: null
    })
    vi.mocked(workspaceApi.getTopupCheckout).mockImplementation((sessionId) =>
      sessionId === 'cs_other'
        ? Promise.reject(cause)
        : Promise.resolve(checkout('fulfilled', 2500, sessionId))
    )
    leaveAndReturn()

    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(cause, {
        errorType: 'failure_reading_topup_checkout',
        surface: 'billing'
      })
    )
    await nextTick()
    expect(screen.getByRole('status')).toHaveTextContent('none')
  })

  it('drops a checkout read that started in the previous workspace', async () => {
    enableProcessingRead()
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-a' })
    const workspaceARead = deferred<HostedTopupCheckout>()
    vi.spyOn(workspaceApi, 'listTopupCheckouts').mockResolvedValue({
      checkouts: [listed('cs_a')],
      next_cursor: null
    })
    vi.spyOn(workspaceApi, 'getTopupCheckout').mockReturnValue(
      workspaceARead.promise
    )
    renderPayment(ref(true))
    await waitFor(() =>
      expect(workspaceApi.getTopupCheckout).toHaveBeenCalledWith('cs_a')
    )

    const workspaceBList =
      deferred<Awaited<ReturnType<typeof workspaceApi.listTopupCheckouts>>>()
    vi.mocked(workspaceApi.listTopupCheckouts).mockReturnValueOnce(
      workspaceBList.promise
    )
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-b' })
    await waitFor(() =>
      expect(workspaceApi.listTopupCheckouts).toHaveBeenCalledTimes(2)
    )

    workspaceARead.resolve(checkout('payment_processing', 2500, 'cs_a'))
    await workspaceARead.promise
    await new Promise((settle) => setTimeout(settle))
    expect(screen.getByRole('status')).toHaveTextContent('none')

    vi.mocked(workspaceApi.getTopupCheckout).mockResolvedValue(
      checkout('payment_processing', 100, 'cs_b')
    )
    workspaceBList.resolve({ checkouts: [listed('cs_b')], next_cursor: null })
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('100')
    )
  })

  it('drops the notice without reporting when billing owner access is refused', async () => {
    enableProcessingRead()
    serveCheckout('payment_processing')
    renderPayment(ref(true))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('2500')
    )

    vi.mocked(workspaceApi.listTopupCheckouts).mockRejectedValue(
      new WorkspaceApiError('Workspace billing owner required', 403)
    )
    leaveAndReturn()

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('none')
    )
    expect(reportError).not.toHaveBeenCalled()
  })

  it('reports a failing checkout read once across returns', async () => {
    enableProcessingRead()
    const list = vi
      .spyOn(workspaceApi, 'listTopupCheckouts')
      .mockRejectedValue(new WorkspaceApiError('bad gateway', 502))
    renderPayment(ref(true))
    await waitFor(() => expect(reportError).toHaveBeenCalledTimes(1))

    leaveAndReturn()
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
    await new Promise((settle) => setTimeout(settle))

    expect(reportError).toHaveBeenCalledTimes(1)
  })

  it('does not read again after the surface is gone', async () => {
    enableProcessingRead()
    serveCheckout('payment_processing')
    const view = renderPayment(ref(true))

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('2500')
    )
    const lists = vi.mocked(workspaceApi.listTopupCheckouts).mock.calls.length
    view.unmount()
    leaveAndReturn()

    expect(workspaceApi.listTopupCheckouts).toHaveBeenCalledTimes(lists)
  })

  it('does not start a queued return read after the surface is gone', async () => {
    enableProcessingRead()
    serveCheckout('payment_processing')
    const view = renderPayment(ref(true))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('2500')
    )
    const pending = deferred<HostedTopupCheckout>()
    vi.mocked(workspaceApi.getTopupCheckout).mockReturnValue(pending.promise)
    leaveAndReturn()
    await waitFor(() =>
      expect(workspaceApi.getTopupCheckout).toHaveBeenCalledTimes(2)
    )
    leaveAndReturn()
    const lists = vi.mocked(workspaceApi.listTopupCheckouts).mock.calls.length

    view.unmount()
    pending.resolve(checkout('payment_processing', 2500, 'cs_bank'))
    await pending.promise
    await new Promise((settle) => setTimeout(settle))

    expect(workspaceApi.listTopupCheckouts).toHaveBeenCalledTimes(lists)
  })

  it('does not report a checkout read that fails after the surface is gone', async () => {
    enableProcessingRead()
    vi.spyOn(workspaceApi, 'listTopupCheckouts').mockResolvedValue({
      checkouts: [listed('cs_bank')],
      next_cursor: null
    })
    const pending = deferred<HostedTopupCheckout>()
    vi.spyOn(workspaceApi, 'getTopupCheckout').mockReturnValue(pending.promise)
    const view = renderPayment(ref(true))
    await waitFor(() =>
      expect(workspaceApi.getTopupCheckout).toHaveBeenCalledTimes(1)
    )

    view.unmount()
    pending.reject(new WorkspaceApiError('unavailable', 503))
    await pending.promise.catch(() => undefined)
    await new Promise((settle) => setTimeout(settle))

    expect(reportError).not.toHaveBeenCalled()
  })
})
