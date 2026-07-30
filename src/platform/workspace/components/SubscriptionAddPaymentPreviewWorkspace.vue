<template>
  <div
    :class="
      cn(
        'mx-auto flex h-full max-w-[400px] flex-col items-stretch justify-between text-sm',
        // Edge-to-edge Stripe-checkout split on desktop: the summary is a
        // flush full-height sidebar on base-background, payment beside it on
        // the shell. Mobile keeps the stacked flow.
        usePaymentElement &&
          'xl:min-h-0 xl:w-full xl:max-w-none xl:flex-1 xl:flex-row xl:items-stretch xl:gap-0'
      )
    "
  >
    <div
      :class="
        cn(
          usePaymentElement &&
            'xl:w-[42%] xl:shrink-0 xl:border-r xl:border-border-subtle xl:bg-base-background xl:px-12 xl:py-10'
        )
      "
    >
      <div
        :class="
          cn('mb-8 flex items-center gap-3', usePaymentElement && 'xl:mb-10')
        "
      >
        <Button
          v-if="usePaymentElement"
          size="icon"
          variant="muted-textonly"
          class="shrink-0 rounded-full"
          :aria-label="$t('g.back')"
          :disabled="isLoading"
          @click="$emit('back')"
        >
          <i class="pi pi-arrow-left text-base" />
        </Button>
        <h2
          :class="
            cn(
              'm-0 flex-1 text-center text-xl font-semibold text-base-foreground lg:text-2xl',
              // In the sidebar the title goes quiet and the money block leads.
              usePaymentElement &&
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
            :class="
              cn(
                'text-4xl font-semibold text-base-foreground tabular-nums',
                usePaymentElement && 'xl:text-2xl'
              )
            "
          >
            ${{ displayPrice }}
          </span>
          <span
            :class="
              cn(
                'text-xl text-base-foreground',
                usePaymentElement && 'xl:text-base'
              )
            "
          >
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
            <i class="icon-[comfy--credits] size-4 shrink-0 bg-credit" />
            <span class="font-bold text-base-foreground tabular-nums">
              {{ refillCredits }}
            </span>
          </div>
        </div>
      </div>

      <!-- Promo code (Figma 5379-30077): below the money block, directly
           above the divider — adjacent to the number it changes. Validation
           and discount math need the BE preview endpoint; until then the
           code rides along at confirm exactly as before. -->
      <div v-if="usePaymentElement" class="pb-4">
        <Button
          v-if="!isPromoOpen"
          variant="secondary"
          size="lg"
          class="self-start"
          @click="openPromo"
        >
          {{ $t('subscription.preview.addPromoCode') }}
        </Button>
        <Input
          v-else
          ref="promoInput"
          v-model="promotionCode"
          class="w-full"
          :placeholder="$t('subscription.preview.promotionCodePlaceholder')"
          autocomplete="off"
          @blur="onPromoBlur"
        />
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
            ${{ totalDueToday }}
          </span>
        </div>
        <span class="text-sm text-muted-foreground">
          {{
            $t('subscription.preview.nextPaymentDue', {
              date: nextPaymentDate
            })
          }}
        </span>
      </div>
    </div>
    <!-- Footer (right column on desktop when the payment element is embedded;
         scrolls independently so the summary panel stays put) -->
    <div
      :class="
        cn(
          'flex flex-col gap-2 pt-8',
          usePaymentElement &&
            'xl:min-h-0 xl:min-w-0 xl:flex-1 xl:px-16 xl:py-10'
        )
      "
    >
      <!-- Pending 3DS verification is the only actionable step, so it takes
           the top of the column; the pay button below it is demoted and
           disabled while it shows. -->
      <Button
        v-if="actionUrl"
        variant="inverted"
        size="lg"
        class="w-full rounded-lg"
        @click="openVerification"
      >
        {{ $t('subscription.preview.completeVerification') }}
      </Button>

      <UnifiedStripePaymentSelector
        v-if="usePaymentElement"
        :amount-cents="amountDueCents"
        :is-loading
        :promotion-code="promotionCode"
        :verification-pending="Boolean(actionUrl)"
        @confirm="confirmPayment"
      />

      <Button
        v-if="!usePaymentElement"
        variant="tertiary"
        size="lg"
        class="w-full rounded-lg"
        :loading="isLoading"
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
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import type { TeamPlanSelection } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import {
  getTierCredits,
  getTierPrice
} from '@/platform/cloud/subscription/constants/tierPricing'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import { isYearlyCheckout } from '@/platform/cloud/subscription/utils/planDuration'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import type { PreviewSubscribeResponse } from '@/platform/workspace/api/workspaceApi'
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
  usePaymentElement?: boolean
}

const {
  tierKey,
  billingCycle = 'monthly',
  isLoading = false,
  previewData = null,
  teamPlan = null,
  actionUrl = null,
  usePaymentElement = false
} = defineProps<Props>()

const emit = defineEmits<{
  addCreditCard: []
  confirmPayment: [confirmationToken: string, promotionCode?: string]
  back: []
}>()

const { t, n } = useI18n()

const isPromoOpen = ref(false)
const promotionCode = ref('')
const promoInput = ref<InstanceType<typeof Input>>()

function openPromo() {
  isPromoOpen.value = true
  void nextTick(() => {
    const el = promoInput.value?.$el
    if (el instanceof HTMLInputElement) el.focus()
  })
}

// An empty field collapses back to the button on blur; a typed code keeps
// the field so the entered value stays visible.
function onPromoBlur() {
  if (!promotionCode.value.trim()) isPromoOpen.value = false
}

function openVerification() {
  if (!actionUrl) return
  window.open(actionUrl, '_blank', 'noopener,noreferrer')
}

function confirmPayment(confirmationToken: string, promotionCode?: string) {
  emit('confirmPayment', confirmationToken, promotionCode)
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
  if (teamPlan) return teamPlan.discountedUsd
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

const totalDueToday = computed(() => {
  if (teamPlan) {
    const total = isYearly.value
      ? teamPlan.discountedUsd * 12
      : teamPlan.discountedUsd
    return total.toFixed(2)
  }
  if (previewData) {
    return (previewData.cost_today_cents / 100).toFixed(2)
  }
  if (!tierKey) return '0.00'
  const priceValue = getTierPrice(tierKey, isYearly.value)
  return (isYearly.value ? priceValue * 12 : priceValue).toFixed(2)
})

const amountDueCents = computed(() =>
  Math.round(Number(totalDueToday.value) * 100)
)

const nextPaymentDate = computed(() => {
  if (previewData?.new_plan?.period_end) {
    return new Date(previewData.new_plan.period_end).toLocaleDateString(
      'en-US',
      {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }
    )
  }
  const date = new Date()
  if (billingCycle === 'yearly') {
    date.setFullYear(date.getFullYear() + 1)
  } else {
    date.setMonth(date.getMonth() + 1)
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
})
</script>
