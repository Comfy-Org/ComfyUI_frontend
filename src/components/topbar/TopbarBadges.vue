<template>
  <div v-if="notMobile" class="flex h-full shrink-0 items-center">
    <TopbarBadge
      v-for="badge in topbarBadgeStore.badges"
      :key="badge.text"
      :badge
      :reverse-order="reverseOrder"
      :no-padding="noPadding"
    />
  </div>
</template>

<script lang="ts" setup>
import { useBreakpoints } from '@vueuse/core'

import { useTopbarBadgeStore } from '@/stores/topbarBadgeStore'

import TopbarBadge from './TopbarBadge.vue'

withDefaults(
  defineProps<{
    reverseOrder?: boolean
    noPadding?: boolean
  }>(),
  {
    reverseOrder: false,
    noPadding: false
  }
)

const BREAKPOINTS = { md: 880 }
const breakpoints = useBreakpoints(BREAKPOINTS)
const notMobile = breakpoints.greater('md')

const topbarBadgeStore = useTopbarBadgeStore()
</script>
