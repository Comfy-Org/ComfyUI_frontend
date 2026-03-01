<template>
  <TopbarBadge
    :badge="cloudBadge"
    :display-mode="displayMode"
    :reverse-order="reverseOrder"
    :no-padding="noPadding"
    :background-color="backgroundColor"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { TopbarBadge as TopbarBadgeType } from '@/types/comfy'

import TopbarBadge from './TopbarBadge.vue'

const {
  displayMode = 'full',
  reverseOrder = false,
  noPadding = false,
  backgroundColor = 'var(--comfy-menu-bg)'
} = defineProps<{
  displayMode?: 'full' | 'compact' | 'icon-only'
  reverseOrder?: boolean
  noPadding?: boolean
  backgroundColor?: string
}>()

const cloudBadge = computed<TopbarBadgeType>(() => ({
  icon: 'icon-[lucide--cloud]',
  text: 'Comfy Cloud'
}))
</script>
