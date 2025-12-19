<template>
  <TabPanel value="PlanCredits" class="subscription-container h-full">
    <div class="flex h-full flex-col gap-6">
      <div class="flex items-center gap-2">
        <span class="text-2xl font-inter font-semibold leading-tight">
          {{
            isActiveSubscription
              ? $t('subscription.title')
              : $t('subscription.titleUnsubscribed')
          }}
        </span>
        <div class="pt-1">
          <CloudBadge
            reverse-order
            background-color="var(--p-dialog-background)"
          />
        </div>
      </div>

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
                  <span class="text-base">{{
                    $t('subscription.perMonth')
                  }}</span>
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
                v-if="isActiveSubscription"
                variant="secondary"
                class="ml-auto rounded-lg px-4 py-2 text-sm font-normal text-text-primary bg-interface-menu-component-surface-selected"
                @click="
                  async () => {
                    await authActions.accessBillingPortal()
                  }
                "
              >
                {{ $t('subscription.manageSubscription') }}
              </Button>
              <Button
                v-if="isActiveSubscription"
                variant="primary"
                class="rounded-lg px-4 py-2 text-sm font-normal text-text-primary"
                @click="showSubscriptionDialog"
              >
                {{ $t('subscription.upgradePlan') }}
              </Button>

              <SubscribeButton
                v-else
                :label="$t('subscription.subscribeNow')"
                size="small"
                :fluid="false"
                class="text-xs"
                @subscribed="handleRefresh"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 gap-6 pt-9 lg:grid-cols-2">
            <div class="flex flex-col flex-1">
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
                    variant="textonly"
                    size="icon-sm"
                    class="absolute top-0.5 right-0"
                    :loading="isLoadingBalance"
                    @click="handleRefresh"
                  >
                    <i class="pi pi-sync text-text-secondary text-xs" />
                  </Button>

                  <div class="flex flex-col gap-2">
                    <div class="text-sm text-muted">
                      {{ $t('subscription.totalCredits') }}
                    </div>
                    <Skeleton
                      v-if="isLoadingBalance"
                      width="8rem"
                      height="2rem"
                    />
                    <div v-else class="text-2xl font-bold">
                      {{ totalCredits }}
                    </div>
                  </div>

                  <!-- Credit Breakdown -->
                  <div class="flex flex-col gap-1">
                    <div class="flex items-center gap-4">
                      <Skeleton
                        v-if="isLoadingBalance"
                        width="3rem"
                        height="1rem"
                      />
                      <div
                        v-else
                        class="text-sm font-bold w-12 shrink-0 text-left text-muted"
                      >
                        {{ monthlyBonusCredits }}
                      </div>
                      <div class="flex items-center gap-1 min-w-0">
                        <div
                          class="text-sm truncate text-muted"
                          :title="$t('subscription.creditsRemainingThisMonth')"
                        >
                          {{ $t('subscription.creditsRemainingThisMonth') }}
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center gap-4">
                      <Skeleton
                        v-if="isLoadingBalance"
                        width="3rem"
                        height="1rem"
                      />
                      <div
                        v-else
                        class="text-sm font-bold w-12 shrink-0 text-left text-muted"
                      >
                        {{ prepaidCredits }}
                      </div>
                      <div class="flex items-center gap-1 min-w-0">
                        <div
                          class="text-sm truncate text-muted"
                          :title="$t('subscription.creditsYouveAdded')"
                        >
                          {{ $t('subscription.creditsYouveAdded') }}
                        </div>
                        <Button
                          v-tooltip="$t('subscription.prepaidCreditsInfo')"
                          variant="textonly"
                          size="icon-sm"
                          class="h-4 w-4 shrink-0 rounded-full"
                        >
                          <i
                            class="pi pi-question-circle text-text-secondary text-xs"
                          />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center justify-between">
                    <a
                      href="https://platform.comfy.org/profile/usage"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-sm underline text-center text-muted"
                    >
                      {{ $t('subscription.viewUsageHistory') }}
                    </a>
                    <Button
                      v-if="isActiveSubscription"
                      variant="secondary"
                      class="p-2 min-h-8 rounded-lg text-sm font-normal text-text-primary bg-interface-menu-component-surface-selected"
                      @click="handleAddApiCredits"
                    >
                      {{ $t('subscription.addCredits') }}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-2 flex-1">
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
            class="text-sm underline hover:opacity-80 text-muted"
          >
            {{ $t('subscription.viewMoreDetailsPlans') }}
          </a>
        </div>
      </div>

      <div
        class="flex items-center justify-between border-t border-interface-stroke pt-3"
      >
        <div class="flex gap-2">
          <Button
            variant="textonly"
            class="text-xs text-text-secondary"
            @click="handleLearnMoreClick"
          >
            <i class="pi pi-question-circle text-text-secondary text-xs" />
            {{ $t('subscription.learnMore') }}
          </Button>
          <Button
            variant="textonly"
            class="text-xs text-text-secondary"
            @click="handleOpenPartnerNodesInfo"
          >
            <i class="pi pi-question-circle text-text-secondary text-xs" />
            {{ $t('subscription.partnerNodesCredits') }}
          </Button>
          <Button
            variant="textonly"
            class="text-xs text-text-secondary"
            :loading="isLoadingSupport"
            @click="handleMessageSupport"
          >
            <i class="pi pi-comment text-text-secondary text-xs" />
            {{ $t('subscription.messageSupport') }}
          </Button>
        </div>

        <Button
          variant="textonly"
          class="text-xs text-text-secondary"
          @click="handleInvoiceHistory"
        >
          {{ $t('subscription.invoiceHistory') }}
          <i class="pi pi-external-link text-text-secondary text-xs" />
        </Button>
      </div>
    </div>
  </TabPanel>
</template>

<script setup lang="ts">
import Skeleton from 'primevue/skeleton'
import TabPanel from 'primevue/tabpanel'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import CloudBadge from '@/components/topbar/CloudBadge.vue'
import Button from '@/components/ui/button/Button.vue'
import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import { useExternalLink } from '@/composables/useExternalLink'
import SubscribeButton from '@/platform/cloud/subscription/components/SubscribeButton.vue'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { useSubscriptionActions } from '@/platform/cloud/subscription/composables/useSubscriptionActions'
import { useSubscriptionCredits } from '@/platform/cloud/subscription/composables/useSubscriptionCredits'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import {
  DEFAULT_TIER_KEY,
  TIER_FEATURES,
  TIER_TO_KEY,
  getTierCredits,
  getTierPrice
} from '@/platform/cloud/subscription/constants/tierPricing'
import { cn } from '@/utils/tailwindUtil'

const { buildDocsUrl, docsPaths } = useExternalLink()
const authActions = useFirebaseAuthActions()
const { t, n } = useI18n()

const {
  isActiveSubscription,
  isCancelled,
  formattedRenewalDate,
  formattedEndDate,
  subscriptionTier,
  subscriptionTierName,
  handleInvoiceHistory
} = useSubscription()

const { show: showSubscriptionDialog } = useSubscriptionDialog()

const tierKey = computed(() => {
  const tier = subscriptionTier.value
  if (!tier) return DEFAULT_TIER_KEY
  return TIER_TO_KEY[tier] ?? DEFAULT_TIER_KEY
})
const tierPrice = computed(() => getTierPrice(tierKey.value))

// Tier benefits for v-for loop
type BenefitType = 'metric' | 'feature'

interface Benefit {
  key: string
  type: BenefitType
  label: string
  value?: string
}

const tierBenefits = computed((): Benefit[] => {
  const key = tierKey.value

  const benefits: Benefit[] = [
    {
      key: 'monthlyCredits',
      type: 'metric',
      value: n(getTierCredits(key)),
      label: t('subscription.monthlyCreditsLabel')
    },
    {
      key: 'maxDuration',
      type: 'metric',
      value: t(`subscription.maxDuration.${key}`),
      label: t('subscription.maxDurationLabel')
    },
    {
      key: 'gpu',
      type: 'feature',
      label: t('subscription.gpuLabel')
    },
    {
      key: 'addCredits',
      type: 'feature',
      label: t('subscription.addCreditsLabel')
    }
  ]

  if (TIER_FEATURES[key].customLoRAs) {
    benefits.push({
      key: 'customLoRAs',
      type: 'feature',
      label: t('subscription.customLoRAsLabel')
    })
  }

  return benefits
})

const { totalCredits, monthlyBonusCredits, prepaidCredits, isLoadingBalance } =
  useSubscriptionCredits()

const {
  isLoadingSupport,
  handleAddApiCredits,
  handleMessageSupport,
  handleRefresh,
  handleLearnMoreClick
} = useSubscriptionActions()

const handleOpenPartnerNodesInfo = () => {
  window.open(
    buildDocsUrl(docsPaths.partnerNodesPricing, { includeLocale: true }),
    '_blank'
  )
}
</script>

<style scoped>
:deep(.bg-comfy-menu-secondary) {
  background-color: transparent;
}
</style>
