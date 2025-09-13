<template>
  <div v-if="balanceLoading" class="flex items-center gap-1">
    <div class="flex items-center gap-2">
      <Skeleton shape="circle" width="1.5rem" height="1.5rem" />
    </div>
    <div class="flex-1"></div>
    <Skeleton width="8rem" height="2rem" />
  </div>
  <div v-else class="flex items-center gap-1">
    <Tag
      severity="secondary"
      icon="pi pi-dollar"
      rounded
      class="text-amber-400 p-1"
    />
    <div :class="textClass">{{ formattedBalance }}</div>
  </div>
</template>

<script setup lang="ts">
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import { computed } from 'vue'

import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import { formatMetronomeCurrency } from '@/utils/formatUtil'

const { textClass } = defineProps<{
  textClass?: string
}>()

const authStore = useFirebaseAuthStore()
const balanceLoading = computed(() => authStore.isFetchingBalance)

const formattedBalance = computed(() => {
  if (!authStore.balance) return '0.00'
  return formatMetronomeCurrency(authStore.balance.amount_micros, 'usd')
})
</script>
