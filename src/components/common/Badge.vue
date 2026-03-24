<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/utils/tailwindUtil'

import { badgeVariants } from './badge.variants'
import type { BadgeVariants } from './badge.variants'

const {
  label,
  severity = 'default',
  variant,
  class: className
} = defineProps<{
  label?: string | number
  severity?: BadgeVariants['severity']
  variant?: BadgeVariants['variant']
  class?: string
}>()

const badgeClass = computed(() =>
  cn(
    badgeVariants({
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
