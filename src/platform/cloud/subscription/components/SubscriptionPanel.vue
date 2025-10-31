<template>
  <TabPanel value="PlanCredits" class="subscription-container h-full">
    <div class="flex h-full flex-col gap-6">
      <div class="flex items-baseline gap-2">
        <span class="text-2xl font-inter font-semibold leading-tight">
          {{ $t('subscription.title') }}
        </span>
        <CloudBadge
          reverse-order
          background-color="var(--p-dialog-background)"
        />
      </div>

      <div class="grow overflow-auto">
        <div class="rounded-2xl border border-interface-stroke p-6">
          <div>
            <div class="flex items-center justify-between">
              <div>
                <div class="flex items-baseline gap-1 font-inter font-semibold">
                  <span class="text-2xl">{{ formattedMonthlyPrice }}</span>
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
                class="text-xs bg-interface-menu-component-surface-selected"
                :pt="{
                  root: {
                    style: 'border-radius: 8px; padding: 8px 16px;'
                  },
                  label: {
                    class: 'text-text-primary'
                  }
                }"
                @click="manageSubscription"
              />
              <SubscribeButton
                v-else
                :label="$t('subscription.subscribeNow')"
                size="small"
                class="text-xs"
                @subscribed="handleRefresh"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 gap-6 pt-9 lg:grid-cols-2">
            <div class="flex flex-col flex-1">
              <div class="flex flex-col gap-3">
                <div class="flex flex-col">
                  <div class="text-sm">
                    {{ $t('subscription.partnerNodesBalance') }}
                  </div>
                  <div class="flex items-center">
                    <div class="text-sm text-muted">
                      {{ $t('subscription.partnerNodesDescription') }}
                    </div>
                  </div>
                </div>

                <div
                  :class="
                    cn(
                      'relative flex flex-col gap-6 rounded-2xl p-5',
                      'bg-smoke-100 dark-theme:bg-charcoal-600'
                    )
                  "
                >
                  <Button
                    v-tooltip="refreshTooltip"
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
                    <div class="text-sm text-text-secondary">
                      {{ $t('subscription.totalCredits') }}
                    </div>
                    <Skeleton
                      v-if="isLoadingBalance"
                      width="8rem"
                      height="2rem"
                    />
                    <div v-else class="text-2xl font-bold">
                      ${{ totalCredits }}
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
                      <div v-else class="text-sm text-text-secondary font-bold">
                        ${{ monthlyBonusCredits }}
                      </div>
                      <div class="flex items-center gap-1">
                        <div class="text-sm text-text-secondary">
                          {{ $t('subscription.monthlyBonusDescription') }}
                        </div>
                        <Button
                          v-tooltip="$t('subscription.monthlyCreditsRollover')"
                          icon="pi pi-question-circle"
                          text
                          rounded
                          size="small"
                          class="h-4 w-4"
                          :pt="{
                            icon: {
                              class: 'text-text-secondary text-xs'
                            }
                          }"
                        />
                      </div>
                    </div>
                    <div class="flex items-center gap-4">
                      <Skeleton
                        v-if="isLoadingBalance"
                        width="3rem"
                        height="1rem"
                      />
                      <div v-else class="text-sm text-text-secondary font-bold">
                        ${{ prepaidCredits }}
                      </div>
                      <div class="flex items-center gap-1">
                        <div class="text-sm text-text-secondary">
                          {{ $t('subscription.prepaidDescription') }}
                        </div>
                        <Button
                          v-tooltip="$t('subscription.prepaidCreditsInfo')"
                          icon="pi pi-question-circle"
                          text
                          rounded
                          size="small"
                          class="h-4 w-4"
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
                      class="text-sm text-text-secondary underline hover:text-text-secondary"
                      style="text-decoration: underline"
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
                          class: 'text-sm'
                        }
                      }"
                      @click="handleAddApiCredits"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-2 flex-1">
              <div class="text-sm">
                {{ $t('subscription.yourPlanIncludes') }}
              </div>

              <SubscriptionBenefits />
            </div>
          </div>
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

import CloudBadge from '@/components/topbar/CloudBadge.vue'
import SubscribeButton from '@/platform/cloud/subscription/components/SubscribeButton.vue'
import SubscriptionBenefits from '@/platform/cloud/subscription/components/SubscriptionBenefits.vue'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import { useSubscriptionActions } from '@/platform/cloud/subscription/composables/useSubscriptionActions'
import { useSubscriptionCredits } from '@/platform/cloud/subscription/composables/useSubscriptionCredits'
import { cn } from '@/utils/tailwindUtil'

const {
  isActiveSubscription,
  isCancelled,
  formattedRenewalDate,
  formattedEndDate,
  formattedMonthlyPrice,
  manageSubscription,
  handleInvoiceHistory
} = useSubscription()

const { totalCredits, monthlyBonusCredits, prepaidCredits, isLoadingBalance } =
  useSubscriptionCredits()

const {
  isLoadingSupport,
  refreshTooltip,
  handleAddApiCredits,
  handleMessageSupport,
  handleRefresh,
  handleLearnMoreClick
} = useSubscriptionActions()
</script>

<style scoped>
:deep(.bg-comfy-menu-secondary) {
  background-color: transparent;
}
</style>
