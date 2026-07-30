<template>
  <h2
    :class="
      cn(
        'm-0 mb-8 text-center text-xl font-semibold text-base-foreground lg:text-2xl',
        usePaymentElement && 'xl:mb-4'
      )
    "
  >
    {{ $t('subscription.preview.confirmPayment') }}
  </h2>
  <div
    :class="
      cn(
        'mx-auto flex h-full max-w-[400px] flex-col items-stretch justify-between text-sm',
        // Stripe-checkout shape on desktop: order summary left, payment
        // right, inside the pricing table's dialog footprint. Mobile keeps
        // the stacked flow.
        usePaymentElement &&
          'xl:min-h-0 xl:max-w-none xl:flex-1 xl:flex-row xl:items-stretch xl:justify-center xl:gap-16'
      )
    "
  >
    <!-- Dual-tone summary panel: same recipe as the pricing table's inner
         box (rounded, bg-base-background, borderless) on the dialog's
         secondary-background shell. -->
    <div
      :class="
        cn(
          usePaymentElement &&
            'xl:w-[440px] xl:shrink-0 xl:rounded-2xl xl:bg-base-background xl:px-8 xl:py-6'
        )
      "
    >
      <!-- Plan Header -->
      <div class="flex flex-col gap-2">
        <span class="text-sm text-base-foreground">
          {{ tierName }}
        </span>
        <div class="flex items-baseline gap-2">
          <span class="text-4xl font-semibold text-base-foreground">
            ${{ displayPrice }}
          </span>
          <span class="text-xl text-base-foreground">
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
            <span class="font-bold text-base-foreground">
              {{ refillCredits }}
            </span>
          </div>
        </div>

        <!-- Expandable Features -->
        <button
          class="flex cursor-pointer items-center justify-end gap-1 border-none bg-transparent p-0 font-inter text-sm text-muted-foreground hover:text-base-foreground"
          @click="isFeaturesCollapsed = !isFeaturesCollapsed"
        >
          <span>
            {{
              isFeaturesCollapsed
                ? $t('subscription.preview.showMoreFeatures')
                : $t('subscription.preview.hideFeatures')
            }}
          </span>
          <i
            :class="
              cn(
                'pi text-xs',
                isFeaturesCollapsed ? 'pi-chevron-down' : 'pi-chevron-up'
              )
            "
          />
        </button>
        <div v-show="!isFeaturesCollapsed" class="flex flex-col gap-2 pt-2">
          <template v-if="teamPlan">
            <div
              v-for="perk in teamPerks"
              :key="perk"
              class="flex items-center gap-2"
            >
              <i class="pi pi-check text-success-foreground text-xs" />
              <span class="text-sm text-base-foreground">{{ perk }}</span>
            </div>
          </template>
          <template v-else>
            <div class="flex items-center justify-between">
              <span class="text-sm text-base-foreground">
                {{ $t('subscription.maxDurationLabel') }}
              </span>
              <span class="text-sm font-bold text-base-foreground">
                {{ maxDuration }}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-base-foreground">
                {{ $t('subscription.gpuLabel') }}
              </span>
              <i class="pi pi-check text-success-foreground text-xs" />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-base-foreground">
                {{ $t('subscription.addCreditsLabel') }}
              </span>
              <i class="pi pi-check text-success-foreground text-xs" />
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-base-foreground">
                {{ $t('subscription.customLoRAsLabel') }}
              </span>
              <i
                v-if="hasCustomLoRAs"
                class="pi pi-check text-success-foreground text-xs"
              />
              <i v-else class="pi pi-times text-xs text-muted-foreground" />
            </div>
          </template>
        </div>
      </div>

      <!-- Promo code (Figma 5379-30077): below the money block, directly
           above the divider — adjacent to the number it changes. Validation
           and discount math need the BE preview endpoint; until then the
           code rides along at confirm exactly as before. -->
      <div v-if="usePaymentElement" class="pb-4">
        <Button
          v-if="!isPromoOpen"
          variant="link"
          size="lg"
          class="self-start px-0"
          @click="isPromoOpen = true"
        >
          {{ $t('subscription.preview.addPromoCode') }}
        </Button>
        <Input
          v-else
          v-model="promotionCode"
          class="w-full"
          :placeholder="$t('subscription.preview.promotionCodePlaceholder')"
          autocomplete="off"
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
          <span class="font-bold text-base-foreground">
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
            'xl:min-h-0 xl:w-[480px] xl:min-w-0 xl:overflow-x-hidden xl:overflow-y-auto xl:pt-0 xl:pr-2'
        )
      "
    >
      <UnifiedStripePaymentSelector
        v-if="usePaymentElement"
        :amount-cents="amountDueCents"
        :is-loading
        :promotion-code="promotionCode"
        @confirm="confirmPayment"
      />

      <Button
        v-if="actionUrl"
        variant="primary"
        size="lg"
        class="w-full rounded-lg"
        @click="openVerification"
      >
        {{ $t('subscription.preview.completeVerification') }}
      </Button>

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
      <SubscriptionTermsNote />

      <!-- Back Link -->
      <Button
        variant="textonly"
        class="cursor-pointer text-center text-xs text-muted-foreground transition-colors hover:bg-none hover:text-base-foreground"
        :disabled="isLoading"
        @click="$emit('back')"
      >
        {{ $t('subscription.preview.backToAllPlans') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import type { TeamPlanSelection } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import {
  getTierCredits,
  getTierFeatures,
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

const isFeaturesCollapsed = ref(true)
const isPromoOpen = ref(false)
const promotionCode = ref('')

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

const teamPerks = computed(() => [
  t('subscription.teamPlan.perkInviteMembers'),
  t('subscription.teamPlan.perkConcurrentRuns'),
  t('subscription.teamPlan.perkSharedPool'),
  t('subscription.teamPlan.perkRolePermissions')
])

const hasCustomLoRAs = computed(() =>
  tierKey ? getTierFeatures(tierKey).customLoRAs : false
)
const maxDuration = computed(() => t(`subscription.maxDuration.${tierKey}`))

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
