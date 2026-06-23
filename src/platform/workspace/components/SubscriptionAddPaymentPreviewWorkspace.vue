<template>
  <h2 class="m-0 mb-8 text-center text-xl text-muted-foreground lg:text-2xl">
    {{ $t('subscription.preview.confirmPayment') }}
  </h2>
  <div
    class="mx-auto flex h-full max-w-[400px] flex-col items-stretch justify-between text-sm"
  >
    <div class="">
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
        <div
          v-if="teamPlan"
          class="flex items-center gap-1 text-sm text-muted-foreground"
        >
          <i class="icon-[comfy--credits] size-3.5 shrink-0 bg-amber-400" />
          <span>{{ displayCredits }} {{ $t('subscription.perMonth') }}</span>
        </div>
        <span class="text-muted-foreground">
          {{ $t('subscription.preview.startingToday') }}
        </span>
      </div>

      <!-- Credits Section -->
      <div class="flex flex-col gap-3 pt-16 pb-8">
        <div class="flex items-center justify-between">
          <span class="text-base-foreground">
            {{ $t('subscription.preview.eachMonthCreditsRefill') }}
          </span>
          <div class="flex items-center gap-1">
            <i class="icon-[comfy--credits] size-4 shrink-0 bg-amber-400" />
            <span class="font-bold text-base-foreground">
              {{ displayCredits }}
            </span>
          </div>
        </div>

        <!-- Expandable Features -->
        <button
          class="flex cursor-pointer items-center justify-end gap-1 border-none bg-transparent p-0 text-sm text-muted-foreground hover:text-base-foreground"
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

      <!-- Total Due Section -->
      <div class="flex flex-col gap-2 border-t border-border-subtle pt-8">
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
    <!-- Footer -->
    <div class="flex flex-col gap-2 pt-8">
      <!-- Terms Agreement -->
      <SubscriptionTermsNote />

      <!-- Add Credit Card Button -->
      <Button
        variant="secondary"
        size="lg"
        class="w-full rounded-lg"
        :loading="isLoading"
        @click="$emit('addCreditCard')"
      >
        {{ $t('subscription.preview.subscribeToPlan', { plan: tierName }) }}
      </Button>

      <!-- Back Link -->
      <Button
        variant="textonly"
        class="cursor-pointer text-center text-xs text-muted-foreground transition-colors hover:bg-none hover:text-base-foreground"
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
import type { TeamPlanSelection } from '@/platform/cloud/subscription/constants/teamPlanCreditStops'
import {
  getTierCredits,
  getTierFeatures,
  getTierPrice
} from '@/platform/cloud/subscription/constants/tierPricing'
import type { TierKey } from '@/platform/cloud/subscription/constants/tierPricing'
import type { BillingCycle } from '@/platform/cloud/subscription/utils/subscriptionTierRank'
import type { PreviewSubscribeResponse } from '@/platform/workspace/api/workspaceApi'
import { cn } from '@comfyorg/tailwind-utils'

import SubscriptionTermsNote from './SubscriptionTermsNote.vue'

interface Props {
  /** Personal-tier checkout. Required unless `teamPlan` is set. */
  tierKey?: Exclude<TierKey, 'free' | 'founder'>
  billingCycle?: BillingCycle
  isLoading?: boolean
  previewData?: PreviewSubscribeResponse | null
  /** Team-plan checkout (selected slider stop); overrides tier-derived display. */
  teamPlan?: TeamPlanSelection | null
}

const {
  tierKey,
  billingCycle = 'monthly',
  isLoading = false,
  previewData = null,
  teamPlan = null
} = defineProps<Props>()

defineEmits<{
  addCreditCard: []
  back: []
}>()

const { t, n } = useI18n()

const isFeaturesCollapsed = ref(true)

const tierName = computed(() =>
  teamPlan
    ? t('subscription.teamPlan.name')
    : t(`subscription.tiers.${tierKey}.name`)
)

const displayPrice = computed(() => {
  if (teamPlan) return teamPlan.discountedUsd
  if (previewData?.new_plan) {
    return (previewData.new_plan.price_cents / 100).toFixed(0)
  }
  return tierKey ? getTierPrice(tierKey, billingCycle === 'yearly') : 0
})

const displayCredits = computed(() =>
  n(teamPlan ? teamPlan.credits : tierKey ? (getTierCredits(tierKey) ?? 0) : 0)
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
  if (teamPlan) return teamPlan.discountedUsd.toFixed(2)
  if (previewData) {
    return (previewData.cost_today_cents / 100).toFixed(2)
  }
  if (!tierKey) return '0.00'
  const priceValue = getTierPrice(tierKey, billingCycle === 'yearly')
  if (billingCycle === 'yearly') {
    return (priceValue * 12).toFixed(2)
  }
  return priceValue.toFixed(2)
})

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
