<template>
  <TabPanel value="Credits" class="credits-container h-full">
    <div class="flex h-full flex-col">
      <h2 class="mb-2 text-2xl font-bold">
        {{ $t('credits.credits') }}
      </h2>

      <Divider />

      <div class="flex flex-col gap-2">
        <h3 class="text-sm font-medium text-muted">
          {{ $t('credits.yourCreditBalance') }}
        </h3>
        <div class="flex items-center justify-between">
          <UserCredit text-class="text-3xl font-bold" />
          <Skeleton v-if="loading" width="2rem" height="2rem" />
          <Button
            v-else
            :label="$t('credits.purchaseCredits')"
            :loading="loading"
            @click="handlePurchaseCreditsClick"
          />
        </div>
        <div class="flex flex-row items-center">
          <Skeleton
            v-if="balanceLoading"
            width="12rem"
            height="1rem"
            class="text-xs"
          />
          <div v-else-if="formattedLastUpdateTime" class="text-xs text-muted">
            {{ $t('credits.lastUpdated') }}: {{ formattedLastUpdateTime }}
          </div>
          <Button
            icon="pi pi-refresh"
            text
            size="small"
            severity="secondary"
            @click="() => authActions.fetchBalance()"
          />
        </div>
      </div>

      <div class="flex items-center justify-between">
        <h3>{{ $t('credits.activity') }}</h3>
        <Button
          :label="$t('credits.invoiceHistory')"
          text
          severity="secondary"
          icon="pi pi-arrow-up-right"
          :loading="loading"
          @click="handleCreditsHistoryClick"
        />
      </div>

      <template v-if="creditHistory.length > 0">
        <div class="grow">
          <DataTable :value="creditHistory" :show-headers="false">
            <Column field="title" :header="$t('g.name')">
              <template #body="{ data }">
                <div class="text-sm font-medium">{{ data.title }}</div>
                <div class="text-xs text-muted">{{ data.timestamp }}</div>
              </template>
            </Column>
            <Column field="amount" :header="$t('g.amount')">
              <template #body="{ data }">
                <div
                  :class="[
                    'text-center text-base font-medium',
                    data.isPositive ? 'text-sky-500' : 'text-red-400'
                  ]"
                >
                  {{ data.isPositive ? '+' : '-' }}${{
                    formatMetronomeCurrency(data.amount, 'usd')
                  }}
                </div>
              </template>
            </Column>
          </DataTable>
        </div>
      </template>

      <Divider />

      <UsageLogsTable ref="usageLogsTableRef" />

      <div class="flex flex-row gap-2">
        <Button
          :label="$t('credits.faqs')"
          text
          severity="secondary"
          icon="pi pi-question-circle"
          @click="handleFaqClick"
        />
        <Button
          :label="$t('credits.messageSupport')"
          text
          severity="secondary"
          icon="pi pi-comments"
          @click="handleMessageSupport"
        />
      </div>
    </div>
  </TabPanel>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Divider from 'primevue/divider'
import Skeleton from 'primevue/skeleton'
import TabPanel from 'primevue/tabpanel'
import { computed, ref, watch } from 'vue'

import UserCredit from '@/components/common/UserCredit.vue'
import UsageLogsTable from '@/components/dialog/content/setting/UsageLogsTable.vue'
import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import { useDialogService } from '@/services/dialogService'
import { useCommandStore } from '@/stores/commandStore'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import { formatMetronomeCurrency } from '@/utils/formatUtil'

interface CreditHistoryItemData {
  title: string
  timestamp: string
  amount: number
  isPositive: boolean
}

const dialogService = useDialogService()
const authStore = useFirebaseAuthStore()
const authActions = useFirebaseAuthActions()
const commandStore = useCommandStore()
const loading = computed(() => authStore.loading)
const balanceLoading = computed(() => authStore.isFetchingBalance)

const usageLogsTableRef = ref<InstanceType<typeof UsageLogsTable> | null>(null)

const formattedLastUpdateTime = computed(() =>
  authStore.lastBalanceUpdateTime
    ? authStore.lastBalanceUpdateTime.toLocaleString()
    : ''
)

watch(
  () => authStore.lastBalanceUpdateTime,
  (newTime, oldTime) => {
    if (newTime && newTime !== oldTime && usageLogsTableRef.value) {
      usageLogsTableRef.value.refresh()
    }
  }
)

const handlePurchaseCreditsClick = () => {
  dialogService.showTopUpCreditsDialog()
}

const handleCreditsHistoryClick = async () => {
  await authActions.accessBillingPortal()
}

const handleMessageSupport = async () => {
  await commandStore.execute('Comfy.ContactSupport')
}

const handleFaqClick = () => {
  window.open('https://docs.comfy.org/tutorials/api-nodes/faq', '_blank')
}

const creditHistory = ref<CreditHistoryItemData[]>([])
</script>
