import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { t } from '@/i18n'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import { toTierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import { isCloud } from '@/platform/distribution/types'
import { useTelemetry } from '@/platform/telemetry'
import type { BillingFailure } from '@/platform/telemetry/types'
import { categorizeBillingApiError } from '@/platform/telemetry/utils/billingFailureCategory'
import type {
  PreviewSubscribeResponse,
  SubscribeResponse
} from '@/platform/workspace/api/workspaceApi'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

export interface DowngradeToPersonalResult {
  preview: PreviewSubscribeResponse
  response: SubscribeResponse
}

export interface DowngradePreview {
  preview: PreviewSubscribeResponse
  /** Cancelled subscription + a real plan change: the BE requires
   *  `confirm_reactivation` on the subscribe call or it rejects the change. */
  requiresReactivationConfirmation: boolean
}

interface DowngradeTelemetryAttempt {
  startedAt: number
  memberRemovalCount: number
  memberRemovalFailures: number
  targetTier?: TierKey
  targetCycle?: BillingCycle
  checkoutStartedAt?: number
}

/** Thrown by `downgradeToPersonal` when the billing authority requires
 *  reactivation consent, so the still-open confirmation can collect it and
 *  retry with `confirmReactivation: true`. */
export class ReactivationConfirmationRequiredError extends Error {
  constructor(public readonly preview: PreviewSubscribeResponse) {
    super(t('subscription.downgrade.reactivationConfirmationRequired'))
  }
}

/** Thrown by `downgradeToPersonal` when the amount a caller confirmed no
 *  longer matches a fresh preview taken right before billing — refuses to
 *  charge an amount the user never actually saw and consented to. */
export class ReactivationAmountChangedError extends Error {
  constructor(public readonly preview: PreviewSubscribeResponse) {
    super(t('subscription.downgrade.reactivationAmountChanged'))
  }
}

/**
 * Team-plan downgrade to personal: validate via `previewSubscribe`, remove
 * every member except the original owner, then initiate the tier change.
 * Billing is not committed until member cleanup succeeds, so a removal failure
 * cannot leave a personal plan with Team members still attached.
 * The removal-email and an atomic downgrade endpoint are backend-owned future
 * work; until then the frontend orchestrates the two steps non-atomically.
 */
export function useDowngradeToPersonal() {
  const workspaceStore = useTeamWorkspaceStore()
  const { members } = storeToRefs(workspaceStore)
  const { subscribe, previewSubscribe, subscription, fetchStatus } =
    useBillingContext()
  const billingOperationStore = useBillingOperationStore()
  const { userEmail } = useCurrentUser()
  const { permissions } = useWorkspaceUI()
  const { canDowngradeToPersonal } = useBillingCapabilities()
  const telemetry = useTelemetry()
  let activeTelemetryAttempt: DowngradeTelemetryAttempt | undefined

  const removableMembers = computed(() => {
    const hasFlag = members.value.some((m) => m.isOriginalOwner)
    if (hasFlag) return members.value.filter((m) => !m.isOriginalOwner)
    const email = userEmail.value?.toLowerCase() ?? null
    return members.value.filter(
      (m) => m.role !== 'owner' && m.email.toLowerCase() !== email
    )
  })

  const hasOtherMembers = computed(() => removableMembers.value.length > 0)

  function ensureCanDowngrade(): void {
    if (
      !(isCloud
        ? canDowngradeToPersonal.value
        : permissions.value.canDowngradeToPersonal)
    ) {
      throw new Error(t('subscription.downgrade.notAllowed'))
    }
  }

  function hasErrorCode(error: unknown, code: string): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === code
    )
  }

  async function refreshMembers(): Promise<void> {
    if (!permissions.value.canManageSubscription) {
      throw new Error(t('subscription.downgrade.notAllowed'))
    }
    await workspaceStore.fetchMembers()
    ensureCanDowngrade()
  }

  function requiresReactivationConfirmation(
    preview: PreviewSubscribeResponse
  ): boolean {
    if (preview.transition_type === 'new_subscription') return false
    // subscription is null exactly until status has loaded at least once, so
    // a null read means "cancelled or not" is unknown, not "not cancelled" —
    // fail closed. Gate on status readiness rather than aggregate
    // isInitialized (status + balance + plans): a balance/plans failure must
    // not permanently force reactivation onto an otherwise-valid, active
    // subscription. Mirrors the same fix in the transition preview component.
    return (
      subscription.value === null || (subscription.value?.isCancelled ?? false)
    )
  }

  /** Read-only preview so a caller can decide whether to collect reactivation
   *  consent before ever invoking `downgradeToPersonal`. */
  async function previewDowngrade(planSlug: string): Promise<DowngradePreview> {
    ensureCanDowngrade()
    const preview = await previewSubscribe(planSlug)
    if (!preview?.allowed) {
      throw new Error(preview?.reason || t('subscription.downgrade.notAllowed'))
    }
    ensureCanDowngrade()
    // `subscription` is a cached snapshot from the last billing-context load,
    // which can predate a cancellation; refresh it before reading isCancelled
    // so this decision reflects the current server state, not a stale one.
    await fetchStatus()
    return {
      preview,
      requiresReactivationConfirmation:
        requiresReactivationConfirmation(preview)
    }
  }

  async function downgradeToPersonal(
    planSlug: string,
    confirmReactivation = false,
    /** The `cost_today_cents` the caller displayed and got consent for.
     *  Compared against this call's own fresh preview so a price change
     *  between that consent and this charge can't slip through unnoticed. */
    confirmedChargeCents?: number
  ): Promise<DowngradeToPersonalResult | null> {
    ensureCanDowngrade()

    const membersToRemove = removableMembers.value
    const telemetryAttempt = activeTelemetryAttempt ?? {
      startedAt: Date.now(),
      memberRemovalCount: membersToRemove.length,
      memberRemovalFailures: 0
    }
    let telemetryFailure: BillingFailure | undefined

    if (!activeTelemetryAttempt) {
      activeTelemetryAttempt = telemetryAttempt
      telemetry?.trackBillingEvent({
        operation: 'downgrade_to_personal',
        stage: 'started',
        outcome: 'pending',
        member_removal_count: telemetryAttempt.memberRemovalCount,
        member_removal_failures: 0
      })
    }

    function trackSucceeded() {
      const now = Date.now()
      telemetry?.trackBillingEvent({
        operation: 'downgrade_to_personal',
        stage: 'succeeded',
        outcome: 'success',
        member_removal_count: telemetryAttempt.memberRemovalCount,
        member_removal_failures: telemetryAttempt.memberRemovalFailures,
        target_tier: telemetryAttempt.targetTier,
        duration_ms: now - telemetryAttempt.startedAt
      })
      if (telemetryAttempt.checkoutStartedAt === undefined) return
      telemetry?.trackBillingEvent({
        operation: 'subscription_checkout',
        stage: 'succeeded',
        outcome: 'success',
        tier: telemetryAttempt.targetTier,
        cycle: telemetryAttempt.targetCycle,
        checkout_type: 'change',
        duration_ms: now - telemetryAttempt.checkoutStartedAt
      })
      telemetry?.trackBillingEvent({
        operation: 'operation',
        stage: 'succeeded',
        outcome: 'success',
        operation_type: 'subscription',
        tier: telemetryAttempt.targetTier,
        cycle: telemetryAttempt.targetCycle,
        checkout_type: 'change',
        duration_ms: now - telemetryAttempt.checkoutStartedAt
      })
    }

    try {
      const preview = await previewSubscribe(planSlug)
      if (!preview?.allowed) {
        telemetryFailure = {
          failure_category: 'validation',
          error_code: 'downgrade_not_allowed'
        }
        throw new Error(
          preview?.reason || t('subscription.downgrade.notAllowed')
        )
      }
      ensureCanDowngrade()
      telemetryAttempt.targetTier = preview.new_plan?.tier
        ? (toTierKey(preview.new_plan.tier) ?? undefined)
        : undefined
      telemetryAttempt.targetCycle = preview.new_plan
        ? preview.new_plan.duration === 'ANNUAL'
          ? 'yearly'
          : 'monthly'
        : undefined

      // Catch cancellations visible to billing status before touching
      // membership. Refresh first because the cached value can predate a
      // cancellation that happened after previewDowngrade(); legacy-rail
      // cancellations omitted by status are recovered from the later
      // authority rejection while the confirmation remains open.
      await fetchStatus()
      if (requiresReactivationConfirmation(preview)) {
        if (!confirmReactivation) {
          throw new ReactivationConfirmationRequiredError(preview)
        }
        if (preview.cost_today_cents !== confirmedChargeCents) {
          throw new ReactivationAmountChangedError(preview)
        }
      }

      for (const member of membersToRemove) {
        ensureCanDowngrade()
        try {
          await workspaceStore.removeMember(member.id)
        } catch (error) {
          telemetryAttempt.memberRemovalFailures += 1
          telemetryFailure = {
            failure_category: categorizeBillingApiError(error),
            error_code: 'member_removal_failed'
          }
          throw new Error(
            t('subscription.downgrade.memberRemovalFailed', {
              email: member.email
            }),
            { cause: error }
          )
        }
      }

      ensureCanDowngrade()
      if (telemetryAttempt.checkoutStartedAt === undefined) {
        telemetryAttempt.checkoutStartedAt = Date.now()
        telemetry?.trackBillingEvent({
          operation: 'subscription_checkout',
          stage: 'started',
          outcome: 'pending',
          tier: telemetryAttempt.targetTier,
          cycle: telemetryAttempt.targetCycle,
          checkout_type: 'change'
        })
        telemetry?.trackBillingEvent({
          operation: 'operation',
          stage: 'started',
          outcome: 'pending',
          operation_type: 'subscription',
          tier: telemetryAttempt.targetTier,
          cycle: telemetryAttempt.targetCycle,
          checkout_type: 'change'
        })
      }
      let response: SubscribeResponse | void
      try {
        response = await subscribe(planSlug, {
          returnUrl: `${getComfyPlatformBaseUrl()}/payment/success`,
          cancelUrl: `${getComfyPlatformBaseUrl()}/payment/failed`,
          confirmReactivation,
          ...(preview.proration_at && { prorationAt: preview.proration_at })
        })
      } catch (error) {
        if (
          !confirmReactivation &&
          hasErrorCode(error, 'REACTIVATION_CONFIRMATION_REQUIRED')
        ) {
          throw new ReactivationConfirmationRequiredError(preview)
        }
        throw error
      }
      if (!response) {
        telemetryFailure = {
          failure_category: 'unknown',
          error_code: 'missing_checkout_response'
        }
        throw new Error(
          telemetryAttempt.memberRemovalCount > 0
            ? t('subscription.downgrade.failedAfterMemberRemoval')
            : t('subscription.downgrade.failed')
        )
      }

      if (response.status === 'needs_payment_method') {
        if (!response.payment_method_url) {
          telemetryFailure = {
            failure_category: 'redirect',
            error_code: 'missing_payment_method_url'
          }
          throw new Error(t('subscription.downgrade.paymentMethodRequired'))
        }
        const paymentTab = window.open(response.payment_method_url, '_blank')
        if (!paymentTab) {
          telemetryFailure = {
            failure_category: 'redirect',
            error_code: 'payment_popup_blocked'
          }
          throw new Error(t('subscription.downgrade.paymentPageBlocked'))
        }
        void billingOperationStore.startOperation(
          response.billing_op_id,
          'subscription',
          {
            tier: telemetryAttempt.targetTier,
            cycle: telemetryAttempt.targetCycle,
            checkoutType: 'change',
            downgradeToPersonal: {
              memberRemovalCount: telemetryAttempt.memberRemovalCount,
              memberRemovalFailures: telemetryAttempt.memberRemovalFailures,
              targetTier: telemetryAttempt.targetTier,
              startedAt: telemetryAttempt.startedAt
            },
            attemptStartedAt: telemetryAttempt.checkoutStartedAt
          }
        )
        activeTelemetryAttempt = undefined
        return null
      }

      if (response.status === 'pending_payment') {
        void billingOperationStore.startOperation(
          response.billing_op_id,
          'subscription',
          {
            tier: telemetryAttempt.targetTier,
            cycle: telemetryAttempt.targetCycle,
            checkoutType: 'change',
            downgradeToPersonal: {
              memberRemovalCount: telemetryAttempt.memberRemovalCount,
              memberRemovalFailures: telemetryAttempt.memberRemovalFailures,
              targetTier: telemetryAttempt.targetTier,
              startedAt: telemetryAttempt.startedAt
            },
            attemptStartedAt: telemetryAttempt.checkoutStartedAt
          }
        )
        activeTelemetryAttempt = undefined
        return null
      }

      trackSucceeded()
      activeTelemetryAttempt = undefined
      return { preview, response }
    } catch (error) {
      if (
        error instanceof ReactivationConfirmationRequiredError ||
        error instanceof ReactivationAmountChangedError
      ) {
        throw error
      }
      const failure = telemetryFailure ?? {
        failure_category: categorizeBillingApiError(error)
      }
      const now = Date.now()
      telemetry?.trackBillingEvent({
        operation: 'downgrade_to_personal',
        stage: 'failed',
        outcome: 'failure',
        member_removal_count: telemetryAttempt.memberRemovalCount,
        member_removal_failures: telemetryAttempt.memberRemovalFailures,
        target_tier: telemetryAttempt.targetTier,
        ...failure,
        duration_ms: now - telemetryAttempt.startedAt
      })
      if (telemetryAttempt.checkoutStartedAt !== undefined) {
        telemetry?.trackBillingEvent({
          operation: 'subscription_checkout',
          stage: 'failed',
          outcome: 'failure',
          tier: telemetryAttempt.targetTier,
          cycle: telemetryAttempt.targetCycle,
          checkout_type: 'change',
          ...failure,
          duration_ms: now - telemetryAttempt.checkoutStartedAt
        })
        telemetry?.trackBillingEvent({
          operation: 'operation',
          stage: 'failed',
          outcome: 'failure',
          operation_type: 'subscription',
          tier: telemetryAttempt.targetTier,
          cycle: telemetryAttempt.targetCycle,
          checkout_type: 'change',
          ...failure,
          duration_ms: now - telemetryAttempt.checkoutStartedAt
        })
      }
      activeTelemetryAttempt = undefined
      throw error
    }
  }

  return {
    removableMembers,
    hasOtherMembers,
    refreshMembers,
    previewDowngrade,
    downgradeToPersonal
  }
}
