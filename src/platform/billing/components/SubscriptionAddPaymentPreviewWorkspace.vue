<template>
  <CheckoutSubscribeConfirm
    :plan
    :copy
    :locale
    publishable-key=""
    :billing-cycle
    :is-loading
    :preview-data
    :action-url
    :authentication-state
    :parked-checkout-recovery
    @add-credit-card="emit('addCreditCard')"
    @back="emit('back')"
  />
</template>

<script setup lang="ts">
/**
 * The cloud app's binding of the shared new-subscription confirm: its tier
 * and team-stop catalog and its translations (ADR BILLING-WEB-0038).
 */
import { CheckoutSubscribeConfirm } from '@comfyorg/account-ui/billing/checkout'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { TeamPlanSelection } from '@/platform/billing/subscription/constants/teamPlanCreditStops'
import type { TierKey } from '@/platform/billing/subscription/constants/tierPricing'
import type { BillingCycle } from '@/platform/billing/subscription/utils/subscriptionTierRank'
import type {
  BillingAuthenticationState,
  PreviewSubscribeResponse
} from '@/platform/workspace/api/workspaceApi'
import { useCheckoutCopy } from '@/platform/billing/composables/useCheckoutCopy'

interface Props {
  /** Personal-tier checkout. Required unless `teamPlan` is set. */
  tierKey?: Exclude<TierKey, 'free' | 'founder'>
  billingCycle?: BillingCycle
  isLoading?: boolean
  previewData?: PreviewSubscribeResponse | null
  /** Team-plan checkout (selected slider stop); overrides tier-derived display. */
  teamPlan?: TeamPlanSelection | null
  actionUrl?: string | null
  authenticationState?: BillingAuthenticationState | null
  parkedCheckoutRecovery?: boolean
}

const {
  tierKey,
  billingCycle = 'monthly',
  isLoading = false,
  previewData = null,
  teamPlan = null,
  actionUrl = null,
  authenticationState = null,
  parkedCheckoutRecovery = false
} = defineProps<Props>()

const emit = defineEmits<{
  addCreditCard: []
  back: []
}>()

const { locale } = useI18n()
const { copy, checkoutPlan } = useCheckoutCopy()

const plan = computed(() => checkoutPlan(tierKey, teamPlan))
</script>
