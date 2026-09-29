<template>
  <CheckoutSubscribeConfirm
    v-model:selected-saved-method-id="selectedSavedMethodId"
    :plan
    :copy
    :locale
    :publishable-key
    :theme-key="colorPaletteStore.activePaletteId"
    :billing-cycle
    :is-loading
    :preview-data
    :action-url
    :authentication-state
    :authentication-error
    :reconciliation-operation-id
    :parked-checkout-recovery
    :use-payment-element
    :saved-methods
    :quote-is-current
    :is-applying-promotion-code
    :embedded-checkout-enabled
    @add-credit-card="emit('addCreditCard')"
    @confirm-payment="emit('confirmPayment', $event)"
    @back="emit('back')"
    @change-payment-method="emit('changePaymentMethod')"
    @apply-promotion-code="emit('applyPromotionCode', $event)"
    @invalidate-quote="emit('invalidateQuote')"
    @payment-phase="emitPaymentJourneyPhase"
  />
</template>

<script setup lang="ts">
/**
 * The cloud app's binding of the shared new-subscription confirm: its tier
 * and team-stop catalog, its translations, its Stripe key and theme, and its
 * checkout-journey telemetry (ADR BILLING-WEB-0038).
 */
import { CheckoutSubscribeConfirm } from '@comfyorg/account-ui/billing/checkout'
import type { StripePaymentPhase } from '@comfyorg/account-ui/billing/stripe'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { TeamPlanSelection } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import type {
  BillingCycle,
  TierKey
} from '@/platform/cloud/subscription/constants/tierKey'
import { useTelemetry } from '@/platform/telemetry'
import type {
  BillingAuthenticationState,
  PreviewSubscribeResponse,
  SavedPaymentMethod
} from '@/platform/workspace/api/workspaceApi'
import { resolveStripePublishableKey } from '@/platform/workspace/billing/stripePublishableKey'
import { useCheckoutCopy } from '@/platform/workspace/composables/useCheckoutCopy'
import {
  getActiveCheckoutJourney,
  toCheckoutJourneyContext
} from '@/platform/workspace/utils/checkoutJourney'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

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
  authenticationError?: string | null
  reconciliationOperationId?: string | null
  parkedCheckoutRecovery?: boolean
  usePaymentElement?: boolean
  savedMethods?: SavedPaymentMethod[] | null
  quoteIsCurrent?: boolean
  isApplyingPromotionCode?: boolean
  embeddedCheckoutEnabled?: boolean
}

const {
  tierKey,
  billingCycle = 'monthly',
  isLoading = false,
  previewData = null,
  teamPlan = null,
  actionUrl = null,
  authenticationState = null,
  authenticationError = null,
  reconciliationOperationId = null,
  parkedCheckoutRecovery = false,
  usePaymentElement = false,
  savedMethods = null,
  quoteIsCurrent = false,
  isApplyingPromotionCode = false,
  embeddedCheckoutEnabled = false
} = defineProps<Props>()

const emit = defineEmits<{
  addCreditCard: []
  confirmPayment: [confirmationToken: string]
  back: []
  changePaymentMethod: []
  applyPromotionCode: [code: string]
  invalidateQuote: []
}>()

const selectedSavedMethodId = defineModel<string | null>(
  'selectedSavedMethodId',
  { default: null }
)

const { locale } = useI18n()
const { copy, checkoutPlan } = useCheckoutCopy()
const telemetry = useTelemetry()
const colorPaletteStore = useColorPaletteStore()

const publishableKey = resolveStripePublishableKey() ?? ''

const plan = computed(() => checkoutPlan(tierKey, teamPlan))

function emitPaymentJourneyPhase(phase: StripePaymentPhase): void {
  // The form stops reporting once unmounted; what it cannot know is whether
  // the active journey is still the one this checkout started.
  const journey = getActiveCheckoutJourney()
  if (!journey) return
  telemetry?.trackCheckoutJourneyEvent({
    ...toCheckoutJourneyContext(journey),
    ...phase
  })
}
</script>
