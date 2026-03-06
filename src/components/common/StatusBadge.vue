<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/utils/tailwindUtil'

import { statusBadgeVariants } from './statusBadge.variants'
import type { StatusBadgeVariants } from './statusBadge.variants'

const {
  label,
  severity = 'default',
  variant,
  class: className
} = defineProps<{
  label?: string | number
  severity?: StatusBadgeVariants['severity']
  variant?: StatusBadgeVariants['variant']
  class?: string
}>()

const badgeClass = computed(() =>
  cn(
    statusBadgeVariants({
      severity,
      variant: variant ?? (label == null ? 'dot' : 'label')
    }),
    className
  )
)
</script>

<template>
  <span :class="badgeClass">
    {{ label }}
  </span>
</template>
