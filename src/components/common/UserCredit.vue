<template>
  <div v-if="balanceLoading" class="flex items-center gap-1">
    <div class="flex items-center gap-2">
      <Skeleton shape="circle" width="1.5rem" height="1.5rem" />
    </div>
    <div class="flex-1"></div>
    <Skeleton width="8rem" height="2rem" />
  </div>
  <div v-else class="flex items-center gap-1">
    <Tag severity="secondary" rounded class="p-1 text-amber-400">
      <template #icon>
        <i
          :class="
            flags.subscriptionTiersEnabled
              ? 'icon-[lucide--component]'
              : 'pi pi-dollar'
          "
        />
      </template>
    </Tag>
    <div :class="textClass">{{ formattedBalance }}</div>
  </div>
</template>

<script setup lang="ts">
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import { computed } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useFirebaseAuthStore } from '@/stores/firebaseAuthStore'
import { formatMetronomeCurrency } from '@/utils/formatUtil'

const { textClass } = defineProps<{
  textClass?: string
}>()

const authStore = useFirebaseAuthStore()
const { flags } = useFeatureFlags()
const balanceLoading = computed(() => authStore.isFetchingBalance)

const formattedBalance = computed(() => {
  if (!authStore.balance) return '0.00'
  return formatMetronomeCurrency(authStore.balance.amount_micros, 'usd')
})
</script>
