import { computed, ref } from 'vue'

import { t } from '@/i18n'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import { useSubscription } from '@/platform/billing/subscription/composables/useSubscription'
import { isWorkspaceBillingRequiredError } from '@/platform/remote/comfyui/errors'
import type {
  BillingStatus,
  BillingStatusResponse,
  BillingSubscriptionStatus,
  PreviewSubscribeOptions,
  PreviewSubscribeResponse,
  SubscribeOptions,
  SubscribeResponse
} from '@/platform/workspace/api/workspaceApi'
import { useAuthStore } from '@/stores/authStore'

import type {
  BalanceInfo,
  BillingActions,
  BillingPortalOutcome,
  BillingState,
  SubscriptionInfo
} from './types'

type LegacyBalance = NonNullable<ReturnType<typeof useAuthStore>['balance']>
type RuntimeLegacyBalance = Omit<
  LegacyBalance,
  'amount_micros' | 'effective_balance_micros'
> & {
  amount_micros?: number
  effective_balance_micros?: number
}

function fundsFromStatus(status: BillingStatusResponse | null) {
  const hasFunds = status?.has_funds ?? false
  return {
    hasFunds,
    agentHasFunds: status?.scoped_effective_has_funds?.agent ?? hasFunds,
    agentScopedHasFunds: status?.scoped_has_funds?.agent
  }
}

/**
 * Adapter for legacy user-scoped billing via /customers/* endpoints.
 * Used for personal workspaces.
 * @internal - Use useBillingContext() instead of importing directly.
 */
export function useLegacyBilling(): BillingState & BillingActions {
  const {
    canAccessSubscriptionFeatures: legacyCanAccessSubscriptionFeatures,
    subscriptionTier,
    subscriptionDuration,
    subscriptionStatus: legacySubscriptionStatus,
    isCancelled,
    fetchStatus: legacyFetchStatus,
    fetchStatusDirect: legacyFetchStatusDirect,
    manageSubscription: legacyManageSubscription,
    subscribeDirect: legacySubscribeDirect
  } = useSubscription()

  const authStore = useAuthStore()
  const authActions = useAuthActions()

  const isInitialized = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // The backend refuses legacy calls for a workspace that moved to workspace
  // billing. Refresh the status so the next click routes correctly and ask the
  // user to retry; the call is not repeated here.
  async function toPresentableFailure(err: unknown): Promise<unknown> {
    if (!isWorkspaceBillingRequiredError(err)) return err
    try {
      await legacyFetchStatusDirect()
    } catch {
      // The refusal is the failure to report, not the refresh.
    }
    return new Error(t('billingOperation.subscriptionFailedDetail'), {
      cause: err
    })
  }

  async function reportFailures(
    action: () => Promise<unknown>
  ): Promise<boolean> {
    try {
      await action()
      return true
    } catch (err) {
      authActions.reportError(await toPresentableFailure(err))
      return false
    }
  }

  // For actions whose caller shows the outcome, so a failure must not resolve.
  async function rejectFailures(action: () => Promise<unknown>): Promise<void> {
    try {
      await action()
    } catch (err) {
      throw await toPresentableFailure(err)
    }
  }

  const canAccessSubscriptionFeatures = computed(
    () => legacyCanAccessSubscriptionFeatures.value
  )
  const isFreeTier = computed(() => subscriptionTier.value === 'FREE')
  const maxSeats = computed(() => null)
  const occupiedSeats = computed(() => null)

  const subscription = computed<SubscriptionInfo | null>(() => {
    const status = legacySubscriptionStatus.value
    if (
      !legacyCanAccessSubscriptionFeatures.value &&
      !subscriptionTier.value &&
      !status?.renewal_invoice
    ) {
      return null
    }

    return {
      isActive: legacyCanAccessSubscriptionFeatures.value,
      tier: subscriptionTier.value,
      duration: subscriptionDuration.value,
      planSlug: null,
      scheduledChange: null,
      renewalDate: status?.renewal_date ?? null,
      endDate: status?.cancel_at ?? null,
      isCancelled: isCancelled.value,
      ...fundsFromStatus(status)
    }
  })

  const balance = computed<BalanceInfo | null>(() => {
    const legacyBalance: RuntimeLegacyBalance | null = authStore.balance
    if (!legacyBalance) return null

    return {
      amountMicros: legacyBalance.amount_micros || 0,
      currency: legacyBalance.currency || 'usd',
      effectiveBalanceMicros:
        legacyBalance.effective_balance_micros ??
        legacyBalance.amount_micros ??
        0,
      prepaidBalanceMicros: legacyBalance.prepaid_balance_micros ?? 0,
      cloudCreditBalanceMicros: legacyBalance.cloud_credit_balance_micros ?? 0
    }
  })

  const billingStatus = computed<BillingStatus | null>(
    () => legacySubscriptionStatus.value?.billing_status ?? null
  )
  const subscriptionStatus = computed<BillingSubscriptionStatus | null>(() => {
    if (legacySubscriptionStatus.value?.subscription_status) {
      return legacySubscriptionStatus.value.subscription_status
    }
    if (isCancelled.value) return 'canceled'
    if (legacyCanAccessSubscriptionFeatures.value) return 'active'
    return null
  })
  const subscriptionState = computed(
    () => legacySubscriptionStatus.value?.subscription_state ?? null
  )
  const tier = computed(() => subscriptionTier.value)
  const renewalDate = computed(
    () => legacySubscriptionStatus.value?.renewal_date ?? null
  )

  // Legacy billing doesn't have workspace-style plans
  const plans = computed(() => [])
  const currentPlanSlug = computed(() => null)
  const teamCreditStops = computed(() => null)
  const currentTeamCreditStop = computed(
    () => legacySubscriptionStatus.value?.team_credit_stop ?? null
  )

  async function initialize(): Promise<void> {
    if (isInitialized.value) return

    isLoading.value = true
    error.value = null
    try {
      await Promise.all([fetchStatus(), fetchBalance()])
      if (isFreeTier.value && balance.value?.amountMicros === 0) {
        await Promise.all([fetchBalance(), fetchStatus()])
      }
      isInitialized.value = true
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to initialize billing'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function fetchStatus(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      await legacyFetchStatus()
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to fetch subscription'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function fetchBalance(): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      await authStore.fetchBalance()
    } catch (err) {
      error.value =
        err instanceof Error ? err.message : 'Failed to fetch balance'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function subscribe(
    _planSlug: string,
    _options?: SubscribeOptions
  ): Promise<SubscribeResponse | void> {
    // Legacy billing uses Stripe checkout flow via useSubscription
    await reportFailures(() => legacySubscribeDirect())
  }

  async function previewSubscribe(
    _planSlug: string,
    _options?: PreviewSubscribeOptions
  ): Promise<PreviewSubscribeResponse | null> {
    // Legacy billing doesn't support preview - returns null
    return null
  }

  async function manageSubscription(): Promise<BillingPortalOutcome> {
    const opened = await reportFailures(() => legacyManageSubscription())
    return opened ? { ok: true } : { ok: false, reason: 'failed' }
  }

  async function cancelSubscription(): Promise<void> {
    await rejectFailures(() =>
      legacyManageSubscription({ cancelSubscription: true })
    )
  }

  async function resubscribe(options?: {
    source?: 'pricing_dialog' | 'settings_billing_panel'
  }): Promise<void> {
    // Legacy has no resubscribe endpoint; resubscribing is a fresh checkout.
    // Unwrapped so failures propagate to resubscribe telemetry instead of being swallowed.
    // Tag the attempt as a resubscribe so the pending-checkout recovery in
    // useSubscription.ts can later emit the canonical resubscribe terminal
    // instead of leaving it indistinguishable from a plain subscribe.
    await rejectFailures(() =>
      legacySubscribeDirect({
        operation: 'resubscribe',
        source: options?.source
      })
    )
  }

  async function topup(amountCents: number): Promise<void> {
    if (!canAccessSubscriptionFeatures.value) return
    // Facade standardizes on cents; legacy /customers/credit takes dollars.
    await reportFailures(() =>
      authActions.purchaseCreditsDirect(amountCents / 100)
    )
  }

  async function fetchPlans(): Promise<void> {
    // Legacy billing doesn't have workspace-style plans
    // Plans are hardcoded in the UI for legacy subscriptions
  }

  return {
    // State
    isInitialized,
    subscription,
    balance,
    plans,
    currentPlanSlug,
    teamCreditStops,
    currentTeamCreditStop,
    maxSeats,
    occupiedSeats,
    isLoading,
    error,
    canAccessSubscriptionFeatures,
    isFreeTier,
    billingStatus,
    subscriptionStatus,
    subscriptionState,
    tier,
    renewalDate,
    renewalInvoice: computed(
      () => legacySubscriptionStatus.value?.renewal_invoice ?? null
    ),

    // Actions
    initialize,
    fetchStatus,
    fetchBalance,
    subscribe,
    previewSubscribe,
    manageSubscription,
    cancelSubscription,
    resubscribe,
    topup,
    fetchPlans
  }
}
