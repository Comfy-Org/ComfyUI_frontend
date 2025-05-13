<template>
  <TabPanel value="Credits" class="credits-container h-full">
    <div class="flex flex-col h-full">
      <h2 class="text-2xl font-bold mb-2">
        {{ $t('credits.credits') }}
      </h2>

      <Divider />

      <div class="flex flex-col gap-2">
        <h3 class="text-sm font-medium text-muted">
          {{ $t('credits.yourCreditBalance') }}
        </h3>
        <div class="flex justify-between items-center">
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

      <div class="flex justify-between items-center mt-8">
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
        <div class="flex-grow">
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
                    'text-base font-medium text-center',
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
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import UserCredit from '@/components/common/UserCredit.vue'
import { useFirebaseAuthActions } from '@/composables/auth/useFirebaseAuthActions'
import { useDialogService } from '@/services/dialogService'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import { formatMetronomeCurrency } from '@/utils/formatUtil'

interface CreditHistoryItemData {
  title: string
  timestamp: string
  amount: number
  isPositive: boolean
}

const { t } = useI18n()
const dialogService = useDialogService()
const authStore = useFirebaseAuthStore()
const authActions = useFirebaseAuthActions()
const loading = computed(() => authStore.loading)
const balanceLoading = computed(() => authStore.isFetchingBalance)

const formattedLastUpdateTime = computed(() =>
  authStore.lastBalanceUpdateTime
    ? authStore.lastBalanceUpdateTime.toLocaleString()
    : ''
)

const handlePurchaseCreditsClick = () => {
  dialogService.showTopUpCreditsDialog()
}

const handleCreditsHistoryClick = async () => {
  await authActions.accessBillingPortal()
}

const handleMessageSupport = () => {
  dialogService.showIssueReportDialog({
    title: t('issueReport.contactSupportTitle'),
    subtitle: t('issueReport.contactSupportDescription'),
    panelProps: {
      errorType: 'BillingSupport',
      defaultFields: ['Workflow', 'Logs', 'SystemStats', 'Settings']
    }
  })
}

const handleFaqClick = () => {
  window.open('https://docs.comfy.org/tutorials/api-nodes/faq', '_blank')
}

const creditHistory = ref<CreditHistoryItemData[]>([])
</script>
