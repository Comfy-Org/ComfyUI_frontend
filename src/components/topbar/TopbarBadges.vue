<template>
  <div class="flex">
    <TopbarBadge
      v-for="badge in topbarBadgeStore.badges"
      :key="badge.text"
      :badge
    />
  </div>
</template>

<script lang="ts" setup>
import { useTopbarBadgeStore } from '@/stores/topbarBadgeStore'

import TopbarBadge from './TopbarBadge.vue'

const topbarBadgeStore = useTopbarBadgeStore()
</script>
