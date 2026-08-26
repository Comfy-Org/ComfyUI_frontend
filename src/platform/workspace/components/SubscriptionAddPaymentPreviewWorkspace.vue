<template>
  <div
    :class="
      cn(
        'mx-auto flex h-full max-w-[400px] flex-col items-stretch justify-between text-sm motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in motion-safe:slide-in-from-bottom-2',
        // Edge-to-edge Stripe-checkout split on desktop: the summary is a
        // flush full-height sidebar on base-background, payment beside it on
        // the shell. Mobile keeps the stacked flow.
        captureMode &&
          'xl:min-h-0 xl:w-full xl:max-w-none xl:flex-1 xl:flex-row xl:items-stretch xl:gap-0'
      )
    "
  >
    <div
      :class="
        cn(
          captureMode &&
            'xl:w-[42%] xl:shrink-0 xl:border-r xl:border-border-subtle xl:bg-base-background xl:px-12 xl:py-10',
          // Below xl the same dual tone runs vertically: the summary bleeds
          // dark to the dialog edges, payment continues on the shell below.
          captureMode &&
            'max-xl:-mx-4 max-xl:-mt-6 max-xl:rounded-t-2xl max-xl:bg-base-background max-xl:p-6'
        )
      "
    >
      <div
        :class="cn('mb-8 flex items-center gap-3', captureMode && 'xl:mb-10')"
      >
        <Button
          v-if="usePaymentElement"
          size="icon"
          variant="muted-textonly"
          class="shrink-0 rounded-full"
          :aria-label="$t('g.back')"
          :disabled="interactionLocked"
          @click="$emit('back')"
        >
          <i class="pi pi-arrow-left text-base" />
        </Button>
        <h2
          :class="
            cn(
              'm-0 flex-1 text-center text-xl font-semibold text-base-foreground lg:text-2xl',
              // In the sidebar the title goes quiet and the money block leads.
              captureMode &&
                'xl:text-left xl:text-base xl:font-medium xl:text-muted-foreground'
            )
          "
        >
          {{ $t('subscription.preview.confirmPayment') }}
        </h2>
      </div>
      <!-- Plan Header -->
      <div class="flex flex-col gap-2">
        <span class="text-sm text-base-foreground">
          {{ tierName }}
        </span>
        <div class="flex items-baseline gap-2">
          <span
            class="text-2xl font-semibold text-base-foreground tabular-nums"
          >
            ${{ displayPrice }}
          </span>
          <span class="text-base text-base-foreground">
            {{ $t('subscription.usdPerMonth') }}
          </span>
        </div>
        <span class="text-muted-foreground">
          {{
            isYearly
              ? $t('subscription.billedYearly', { total: annualTotalFormatted })
              : $t('subscription.billedMonthly')
          }}
        </span>
        <span class="text-muted-foreground">
          {{ $t('subscription.preview.startingToday') }}
        </span>
      </div>

      <!-- Credits Section -->
      <div
        :class="
          cn(
            'flex flex-col gap-3 pt-16 pb-8',
            usePaymentElement && 'xl:pt-6 xl:pb-4'
          )
        "
      >
        <div class="flex items-center justify-between">
          <span class="text-base-foreground">
            {{ $t(creditsRefillLabelKey) }}
          </span>
          <div class="flex items-center gap-1">
            <i class="icon-[lucide--coins] size-4 shrink-0 bg-credit" />
            <span class="font-bold text-base-foreground tabular-nums">
              {{ refillCredits }}
            </span>
          </div>
        </div>
      </div>

      <!-- Total Due Section -->
      <div
        :class="
          cn(
            'flex flex-col gap-2 border-t border-border-subtle pt-8',
            usePaymentElement && 'xl:pt-6'
          )
        "
      >
        <div class="flex items-center justify-between text-base">
          <span class="text-base-foreground">
            {{ $t('subscription.preview.totalDueToday') }}
          </span>
          <span class="font-bold text-base-foreground tabular-nums">
            {{ totalDueToday }}
          </span>
        </div>
        <span class="text-sm text-muted-foreground">
          {{ renewalTerms }}
        </span>
      </div>
      <div
        v-if="previewData?.discounts?.length"
        class="flex flex-col gap-2 pt-4 text-sm"
      >
        <div
          v-for="discount in previewData.discounts"
          :key="`${discount.kind}:${discount.code}`"
          class="flex items-center justify-between text-muted-foreground"
        >
          <span>{{
            $t(`subscription.preview.discount.${discount.kind}`)
          }}</span>
          <span class="text-base-foreground">
            {{ discount.name || discount.code
            }}<template v-if="discount.amount_off_cents">
              · −{{
                formatQuoteMoney(
                  discount.amount_off_cents,
                  previewData?.currency,
                  locale
                )
              }}</template
            >
          </span>
        </div>
      </div>
      <div v-if="embeddedCheckoutEnabled" class="flex gap-2 pt-6">
        <input
          v-model="promotionCode"
          :aria-label="$t('subscription.preview.promoCodePlaceholder')"
          :disabled="interactionLocked"
          class="h-10 min-w-0 flex-1 rounded-lg border border-interface-stroke bg-secondary-background px-3 text-base-foreground"
          :placeholder="$t('subscription.preview.promoCodePlaceholder')"
          @input="invalidateEditedPromotion"
        />
        <Button
          variant="secondary"
          size="lg"
          :disabled="interactionLocked"
          @click="$emit('applyPromotionCode', promotionCode)"
        >
          {{ $t('subscription.preview.applyPromoCode') }}
        </Button>
      </div>
      <!-- Saved method: no capture column; a card row with a change
           affordance stands in for the form. -->
      <div
        v-if="embeddedCheckoutEnabled && savedMethods?.length"
        class="flex flex-col gap-2 pt-6"
      >
        <span class="text-sm text-muted-foreground">
          {{ $t('subscription.preview.savedPaymentMethod') }}
        </span>
        <div
          v-if="savedMethods.length === 1"
          class="flex h-10 items-center gap-3 rounded-lg bg-secondary-background px-4"
        >
          <i
            :class="
              cn(
                'size-4 shrink-0',
                savedMethods[0].type === 'alipay'
                  ? 'icon-[lucide--wallet]'
                  : 'icon-[lucide--credit-card]'
              )
            "
          />
          <span class="text-sm text-base-foreground tabular-nums">
            {{ methodLabel(savedMethods[0]) }}
          </span>
          <Button
            variant="link"
            size="lg"
            class="ml-auto px-0"
            @click="$emit('changePaymentMethod')"
          >
            {{ $t('subscription.preview.changePaymentMethod') }}
          </Button>
        </div>
        <SingleSelect
          v-else
          v-model="selectedMethod"
          :options="savedMethodOptions"
          size="lg"
        />
      </div>
    </div>

    <!-- Footer (right column on desktop when the payment element is embedded;
         scrolls independently so the summary panel stays put) -->
    <div
      :class="
        cn(
          'flex flex-col gap-2 pt-8 pb-4',
          captureMode && 'xl:min-h-0 xl:min-w-0 xl:flex-1 xl:px-16 xl:py-10',
          // Match the summary panel's 24px edge inset (root p-4 provides 16).
          captureMode && 'max-xl:px-2'
        )
      "
    >
      <!-- Pending 3DS verification is the only actionable step, so it takes
           the top of the column; the pay button below it is demoted and
           disabled while it shows. -->
      <div
        v-if="embeddedCheckoutEnabled && reconciliationOperationId"
        class="rounded-lg border border-interface-stroke bg-secondary-background p-4"
      >
        <p class="m-0 font-semibold text-base-foreground">
          {{ $t('billingOperation.reconciliationTitle') }}
        </p>
        <p class="m-0 mt-1 text-sm text-muted-foreground">
          {{ $t('billingOperation.reconciliationDetail') }}
          <span class="font-mono">{{ reconciliationOperationId }}</span>
        </p>
      </div>

      <div
        v-if="
          embeddedCheckoutEnabled && authenticationState === 'failed_retryable'
        "
        role="alert"
        class="rounded-lg border border-interface-stroke bg-secondary-background p-4 text-sm text-base-foreground"
      >
        {{
          authenticationError ||
          (canRetryAuthentication
            ? $t('billingOperation.authenticationFailedDetail')
            : $t('billingOperation.authenticationManagerRequired'))
        }}
      </div>

      <Button
        v-if="
          embeddedCheckoutEnabled &&
          (authenticationState === 'failed_retryable' ||
            authenticationState === 'requires_action') &&
          canRetryAuthentication
        "
        variant="inverted"
        size="lg"
        class="w-full rounded-lg"
        :loading="isAuthenticating"
        @click="$emit('retryAuthentication')"
      >
        {{
          $t(
            authenticationState === 'failed_retryable'
              ? 'billingOperation.retryVerification'
              : 'subscription.preview.completeVerification'
          )
        }}
      </Button>

      <Button
        v-if="
          actionUrl &&
          !(
            (authenticationState === 'failed_retryable' ||
              authenticationState === 'requires_action') &&
            canRetryAuthentication
          )
        "
        variant="inverted"
        size="lg"
        class="w-full rounded-lg"
        @click="openVerification"
      >
        {{ $t('subscription.preview.completeVerification') }}
      </Button>

      <UnifiedStripePaymentSelector
        v-if="captureMode && quoteReady"
        :key="`${previewData?.quote_id}:${previewData?.quote_version}`"
        :amount-cents="amountDueCents"
        :currency="previewData?.currency ?? ''"
        :payment-method-configuration-id="
          previewData?.payment_method_configuration_id ?? ''
        "
        :is-loading
        :verification-pending="Boolean(actionUrl) || verificationRecoveryActive"
        :can-submit="quoteIsCurrent"
        @submitting-change="stripeSubmissionPending = $event"
        @confirm="confirmPayment"
      />

      <Button
        v-if="captureMode && !quoteReady"
        variant="inverted"
        size="lg"
        class="w-full rounded-lg"
        :loading="isLoading"
        :disabled="
          interactionLocked || !quoteIsUsable || verificationRecoveryActive
        "
        @click="$emit('addCreditCard')"
      >
        {{ $t('subscription.preview.payAndSubscribe') }}
      </Button>

      <Button
        v-if="savedMethods?.length"
        variant="inverted"
        size="lg"
        class="w-full rounded-lg"
        :loading="isLoading"
        :disabled="
          interactionLocked || !quoteIsUsable || verificationRecoveryActive
        "
        @click="$emit('addCreditCard')"
      >
        {{ $t('subscription.preview.payAndSubscribe') }}
      </Button>

      <Button
        v-if="!usePaymentElement && !savedMethods?.length"
        variant="tertiary"
        size="lg"
        class="w-full rounded-lg"
        :loading="isLoading"
        :disabled="
          interactionLocked || !quoteIsUsable || verificationRecoveryActive
        "
        @click="$emit('addCreditCard')"
      >
        {{ $t('subscription.preview.subscribeToPlan', { plan: tierName }) }}
      </Button>

      <!-- Terms Agreement (below the pay action, like Stripe checkout) -->
      <SubscriptionTermsNote class="mt-2" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import SingleSelect from '@/components/ui/single-select/SingleSelect.vue'
import type { TeamPlanSelection } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import {
  getTierCredits,
  getTierPrice
} from '@/platform/cloud/subscription/constants/tierPricing'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import { isYearlyCheckout } from '@/platform/cloud/subscription/utils/planDuration'
import { formatQuoteMoney } from '@/platform/cloud/subscription/utils/subscriptionQuoteFormatting'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import type {
  BillingAuthenticationState,
  PreviewSubscribeResponse,
  SavedPaymentMethod
} from '@/platform/workspace/api/workspaceApi'
import { cn } from '@comfyorg/tailwind-utils'

import SubscriptionTermsNote from './SubscriptionTermsNote.vue'
import UnifiedStripePaymentSelector from './UnifiedStripePaymentSelector.vue'

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
  canRetryAuthentication?: boolean
  isAuthenticating?: boolean
  reconciliationOperationId?: string | null
  usePaymentElement?: boolean
  /** Saved payment methods; when present the capture form is skipped and the
   *  confirm renders as a narrow summary. One method shows a Change
   *  affordance; two or more become a picker whose last option adds a new
   *  method. Cards carry brand + last4; Alipay is a linked account with
   *  neither. */
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
  canRetryAuthentication = false,
  isAuthenticating = false,
  reconciliationOperationId = null,
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
  retryAuthentication: []
}>()

const { locale, n, t } = useI18n()
const selectedSavedMethodId = defineModel<string | null>(
  'selectedSavedMethodId',
  { default: null }
)

// The wide capture split only applies while a payment method is being
// collected; with a saved method the confirm is a single narrow column.
const captureMode = computed(() => usePaymentElement && !savedMethods?.length)
const amountDueCents = computed(() => previewData?.amount_due_cents ?? 0)
// Stripe Elements are configured once, in onMounted, from the amount and
// currency. Mounting before the quote arrives — the team checkout shows its
// preview step while the quote is still in flight — permanently latches the
// "payment options are unavailable" error, because nothing re-initializes the
// element when the props later fill in.
const quoteReady = computed(
  () =>
    amountDueCents.value > 0 &&
    Boolean(previewData?.currency) &&
    Boolean(previewData?.quote_id) &&
    previewData?.quote_version !== undefined
)
const verificationRecoveryActive = computed(
  () =>
    embeddedCheckoutEnabled &&
    (authenticationState === 'requires_action' ||
      authenticationState === 'failed_retryable' ||
      Boolean(reconciliationOperationId))
)
const quoteIsUsable = computed(() => !embeddedCheckoutEnabled || quoteIsCurrent)

function methodLabel(m: SavedPaymentMethod) {
  if (m.type === 'alipay') return t('subscription.preview.alipay')
  return `${m.brand} •••• ${m.last4}`
}

const savedMethodOptions = computed(() => [
  ...(savedMethods ?? []).map((m) => ({
    name: methodLabel(m),
    value: m.id
  })),
  {
    name: t('subscription.preview.addNewPaymentMethod'),
    value: 'add-new'
  }
])
const selectedMethod = computed({
  get: () => selectedSavedMethodId.value ?? '',
  set: (value: string) => {
    if (value === 'add-new') {
      selectedSavedMethodId.value = null
      emit('changePaymentMethod')
      return
    }
    selectedSavedMethodId.value = value
  }
})

const promotionCode = ref(previewData?.promotion_code ?? '')
const stripeSubmissionPending = ref(false)
const interactionLocked = computed(
  () => isLoading || isApplyingPromotionCode || stripeSubmissionPending.value
)
watch(
  () => previewData?.promotion_code,
  (code) => {
    promotionCode.value = code ?? ''
  }
)

function invalidateEditedPromotion() {
  if (promotionCode.value !== (previewData?.promotion_code ?? '')) {
    emit('invalidateQuote')
  }
}

function openVerification() {
  if (!actionUrl) return
  window.open(actionUrl, '_blank', 'noopener,noreferrer')
}

function confirmPayment(confirmationToken: string) {
  emit('confirmPayment', confirmationToken)
}

const tierName = computed(() =>
  teamPlan
    ? t('subscription.teamPlan.name')
    : t(`subscription.tiers.${tierKey}.name`)
)

const isYearly = computed(() =>
  isYearlyCheckout(previewData?.new_plan.duration, billingCycle)
)

const displayPrice = computed(() => {
  if (teamPlan) return n(teamPlan.discountedUsd)
  if (previewData?.new_plan) {
    const cents = previewData.new_plan.price_cents
    return ((isYearly.value ? cents / 12 : cents) / 100).toFixed(0)
  }
  return tierKey ? getTierPrice(tierKey, isYearly.value) : 0
})

const annualTotalUsd = computed(() => {
  if (teamPlan) return teamPlan.discountedUsd * 12
  if (previewData?.new_plan) return previewData.new_plan.price_cents / 100
  return tierKey ? getTierPrice(tierKey, true) * 12 : 0
})

const annualTotalFormatted = computed(() => `$${n(annualTotalUsd.value)}`)

const monthlyCredits = computed(() =>
  teamPlan ? teamPlan.credits : tierKey ? (getTierCredits(tierKey) ?? 0) : 0
)

const refillCredits = computed(() =>
  n(isYearly.value ? monthlyCredits.value * 12 : monthlyCredits.value)
)

const creditsRefillLabelKey = computed(() =>
  isYearly.value
    ? 'subscription.preview.eachYearCreditsRefill'
    : 'subscription.preview.eachMonthCreditsRefill'
)

const totalDueToday = computed(() =>
  previewData?.amount_due_cents === undefined
    ? ''
    : formatQuoteMoney(
        previewData.amount_due_cents,
        previewData.currency,
        locale.value
      )
)

const renewalTerms = computed(() => {
  if (
    previewData?.renewal_amount_cents === undefined ||
    !previewData.renewal_at
  ) {
    return ''
  }
  const date = new Date(previewData.renewal_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  })
  return t('subscription.preview.renewsAt', {
    amount: formatQuoteMoney(
      previewData.renewal_amount_cents,
      previewData.currency,
      locale.value
    ),
    date
  })
})
</script>
