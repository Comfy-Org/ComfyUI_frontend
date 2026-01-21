<script setup lang="ts">
import { computed } from 'vue'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/utils/tailwindUtil'

import { statusBadgeVariants } from './statusBadge.variants'
import type { StatusBadgeVariants } from './statusBadge.variants'

const {
  label,
  severity = 'default',
  variant,
  class: customClass = ''
} = defineProps<{
  label?: string | number
  severity?: StatusBadgeVariants['severity']
  variant?: StatusBadgeVariants['variant']
  class?: HTMLAttributes['class']
}>()

const badgeClasses = computed(() =>
  cn(
    statusBadgeVariants({
      severity,
      variant: variant ?? (label == null ? 'dot' : 'label')
    }),
    customClass
  )
)
</script>

<template>
  <span :class="badgeClasses">{{ label }}</span>
</template>
