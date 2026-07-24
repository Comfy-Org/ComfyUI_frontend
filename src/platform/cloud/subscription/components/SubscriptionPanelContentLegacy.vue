<template>
  <div class="grow overflow-auto">
    <div class="rounded-2xl border border-interface-stroke p-6">
      <div>
        <div class="flex items-center justify-between gap-2">
          <div class="flex flex-col gap-2">
            <div class="text-sm font-bold text-text-primary">
              {{ subscriptionTierName }}
            </div>
            <div class="flex items-baseline gap-1 font-inter font-semibold">
              <span class="text-2xl">${{ tierPrice }}</span>
              <span class="text-base">{{ $t('subscription.perMonth') }}</span>
            </div>
            <div
              v-if="isActiveSubscription"
              class="text-sm text-text-secondary"
            >
              <template v-if="isCancelled">
                {{
                  $t('subscription.expiresDate', {
                    date: formattedEndDate
                  })
                }}
              </template>
              <template v-else>
                {{
                  $t('subscription.renewsDate', {
                    date: formattedRenewalDate
                  })
                }}
              </template>
            </div>
          </div>

          <Button
            v-if="isActiveSubscription && !isFreeTier"
            variant="secondary"
            class="ml-auto rounded-lg bg-interface-menu-component-surface-selected px-4 py-2 text-sm font-normal text-text-primary"
            @click="handleManageSubscription"
          >
            {{ $t('subscription.manageSubscription') }}
          </Button>
          <Button
            v-if="isActiveSubscription"
            variant="primary"
            class="rounded-lg px-4 py-2 text-sm font-normal text-text-primary"
            @click="
              showSubscriptionDialog({ reason: 'settings_billing_panel' })
            "
          >
            {{ $t('subscription.upgradePlan') }}
          </Button>

          <SubscribeButton
            v-if="!isActiveSubscription"
            :label="$t('subscription.subscribeNow')"
            size="sm"
            :fluid="false"
            class="text-xs"
            @subscribed="handleRefresh"
          />
        </div>
      </div>

      <div class="flex flex-col gap-6 pt-9 lg:flex-row">
        <div class="w-full lg:max-w-md">
          <CreditsTile />
        </div>

        <div class="flex flex-col gap-2">
          <div class="text-sm text-text-primary">
            {{ $t('subscription.yourPlanIncludes') }}
          </div>

          <div class="flex flex-col gap-0">
            <div
              v-for="benefit in tierBenefits"
              :key="benefit.key"
              class="flex items-center gap-2 py-2"
            >
              <i
                v-if="benefit.type === 'feature'"
                class="pi pi-check text-xs text-text-primary"
              />
              <span
                v-else-if="benefit.type === 'metric' && benefit.value"
                class="text-sm font-normal whitespace-nowrap text-text-primary"
              >
                {{ benefit.value }}
              </span>
              <span class="text-sm text-muted">
                {{ benefit.label }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- View More Details - Outside main content -->
    <div class="flex items-center gap-2 py-4">
      <i class="pi pi-external-link text-muted"></i>
      <a
        href="https://www.comfy.org/cloud/pricing"
        target="_blank"
        rel="noopener noreferrer"
        class="text-sm text-muted underline hover:opacity-80"
      >
        {{ $t('subscription.viewMoreDetailsPlans') }}
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import CreditsTile from '@/platform/cloud/subscription/components/CreditsTile.vue'
import SubscribeButton from '@/platform/cloud/subscription/components/SubscribeButton.vue'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { useTelemetry } from '@/platform/telemetry'
import { useSubscriptionActions } from '@/platform/cloud/subscription/composables/useSubscriptionActions'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import {
  DEFAULT_TIER_KEY,
  TIER_TO_KEY,
  getTierPrice
} from '@/platform/cloud/subscription/constants/tierPricing'
import type { TierBenefit } from '@/platform/cloud/subscription/utils/tierBenefits'
import { getCommonTierBenefits } from '@/platform/cloud/subscription/utils/tierBenefits'

const authActions = useAuthActions()
const { t, n } = useI18n()

const {
  isActiveSubscription,
  isCancelled,
  isFreeTier,
  formattedRenewalDate,
  formattedEndDate,
  subscriptionTier,
  subscriptionTierName,
  isYearlySubscription
} = useSubscription()

const { show: showSubscriptionDialog } = useSubscriptionDialog()

const tierKey = computed(() => {
  const tier = subscriptionTier.value
  if (!tier) return DEFAULT_TIER_KEY
  return TIER_TO_KEY[tier] ?? DEFAULT_TIER_KEY
})
const tierPrice = computed(() =>
  getTierPrice(tierKey.value, isYearlySubscription.value)
)

// The portal is the only place a legacy user can cancel (in-app UI already
// covers plan changes), so this click is the closest observable cancel-intent
// signal on the mainline path.
async function handleManageSubscription() {
  useTelemetry()?.trackSubscriptionCancellation('flow_opened', {
    source: 'manage_subscription_button',
    current_tier: subscriptionTier.value?.toLowerCase(),
    cycle: isYearlySubscription.value ? 'yearly' : 'monthly'
  })
  await authActions.accessBillingPortal()
}

const tierBenefits = computed((): TierBenefit[] =>
  getCommonTierBenefits(tierKey.value, t, n)
)

const { handleRefresh } = useSubscriptionActions()
</script>

<style scoped>
:deep(.bg-comfy-menu-secondary) {
  background-color: transparent;
}
</style>
