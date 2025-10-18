<template>
  <div class="flex">
    <TopbarBadge
      v-for="badge in topbarBadgeStore.badges"
      :key="badge.text"
      :badge
      :reverse-order="reverseOrder"
      :no-padding="noPadding"
      :label-class="labelClass"
      :text-class="textClass"
    />
  </div>
</template>

<script lang="ts" setup>
import { useTopbarBadgeStore } from '@/stores/topbarBadgeStore'

import TopbarBadge from './TopbarBadge.vue'

withDefaults(
  defineProps<{
    reverseOrder?: boolean
    noPadding?: boolean
    labelClass?: string
    textClass?: string
  }>(),
  {
    reverseOrder: false,
    noPadding: false,
    labelClass: '',
    textClass: ''
  }
)

const topbarBadgeStore = useTopbarBadgeStore()
</script>
