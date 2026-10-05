<template>
  <CheckoutTransitionConfirm
    :preview-data
    :plan
    :current-plan-name="currentTierName"
    :copy
    :locale
    :subscription-loaded="subscription !== null"
    :subscription-cancelled="subscription?.isCancelled ?? false"
    :subscription-end-date="subscription?.endDate"
    :is-loading
    :action-url
    :force-reactivation
    :authentication-state
    :authentication-error
    :reconciliation-operation-id
    :quote-is-current
    :is-applying-promotion-code
    :embedded-checkout-enabled
    @confirm="emit('confirm', $event)"
    @back="emit('back')"
    @apply-promotion-code="emit('applyPromotionCode', $event)"
    @invalidate-quote="emit('invalidateQuote')"
  />
</template>

<script setup lang="ts">
/**
 * The cloud app's binding of the shared plan-change confirm: its tier names
 * and credits, its translations, and the subscription status that decides
 * whether the change reactivates a cancelled plan (ADR BILLING-WEB-0038).
 */
import { CheckoutTransitionConfirm } from '@comfyorg/account-ui/billing/checkout'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import type { TeamPlanSelection } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import type { IngestSubscriptionTier } from '@/platform/cloud/subscription/constants/tierPricing'
import {
  getTierCredits,
  toTierKey
} from '@/platform/cloud/subscription/constants/tierPricing'
import type {
  BillingAuthenticationState,
  PreviewSubscribeResponse
} from '@/platform/workspace/api/workspaceApi'
import { useCheckoutCopy } from '@/platform/workspace/composables/useCheckoutCopy'

const {
  previewData,
  isLoading = false,
  teamPlan = null,
  actionUrl = null,
  forceReactivation = false,
  authenticationState = null,
  authenticationError = null,
  reconciliationOperationId = null,
  quoteIsCurrent = false,
  isApplyingPromotionCode = false,
  embeddedCheckoutEnabled = false
} = defineProps<{
  previewData: PreviewSubscribeResponse
  isLoading?: boolean
  /** Set for a team credit-commit change: plan name + refill credits come from
   *  the selected slider stop; all proration money stays driven by previewData. */
  teamPlan?: TeamPlanSelection | null
  actionUrl?: string | null
  /** Server-authoritative fallback for legacy status reads that omit a
   * scheduled cancellation until subscribe enforces the consent gate. */
  forceReactivation?: boolean
  authenticationState?: BillingAuthenticationState | null
  authenticationError?: string | null
  reconciliationOperationId?: string | null
  quoteIsCurrent?: boolean
  isApplyingPromotionCode?: boolean
  embeddedCheckoutEnabled?: boolean
}>()

const emit = defineEmits<{
  confirm: [confirmReactivation: boolean]
  back: []
  applyPromotionCode: [code: string]
  invalidateQuote: []
}>()

const { locale, t, te } = useI18n()
const { copy } = useCheckoutCopy()
const { subscription } = useBillingContext()

function formatTierName(tier: string): string {
  const nameKey = `subscription.tiers.${tier.toLowerCase()}.name`
  if (te(nameKey)) return t(nameKey)
  return tier
    .toLowerCase()
    .split(/[_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Lowercasing the tier is not a catalog lookup: FOUNDERS_EDITION keys as
// 'founder', and TEAM/ENTERPRISE/unrecognized tiers key as nothing at all.
function tierMonthlyCredits(tier: string): number {
  const tierKey = toTierKey(tier as IngestSubscriptionTier)
  return tierKey ? (getTierCredits(tierKey) ?? 0) : 0
}

const plan = computed(() =>
  teamPlan
    ? {
        name: t('subscription.teamPlan.name'),
        monthlyCredits: teamPlan.credits
      }
    : {
        name: formatTierName(previewData.new_plan.tier),
        monthlyCredits: tierMonthlyCredits(previewData.new_plan.tier)
      }
)

const currentTierName = computed(() => {
  const tier = previewData.current_plan?.tier
  if (!tier) return ''
  return tier.toUpperCase() === 'TEAM'
    ? t('subscription.teamPlan.name')
    : formatTierName(tier)
})
</script>
