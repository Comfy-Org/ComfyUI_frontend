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
            <div class="text-3xl font-bold">{{ creditBalance }}</div>
          </div>
          <Button :label="$t('credits.purchaseCredits')" />
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
                {{ data.isPositive ? '+' : '-' }}{{ data.amount }}
              </div>
            </template>
          </Column>
        </DataTable>
      </div>

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
import TabPanel from 'primevue/tabpanel'
import Tag from 'primevue/tag'
import { ref } from 'vue'

// Mock data - in a real implementation, this would come from a store or API
const creditBalance = ref(0.05)

interface CreditHistoryItemData {
  title: string
  timestamp: string
  amount: number
  isPositive: boolean
}

const creditHistory = ref<CreditHistoryItemData[]>([
  {
    title: 'Kling Text-to-Video v1-6',
    timestamp: '2025-04-09, 12:50:08 p.m.',
    amount: 4,
    isPositive: false
  },
  {
    title: 'Kling Text-to-Video v1-6',
    timestamp: '2025-04-09, 12:50:08 p.m.',
    amount: 23,
    isPositive: false
  },
  {
    title: 'Kling Text-to-Video v1-6',
    timestamp: '2025-04-09, 12:50:08 p.m.',
    amount: 22,
    isPositive: false
  },
  {
    title: 'Free monthly credits',
    timestamp: '2025-04-09, 12:46:08 p.m.',
    amount: 166,
    isPositive: true
  }
])
</script>
