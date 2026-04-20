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
              v-if="canAccessSubscriptionFeatures"
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
            v-if="canAccessSubscriptionFeatures && !isFreeTier"
            variant="secondary"
            class="ml-auto rounded-lg bg-interface-menu-component-surface-selected px-4 py-2 text-sm font-normal text-text-primary"
            @click="
              async () => {
                await authActions.accessBillingPortal()
              }
            "
          >
            {{ $t('subscription.manageSubscription') }}
          </Button>
          <Button
            v-if="canAccessSubscriptionFeatures"
            variant="primary"
            class="rounded-lg px-4 py-2 text-sm font-normal text-text-primary"
            @click="showSubscriptionDialog"
          >
            {{ $t('subscription.upgradePlan') }}
          </Button>

          <SubscribeButton
            v-if="!canAccessSubscriptionFeatures"
            :label="$t('subscription.subscribeNow')"
            size="sm"
            :fluid="false"
            class="text-xs"
            @subscribed="handleRefresh"
          />
        </div>
      </div>

      <div class="flex flex-col gap-6 pt-9 lg:flex-row">
        <div class="flex shrink-0 flex-col">
          <div class="flex flex-col gap-3">
            <div
              :class="
                cn(
                  'relative flex flex-col gap-6 rounded-2xl p-5',
                  'bg-modal-panel-background'
                )
              "
            >
              <Button
                variant="muted-textonly"
                size="icon-sm"
                class="absolute top-4 right-4"
                :loading="isLoadingBalance"
                :aria-label="$t('subscription.refreshCredits')"
                @click="handleRefresh"
              >
                <i class="pi pi-sync text-sm text-text-secondary" />
              </Button>

              <div class="flex flex-col gap-2">
                <div class="text-sm text-muted">
                  {{ $t('subscription.totalCredits') }}
                </div>
                <Skeleton v-if="isLoadingBalance" width="8rem" height="2rem" />
                <div v-else class="text-2xl font-bold">
                  {{ totalCredits }}
                </div>
              </div>

              <!-- Credit Breakdown -->
              <table class="text-sm text-muted">
                <tbody>
                  <tr>
                    <td class="pr-4 text-left align-middle font-bold">
                      <Skeleton
                        v-if="isLoadingBalance"
                        width="5rem"
                        height="1rem"
                      />
                      <span v-else>{{ includedCreditsDisplay }}</span>
                    </td>
                    <td class="align-middle" :title="creditsRemainingLabel">
                      {{ creditsRemainingLabel }}
                    </td>
                  </tr>
                  <tr>
                    <td class="pr-4 text-left align-middle font-bold">
                      <Skeleton
                        v-if="isLoadingBalance"
                        width="3rem"
                        height="1rem"
                      />
                      <span v-else>{{ prepaidCredits }}</span>
                    </td>
                    <td
                      class="align-middle"
                      :title="$t('subscription.creditsYouveAdded')"
                    >
                      {{ $t('subscription.creditsYouveAdded') }}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div class="flex flex-col gap-3">
                <a
                  href="https://platform.comfy.org/profile/usage"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-sm text-muted underline"
                >
                  {{ $t('subscription.viewUsageHistory') }}
                </a>
                <Button
                  v-if="canAccessSubscriptionFeatures && isFreeTier"
                  variant="gradient"
                  class="min-h-8 w-full rounded-lg p-2 text-sm font-normal"
                  @click="handleUpgradeToAddCredits"
                >
                  {{ $t('subscription.upgradeToAddCredits') }}
                </Button>
                <Button
                  v-else-if="canAccessSubscriptionFeatures"
                  variant="secondary"
                  class="min-h-8 rounded-lg bg-interface-menu-component-surface-selected p-2 text-sm font-normal text-text-primary"
                  @click="handleAddApiCredits"
                >
                  {{ $t('subscription.addCredits') }}
                </Button>
              </div>
            </div>
          </div>
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
import Skeleton from 'primevue/skeleton'
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import { useAuthActions } from '@/composables/auth/useAuthActions'
import SubscribeButton from '@/platform/cloud/subscription/components/SubscribeButton.vue'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { useSubscriptionActions } from '@/platform/cloud/subscription/composables/useSubscriptionActions'
import { useSubscriptionCredits } from '@/platform/cloud/subscription/composables/useSubscriptionCredits'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import {
  DEFAULT_TIER_KEY,
  TIER_TO_KEY,
  getTierCredits,
  getTierPrice
} from '@/platform/cloud/subscription/constants/tierPricing'
import type { TierBenefit } from '@/platform/cloud/subscription/utils/tierBenefits'
import { getCommonTierBenefits } from '@/platform/cloud/subscription/utils/tierBenefits'
import { cn } from '@/utils/tailwindUtil'

const authActions = useAuthActions()
const { t, n } = useI18n()

const {
  canAccessSubscriptionFeatures,
  isCancelled,
  isFreeTier,
  formattedRenewalDate,
  formattedEndDate,
  subscriptionTier,
  subscriptionTierName,
  subscriptionStatus,
  isYearlySubscription
} = useSubscription()

const { show: showSubscriptionDialog, showPricingTable } =
  useSubscriptionDialog()

const tierKey = computed(() => {
  const tier = subscriptionTier.value
  if (!tier) return DEFAULT_TIER_KEY
  return TIER_TO_KEY[tier] ?? DEFAULT_TIER_KEY
})
const tierPrice = computed(() =>
  getTierPrice(tierKey.value, isYearlySubscription.value)
)

const refillsDate = computed(() => {
  if (!subscriptionStatus.value?.renewal_date) return ''
  const date = new Date(subscriptionStatus.value.renewal_date)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear()).slice(-2)
  return `${month}/${day}/${year}`
})

const creditsRemainingLabel = computed(() =>
  isYearlySubscription.value
    ? t(
        'subscription.creditsRemainingThisYear',
        {
          date: refillsDate.value
        },
        {
          escapeParameter: false
        }
      )
    : t(
        'subscription.creditsRemainingThisMonth',
        {
          date: refillsDate.value
        },
        {
          escapeParameter: false
        }
      )
)

const planTotalCredits = computed(() => {
  const credits = getTierCredits(tierKey.value)
  if (credits === null) return '—'
  const total = isYearlySubscription.value ? credits * 12 : credits
  return n(total)
})

const includedCreditsDisplay = computed(
  () => `${monthlyBonusCredits.value} / ${planTotalCredits.value}`
)

const tierBenefits = computed((): TierBenefit[] =>
  getCommonTierBenefits(tierKey.value, t, n)
)

const { totalCredits, monthlyBonusCredits, prepaidCredits, isLoadingBalance } =
  useSubscriptionCredits()

const { handleAddApiCredits, handleRefresh } = useSubscriptionActions()

function handleUpgradeToAddCredits() {
  showPricingTable()
}

// Focus-based polling: refresh balance when user returns from Stripe checkout
const PENDING_TOPUP_KEY = 'pending_topup_timestamp'
const TOPUP_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

function handleWindowFocus() {
  const timestampStr = localStorage.getItem(PENDING_TOPUP_KEY)
  if (!timestampStr) return

  const timestamp = parseInt(timestampStr, 10)

  // Clear expired tracking (older than 5 minutes)
  if (Date.now() - timestamp > TOPUP_EXPIRY_MS) {
    localStorage.removeItem(PENDING_TOPUP_KEY)
    return
  }

  // Refresh and clear tracking to prevent repeated calls
  void handleRefresh()
  localStorage.removeItem(PENDING_TOPUP_KEY)
}

onMounted(() => {
  window.addEventListener('focus', handleWindowFocus)
})

onBeforeUnmount(() => {
  window.removeEventListener('focus', handleWindowFocus)
})
</script>

<style scoped>
:deep(.bg-comfy-menu-secondary) {
  background-color: transparent;
}
</style>
