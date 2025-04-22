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
          <div class="flex items-center gap-1">
            <Tag
              severity="secondary"
              icon="pi pi-dollar"
              rounded
              class="text-amber-400 p-1"
            />
            <div class="text-3xl font-bold">${{ formattedBalance }}</div>
          </div>
          <ProgressSpinner
            v-if="loading"
            class="w-12 h-12"
            style="--pc-spinner-color: #000"
          />
          <Button
            v-else
            :label="$t('credits.purchaseCredits')"
            :loading="loading"
            @click="handlePurchaseCreditsClick"
          />
        </div>
      </div>

      <Divider class="mt-12" />

      <div class="flex justify-between items-center">
        <h3 class="text-base font-medium">
          {{ $t('credits.creditsHistory') }}
        </h3>
        <Button
          :label="$t('credits.paymentDetails')"
          text
          severity="secondary"
          icon="pi pi-arrow-up-right"
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
                    microsToUsd(data.amount)
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
        />
        <Button
          :label="$t('credits.messageSupport')"
          text
          severity="secondary"
          icon="pi pi-comments"
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
import ProgressSpinner from 'primevue/progressspinner'
import TabPanel from 'primevue/tabpanel'
import Tag from 'primevue/tag'
import { computed, onMounted, ref } from 'vue'

import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import { microsToUsd, usdToMicros } from '@/utils/formatUtil'

interface CreditHistoryItemData {
  title: string
  timestamp: string
  amount: number
  isPositive: boolean
}

const authStore = useFirebaseAuthStore()
const loading = computed(() => authStore.loading)

// Format balance from micros to dollars
const formattedBalance = computed(() => {
  if (!authStore.balance) return '0.00'
  return microsToUsd(authStore.balance.amount_micros)
})

// TODO: Either: (1) Get checkout URL that allows setting price on Stripe side, (2) Add number selection on credits panel
const selectedCurrencyAmount = usdToMicros(10)
const selectedCurrency = 'usd' // For now, only USD is supported on comfy-api backend

const handlePurchaseCreditsClick = async () => {
  const response = await authStore.initiateCreditPurchase({
    amount_micros: selectedCurrencyAmount,
    currency: selectedCurrency
  })
  if (!response) return

  const { checkout_url } = response
  if (checkout_url !== undefined) {
    // Start polling for balance changes
    authStore.creditsDidChange = true
    // Go to Stripe checkout page
    window.open(checkout_url, '_blank')
  }
}

// Fetch initial balance when panel is mounted
onMounted(() => {
  void authStore.fetchBalance()
})

const creditHistory = ref<CreditHistoryItemData[]>([])
</script>
