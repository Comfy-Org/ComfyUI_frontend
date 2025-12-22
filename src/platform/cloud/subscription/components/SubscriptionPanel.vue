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
                :label="$t('subscription.manageSubscription')"
                severity="secondary"
                class="ml-auto bg-interface-menu-component-surface-selected"
                :pt="{
                  root: {
                    style: 'border-radius: 8px; padding: 8px 16px;'
                  },
                  label: {
                    class: 'text-sm font-normal text-text-primary'
                  }
                }"
                @click="
                  async () => {
                    await authActions.accessBillingPortal()
                  }
                "
              />
              <Button
                v-if="isActiveSubscription"
                :label="$t('subscription.upgradePlan')"
                severity="primary"
                :pt="{
                  root: {
                    style: 'border-radius: 8px; padding: 8px 16px;'
                  },
                  label: {
                    class: 'text-sm font-normal text-text-primary'
                  }
                }"
                @click="showSubscriptionDialog"
              />

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
                    icon="pi pi-sync"
                    text
                    size="small"
                    class="absolute top-0.5 right-0"
                    :loading="isLoadingBalance"
                    :pt="{
                      icon: {
                        class: 'text-text-secondary text-xs'
                      },
                      loadingIcon: {
                        class: 'text-text-secondary text-xs'
                      }
                    }"
                    @click="handleRefresh"
                  />

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
                          icon="pi pi-question-circle"
                          text
                          rounded
                          size="small"
                          class="h-4 w-4 shrink-0"
                          :pt="{
                            icon: {
                              class: 'text-text-secondary text-xs'
                            }
                          }"
                        />
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
                      :label="$t('subscription.addCredits')"
                      severity="secondary"
                      class="p-2 min-h-8 bg-interface-menu-component-surface-selected"
                      :pt="{
                        root: {
                          style: 'border-radius: 8px;'
                        },
                        label: {
                          class: 'text-sm font-normal text-text-primary'
                        }
                      }"
                      @click="handleAddApiCredits"
                    />
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
            :label="$t('subscription.learnMore')"
            text
            severity="secondary"
            icon="pi pi-question-circle"
            class="text-xs"
            :pt="{
              label: {
                class: 'text-text-secondary'
              },
              icon: {
                class: 'text-text-secondary text-xs'
              }
            }"
            @click="handleLearnMoreClick"
          />
          <Button
            :label="$t('subscription.partnerNodesCredits')"
            text
            severity="secondary"
            icon="pi pi-question-circle"
            class="text-xs"
            :pt="{
              label: {
                class: 'text-text-secondary'
              },
              icon: {
                class: 'text-text-secondary text-xs'
              }
            }"
            @click="handleOpenPartnerNodesInfo"
          />
          <Button
            :label="$t('subscription.messageSupport')"
            text
            severity="secondary"
            icon="pi pi-comment"
            class="text-xs"
            :loading="isLoadingSupport"
            :pt="{
              label: {
                class: 'text-text-secondary'
              },
              icon: {
                class: 'text-text-secondary text-xs'
              }
            }"
            @click="handleMessageSupport"
          />
        </div>

        <Button
          :label="$t('subscription.invoiceHistory')"
          text
          severity="secondary"
          icon="pi pi-external-link"
          icon-pos="right"
          class="text-xs"
          :pt="{
            label: {
              class: 'text-text-secondary'
            },
            icon: {
              class: 'text-text-secondary text-xs'
            }
          }"
          @click="handleInvoiceHistory"
        />
      </div>
    </div>
  </TabPanel>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import TabPanel from 'primevue/tabpanel'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import CloudBadge from '@/components/topbar/CloudBadge.vue'
import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import { useExternalLink } from '@/composables/useExternalLink'
import SubscribeButton from '@/platform/cloud/subscription/components/SubscribeButton.vue'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { useSubscriptionActions } from '@/platform/cloud/subscription/composables/useSubscriptionActions'
import { useSubscriptionCredits } from '@/platform/cloud/subscription/composables/useSubscriptionCredits'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'
import {
  DEFAULT_TIER_KEY,
  TIER_TO_KEY,
  getTierCredits,
  getTierFeatures,
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
  isYearlySubscription,
  handleInvoiceHistory
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

  if (getTierFeatures(key).customLoRAs) {
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
