import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import { getComfyPlatformBaseUrl } from '@/config/comfyApi'
import { t } from '@/i18n'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import { TIER_TO_KEY } from '@/platform/cloud/subscription/constants/tierPricing'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import { useTelemetry } from '@/platform/telemetry'
import type { BillingFailure } from '@/platform/telemetry/types'
import type {
  PreviewSubscribeResponse,
  SubscribeResponse
} from '@/platform/workspace/api/workspaceApi'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useBillingOperationStore } from '@/platform/workspace/stores/billingOperationStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

export interface DowngradeToPersonalResult {
  preview: PreviewSubscribeResponse
  response: SubscribeResponse
}

/**
 * Team-plan downgrade to personal: validate via `previewSubscribe`, remove
 * every member except the original owner, then initiate the tier change.
 * BE seam (BE-1337): removal email and an atomic downgrade endpoint are
 * BE-owned; until then the FE orchestrates the two steps non-atomically.
 */
export function useDowngradeToPersonal() {
  const workspaceStore = useTeamWorkspaceStore()
  const { members } = storeToRefs(workspaceStore)
  const { subscribe, previewSubscribe } = useBillingContext()
  const billingOperationStore = useBillingOperationStore()
  const { userEmail } = useCurrentUser()
  const { permissions } = useWorkspaceUI()
  const telemetry = useTelemetry()

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
    if (!permissions.value.canDowngradeToPersonal) {
      throw new Error(t('subscription.downgrade.notAllowed'))
    }
  }

  async function refreshMembers(): Promise<void> {
    if (!permissions.value.canManageSubscription) {
      throw new Error(t('subscription.downgrade.notAllowed'))
    }
    await workspaceStore.fetchMembers()
    ensureCanDowngrade()
  }

  async function downgradeToPersonal(
    planSlug: string
  ): Promise<DowngradeToPersonalResult | null> {
    ensureCanDowngrade()

    const membersToRemove = removableMembers.value
    let memberRemovalFailures = 0
    let targetTier: TierKey | undefined
    let targetCycle: BillingCycle | undefined
    let telemetryFailure: BillingFailure = { failure_category: 'unknown' }

    telemetry?.trackBillingEvent({
      operation: 'downgrade_to_personal',
      stage: 'started',
      outcome: 'pending',
      member_removal_count: membersToRemove.length,
      member_removal_failures: 0
    })

    function trackSucceeded() {
      telemetry?.trackBillingEvent({
        operation: 'downgrade_to_personal',
        stage: 'succeeded',
        outcome: 'success',
        member_removal_count: membersToRemove.length,
        member_removal_failures: memberRemovalFailures,
        target_tier: targetTier
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
      targetTier = preview.new_plan?.tier
        ? TIER_TO_KEY[preview.new_plan.tier]
        : undefined
      targetCycle = preview.new_plan
        ? preview.new_plan.duration === 'ANNUAL'
          ? 'yearly'
          : 'monthly'
        : undefined

      for (const member of membersToRemove) {
        ensureCanDowngrade()
        try {
          await workspaceStore.removeMember(member.id)
        } catch (error) {
          memberRemovalFailures += 1
          telemetryFailure = {
            failure_category: 'unknown',
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
      const response = await subscribe(planSlug, {
        returnUrl: `${getComfyPlatformBaseUrl()}/payment/success`,
        cancelUrl: `${getComfyPlatformBaseUrl()}/payment/failed`
      })
      if (!response) {
        telemetryFailure = {
          failure_category: 'unknown',
          error_code: 'missing_checkout_response'
        }
        throw new Error(
          membersToRemove.length > 0
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
            tier: targetTier,
            cycle: targetCycle,
            checkoutType: 'change',
            downgradeToPersonal: {
              memberRemovalCount: membersToRemove.length,
              memberRemovalFailures,
              targetTier
            }
          }
        )
        return null
      }

      if (response.status === 'pending_payment') {
        void billingOperationStore.startOperation(
          response.billing_op_id,
          'subscription',
          {
            tier: targetTier,
            cycle: targetCycle,
            checkoutType: 'change',
            downgradeToPersonal: {
              memberRemovalCount: membersToRemove.length,
              memberRemovalFailures,
              targetTier
            }
          }
        )
        return null
      }

      trackSucceeded()
      return { preview, response }
    } catch (error) {
      telemetry?.trackBillingEvent({
        operation: 'downgrade_to_personal',
        stage: 'failed',
        outcome: 'failure',
        member_removal_count: membersToRemove.length,
        member_removal_failures: memberRemovalFailures,
        target_tier: targetTier,
        ...telemetryFailure
      })
      throw error
    }
  }

  return {
    removableMembers,
    hasOtherMembers,
    refreshMembers,
    downgradeToPersonal
  }
}
