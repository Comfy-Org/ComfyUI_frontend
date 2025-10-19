<template>
  <TabPanel value="PlanCredits" class="subscription-container h-full">
    <div class="flex h-full flex-col">
      <div class="flex items-center gap-2">
        <h2 class="text-2xl">
          {{ $t('subscription.title') }}
        </h2>
        <TopbarBadges reverse-order />
      </div>

      <div class="grow overflow-auto">
        <div class="rounded-lg border border-charcoal-400 p-4">
          <div>
            <div class="flex items-center justify-between">
              <div>
                <div class="flex items-baseline gap-1">
                  <span class="text-2xl font-bold">{{
                    formattedMonthlyPrice
                  }}</span>
                  <span>{{ $t('subscription.perMonth') }}</span>
                </div>
                <div v-if="isActiveSubscription" class="text-xs text-muted">
                  {{
                    $t('subscription.renewsDate', {
                      date: formattedRenewalDate
                    })
                  }}
                </div>
              </div>
              <Button
                v-if="isActiveSubscription"
                :label="$t('subscription.manageSubscription')"
                severity="secondary"
                class="text-xs"
                @click="manageSubscription"
              />
              <SubscribeButton
                v-else
                :label="$t('subscription.subscribeNow')"
                size="small"
                button-class="text-xs"
                @subscribed="handleRefresh"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 gap-6 rounded-lg pt-10 lg:grid-cols-2">
            <div class="flex flex-col">
              <div class="flex flex-col gap-3">
                <div class="flex flex-col">
                  <div class="text-sm">
                    {{ $t('subscription.apiNodesBalance') }}
                  </div>
                  <div class="flex items-center">
                    <div class="text-xs text-muted">
                      {{ $t('subscription.apiNodesDescription') }}
                    </div>
                    <Button
                      icon="pi pi-question-circle"
                      text
                      rounded
                      size="small"
                      severity="secondary"
                      class="h-5 w-5"
                    />
                  </div>
                </div>

                <div
                  class="flex flex-col gap-3 rounded-lg border p-4 dark-theme:border-0 dark-theme:bg-charcoal-600"
                >
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="text-xs text-muted">
                        {{ $t('subscription.totalCredits') }}
                      </div>
                      <div class="text-2xl font-bold">${{ totalCredits }}</div>
                    </div>
                    <Button
                      icon="pi pi-sync"
                      severity="secondary"
                      size="small"
                      :loading="isLoadingBalance"
                      @click="handleRefresh"
                    />
                  </div>

                  <div
                    v-if="latestEvents.length > 0"
                    class="flex flex-col gap-2 pt-3 text-xs"
                  >
                    <div
                      v-for="event in latestEvents"
                      :key="event.event_id"
                      class="flex items-center justify-between py-1"
                    >
                      <div class="flex flex-col gap-0.5">
                        <span class="font-medium">
                          {{
                            event.event_type
                              ? customerEventService.formatEventType(
                                  event.event_type
                                )
                              : ''
                          }}
                        </span>
                        <span class="text-muted">
                          {{
                            event.createdAt
                              ? customerEventService.formatDate(event.createdAt)
                              : ''
                          }}
                        </span>
                      </div>
                      <div
                        v-if="event.params?.amount !== undefined"
                        class="font-bold"
                      >
                        ${{
                          customerEventService.formatAmount(
                            event.params.amount as number
                          )
                        }}
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center justify-between pt-2">
                    <Button
                      :label="$t('subscription.viewUsageHistory')"
                      text
                      severity="secondary"
                      class="p-0 text-xs text-muted"
                      @click="handleViewUsageHistory"
                    />
                    <Button
                      :label="$t('subscription.addApiCredits')"
                      severity="secondary"
                      class="text-xs"
                      @click="handleAddApiCredits"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-3">
              <div class="text-sm">
                {{ $t('subscription.yourPlanIncludes') }}
              </div>

              <SubscriptionBenefits />
            </div>
          </div>
        </div>
      </div>

      <div
        class="flex items-center justify-between border-t border-charcoal-400 pt-3"
      >
        <div class="flex gap-2">
          <Button
            :label="$t('subscription.learnMore')"
            text
            severity="secondary"
            icon="pi pi-question-circle"
            class="text-xs"
            @click="handleLearnMore"
          />
          <Button
            :label="$t('subscription.messageSupport')"
            text
            severity="secondary"
            icon="pi pi-comment"
            class="text-xs"
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
          @click="handleInvoiceHistory"
        />
      </div>
    </div>
  </TabPanel>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import TabPanel from 'primevue/tabpanel'
import { computed, onMounted, ref } from 'vue'

import TopbarBadges from '@/components/topbar/TopbarBadges.vue'
import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import SubscribeButton from '@/platform/cloud/subscription/components/SubscribeButton.vue'
import SubscriptionBenefits from '@/platform/cloud/subscription/components/SubscriptionBenefits.vue'
import { useSubscription } from '@/platform/cloud/subscription/composables/useSubscription'
import type { AuditLog } from '@/services/customerEventsService'
import { useCustomerEventsService } from '@/services/customerEventsService'
import { useDialogService } from '@/services/dialogService'
import { useCommandStore } from '@/stores/commandStore'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import { formatMetronomeCurrency } from '@/utils/formatUtil'

const dialogService = useDialogService()
const authActions = useFirebaseAuthActions()
const commandStore = useCommandStore()
const authStore = useFirebaseAuthStore()
const customerEventService = useCustomerEventsService()

const {
  isActiveSubscription,
  formattedRenewalDate,
  formattedMonthlyPrice,
  manageSubscription,
  handleViewUsageHistory,
  handleLearnMore,
  handleInvoiceHistory,
  fetchStatus
} = useSubscription()

const latestEvents = ref<AuditLog[]>([])

const totalCredits = computed(() => {
  if (!authStore.balance) return '0.00'
  return formatMetronomeCurrency(authStore.balance.amount_micros, 'usd')
})

const isLoadingBalance = computed(() => authStore.isFetchingBalance)

const fetchLatestEvents = async () => {
  try {
    const response = await customerEventService.getMyEvents({
      page: 1,
      limit: 2
    })
    if (response?.events) {
      latestEvents.value = response.events
    }
  } catch (error) {
    console.error('[SubscriptionPanel] Error fetching latest events:', error)
  }
}

onMounted(() => {
  void handleRefresh()
})

const handleAddApiCredits = () => {
  dialogService.showTopUpCreditsDialog()
}

const handleMessageSupport = async () => {
  await commandStore.execute('Comfy.ContactSupport')
}

const handleRefresh = async () => {
  await Promise.all([
    authActions.fetchBalance(),
    fetchStatus(),
    fetchLatestEvents()
  ])
}
</script>

<style scoped>
:deep(.bg-comfy-menu-secondary) {
  background-color: transparent;
}
</style>
